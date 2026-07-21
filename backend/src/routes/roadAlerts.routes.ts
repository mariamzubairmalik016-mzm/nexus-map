import { Router } from "express";
import { z } from "zod";

import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { rateLimit } from "../utils/rateLimit.js";
import { roadAlertStore } from "../services/roadAlertStore.js";
import { getTomTomIncidents } from "../services/tomtom.service.js";
import { supabaseAdmin } from "../config/supabase.js";
import { memoryStore } from "../data/memoryStore.js";
import { DEMO_ALERTS } from "../data/demoAlerts.js";
import { ROAD_ALERT_TYPES, type AlertSeverity, type RoadAlert, type RoadAlertType } from "../types/models.js";

export const roadAlertsRouter = Router();

const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const withExpiry = (alert: RoadAlert): RoadAlert =>
  alert.status !== "resolved" && new Date(alert.expiresAt).getTime() < Date.now()
    ? { ...alert, status: "resolved" }
    : alert;

const humanTitle = (type: string) => type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// --- Live API (TomTom) normalization ---
const ICON_TO_TYPE: Record<number, RoadAlertType> = {
  1: "accident",
  6: "heavy_traffic",
  7: "road_closed",
  8: "road_closed",
  9: "construction",
  11: "flooded_road",
  14: "obstruction",
};
const magnitudeToSeverity = (m: number): AlertSeverity => (m >= 4 ? "critical" : m === 3 ? "high" : m === 2 ? "medium" : "low");

type TomTomIncident = {
  id: string;
  title: string;
  description: string;
  severity: number;
  category: string;
  position?: { latitude: number; longitude: number };
};

const normalizeApiIncident = (incident: TomTomIncident): RoadAlert => {
  const iso = new Date().toISOString();
  const iconCategory = Number(incident.category) || 0;
  return {
    id: `api-${incident.id}`,
    type: ICON_TO_TYPE[iconCategory] ?? "heavy_traffic",
    title: incident.title || "Traffic incident",
    description: incident.description || "Reported by the traffic provider.",
    latitude: incident.position!.latitude,
    longitude: incident.position!.longitude,
    location:
      incident.description || `${incident.position!.latitude.toFixed(4)}, ${incident.position!.longitude.toFixed(4)}`,
    severity: magnitudeToSeverity(incident.severity ?? 0),
    status: "active",
    source: "api",
    verificationCount: 0,
    reportCount: 0,
    isVerified: true,
    createdAt: iso,
    updatedAt: iso,
    expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
  };
};

// --- Duplicate detection across sources (admin > api > community > cached > demo) ---
const SOURCE_PRIORITY: Record<string, number> = { admin: 4, api: 3, community: 2, cached: 1, demo: 0 };
const dedupe = (alerts: RoadAlert[]): RoadAlert[] => {
  const result: RoadAlert[] = [];
  for (const alert of alerts) {
    const dup = result.find(
      (r) => r.type === alert.type && distanceKm(r.latitude, r.longitude, alert.latitude, alert.longitude) < 0.15,
    );
    if (!dup) {
      result.push({ ...alert });
      continue;
    }
    const mergedVerif = dup.verificationCount + alert.verificationCount;
    if ((SOURCE_PRIORITY[alert.source] ?? 0) > (SOURCE_PRIORITY[dup.source] ?? 0)) {
      Object.assign(dup, alert, { verificationCount: mergedVerif });
    } else {
      dup.verificationCount = mergedVerif;
    }
  }
  return result;
};

const audit = async (adminId: string | undefined, action: string, entityId?: string, notes?: string) => {
  memoryStore.auditLog.unshift({
    id: crypto.randomUUID(),
    adminId,
    action,
    entity: "road_alert",
    entityId,
    notes,
    createdAt: new Date().toISOString(),
  });
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from("admin_audit_log").insert({
        admin_id: adminId ?? null,
        action,
        entity: "road_alert",
        entity_id: entityId ?? null,
        notes: notes ?? null,
      });
    } catch {
      /* audit table may not exist yet */
    }
  }
};

// GET / — mixed-source alerts with a source summary (public read).
roadAlertsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = z
      .object({
        type: z.string().optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        status: z.enum(["active", "monitoring", "resolved"]).optional(),
        source: z.enum(["all", "api", "community", "admin", "cached", "demo"]).optional(),
        lat: z.coerce.number().optional(),
        lng: z.coerce.number().optional(),
        radiusKm: z.coerce.number().optional(),
        includeDemo: z.enum(["true", "false"]).optional(),
      })
      .parse(request.query);

    const includeDemo = query.includeDemo === "true";

    // 1) Real persisted alerts (community/admin) — never demo.
    const stored = (await roadAlertStore.list()).map(withExpiry).filter((a) => a.source !== "demo");

    // 2) Live API (TomTom) incidents when a location is provided.
    let apiAlerts: RoadAlert[] = [];
    let apiStatus: "connected" | "not-queried" | "error" = "not-queried";
    if (query.lat != null && query.lng != null) {
      const r = query.radiusKm ?? 8;
      const dLat = r / 111;
      const dLng = r / (111 * Math.max(0.1, Math.cos((query.lat * Math.PI) / 180)));
      const bbox = `${query.lng - dLng},${query.lat - dLat},${query.lng + dLng},${query.lat + dLat}`;
      try {
        const incidents = (await getTomTomIncidents(bbox)) as TomTomIncident[];
        apiAlerts = incidents.filter((i) => i.position).map(normalizeApiIncident);
        apiStatus = "connected";
      } catch {
        apiStatus = "error";
      }
    }

    // 3) Combine real sources + dedupe.
    const combined = dedupe([...stored, ...apiAlerts]);

    // 4) Demo only when explicitly enabled, and never hiding a real alert.
    if (includeDemo) {
      for (const demo of DEMO_ALERTS) {
        const clash = combined.find(
          (a) => a.type === demo.type && distanceKm(a.latitude, a.longitude, demo.latitude, demo.longitude) < 0.2,
        );
        if (!clash) combined.push(demo);
      }
    }

    const countBy = (source: string) => combined.filter((a) => a.source === source).length;
    const sources = {
      api: { status: apiStatus, count: countBy("api") },
      community: { count: countBy("community") },
      admin: { count: countBy("admin") },
      cached: { count: 0 },
      demo: { enabled: includeDemo, count: countBy("demo") },
    };

    // Filters.
    let alerts = combined;
    if (query.source && query.source !== "all") alerts = alerts.filter((a) => a.source === query.source);
    if (query.type) alerts = alerts.filter((a) => a.type === query.type);
    if (query.severity) alerts = alerts.filter((a) => a.severity === query.severity);
    if (query.status) alerts = alerts.filter((a) => a.status === query.status);
    if (query.lat != null && query.lng != null && query.radiusKm != null) {
      alerts = alerts.filter((a) => distanceKm(query.lat!, query.lng!, a.latitude, a.longitude) <= query.radiusKm!);
    }

    response.json({ success: true, data: alerts, meta: { sources, updatedAt: new Date().toISOString() } });
  }),
);

// POST / — report a road alert (authenticated, rate-limited, deduped).
roadAlertsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    const userId = request.authUser!.id;
    const isAdmin = request.authUser?.role === "admin";
    if (!rateLimit(`alert:${userId}`, 5, 60_000)) {
      throw new HttpError(429, "Too many reports — please wait a moment.");
    }

    const body = z
      .object({
        type: z.enum(ROAD_ALERT_TYPES),
        title: z.string().trim().max(120).optional(),
        description: z.string().trim().min(5).max(600),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        location: z.string().trim().max(160).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        estimatedDelayMinutes: z.number().int().min(0).max(600).optional(),
        alternateRoute: z.string().trim().max(200).optional(),
        imageUrl: z.string().url().max(500).optional(),
      })
      .parse(request.body);

    const existing = (await roadAlertStore.list()).map(withExpiry);
    const duplicate = existing.find(
      (a) =>
        a.type === body.type &&
        a.status !== "resolved" &&
        distanceKm(a.latitude, a.longitude, body.latitude, body.longitude) < 0.15,
    );
    if (duplicate) {
      const updated = await roadAlertStore.update(duplicate.id, {
        verificationCount: duplicate.verificationCount + 1,
      });
      response.status(200).json({ success: true, data: updated, meta: { deduped: true } });
      return;
    }

    const timestamp = new Date().toISOString();
    const alert: RoadAlert = {
      id: crypto.randomUUID(),
      type: body.type,
      title: body.title || humanTitle(body.type),
      description: body.description,
      latitude: body.latitude,
      longitude: body.longitude,
      location: body.location || `${body.latitude.toFixed(4)}, ${body.longitude.toFixed(4)}`,
      severity: body.severity,
      // Source + trust follow the reporter's role. Demo is never created here.
      status: isAdmin ? "active" : "monitoring",
      source: isAdmin ? "admin" : "community",
      reporterId: userId,
      verificationCount: 0,
      reportCount: 1,
      estimatedDelayMinutes: body.estimatedDelayMinutes,
      alternateRoute: body.alternateRoute,
      imageUrl: body.imageUrl,
      isVerified: isAdmin,
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: new Date(Date.now() + 12 * 3600_000).toISOString(),
    };

    const created = await roadAlertStore.insert(alert);
    response.status(201).json({ success: true, data: created });
  }),
);

// POST /:id/confirm — community "still active" confirmation.
roadAlertsRouter.post(
  "/:id/confirm",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (!rateLimit(`confirm:${request.authUser!.id}`, 20, 60_000)) {
      throw new HttpError(429, "Too many actions — please wait a moment.");
    }
    const alert = (await roadAlertStore.list()).find((a) => a.id === request.params.id);
    if (!alert) throw new HttpError(404, "Alert not found.");
    const count = alert.verificationCount + 1;
    const updated = await roadAlertStore.update(alert.id, {
      verificationCount: count,
      status: count >= 3 ? "active" : alert.status,
      isVerified: count >= 5 ? true : alert.isVerified,
    });
    response.json({ success: true, data: updated });
  }),
);

// POST /:id/resolve — community "resolved" report.
roadAlertsRouter.post(
  "/:id/resolve",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (!rateLimit(`resolve:${request.authUser!.id}`, 20, 60_000)) {
      throw new HttpError(429, "Too many actions — please wait a moment.");
    }
    const alert = (await roadAlertStore.list()).find((a) => a.id === request.params.id);
    if (!alert) throw new HttpError(404, "Alert not found.");
    const reports = alert.reportCount + 1;
    const updated = await roadAlertStore.update(alert.id, {
      reportCount: reports,
      status: reports >= 3 ? "resolved" : alert.status,
    });
    response.json({ success: true, data: updated });
  }),
);

// --- Admin moderation (requireAuth + requireAdmin) + audit log ---
roadAlertsRouter.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (request, response) => {
    const patch = z
      .object({
        status: z.enum(["active", "monitoring", "resolved"]).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        isVerified: z.boolean().optional(),
        title: z.string().trim().max(120).optional(),
        description: z.string().trim().max(600).optional(),
      })
      .parse(request.body);

    const id = String(request.params.id);
    const updated = await roadAlertStore.update(id, patch);
    if (!updated) throw new HttpError(404, "Alert not found.");
    await audit(request.authUser!.id, `update:${Object.keys(patch).join(",")}`, id);
    response.json({ success: true, data: updated });
  }),
);

roadAlertsRouter.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (request, response) => {
    const id = String(request.params.id);
    const removed = await roadAlertStore.remove(id);
    if (!removed) throw new HttpError(404, "Alert not found.");
    await audit(request.authUser!.id, "delete", id);
    response.status(204).send();
  }),
);
