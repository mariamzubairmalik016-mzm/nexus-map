import { Router } from "express";
import { z } from "zod";

import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { rateLimit } from "../utils/rateLimit.js";
import { roadAlertStore } from "../services/roadAlertStore.js";
import { supabaseAdmin } from "../config/supabase.js";
import { memoryStore } from "../data/memoryStore.js";
import { ROAD_ALERT_TYPES, type RoadAlert } from "../types/models.js";

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

// Expired active alerts must not be shown as active.
const withExpiry = (alert: RoadAlert): RoadAlert =>
  alert.status !== "resolved" && new Date(alert.expiresAt).getTime() < Date.now()
    ? { ...alert, status: "resolved" }
    : alert;

const humanTitle = (type: string) => type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
      // audit table may not exist yet — memory log still records it
    }
  }
};

// GET / — list active/monitoring alerts with optional filters (public read).
roadAlertsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = z
      .object({
        type: z.string().optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        status: z.enum(["active", "monitoring", "resolved"]).optional(),
        source: z.string().optional(),
        lat: z.coerce.number().optional(),
        lng: z.coerce.number().optional(),
        radiusKm: z.coerce.number().optional(),
      })
      .parse(request.query);

    let alerts = (await roadAlertStore.list()).map(withExpiry);

    if (query.type) alerts = alerts.filter((a) => a.type === query.type);
    if (query.severity) alerts = alerts.filter((a) => a.severity === query.severity);
    if (query.status) alerts = alerts.filter((a) => a.status === query.status);
    if (query.source) alerts = alerts.filter((a) => a.source === query.source);
    if (query.lat != null && query.lng != null && query.radiusKm != null) {
      alerts = alerts.filter(
        (a) => distanceKm(query.lat!, query.lng!, a.latitude, a.longitude) <= query.radiusKm!,
      );
    }

    response.json({
      success: true,
      data: alerts,
      meta: { source: supabaseAdmin ? "supabase" : "demo-memory", updatedAt: new Date().toISOString() },
    });
  }),
);

// POST / — report a road alert (authenticated, rate-limited, deduped).
roadAlertsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    const userId = request.authUser!.id;
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

    // Duplicate prevention: same type within ~150m and still active.
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
      status: "monitoring",
      source: "community",
      reporterId: userId,
      verificationCount: 0,
      reportCount: 1,
      estimatedDelayMinutes: body.estimatedDelayMinutes,
      alternateRoute: body.alternateRoute,
      imageUrl: body.imageUrl,
      isVerified: false,
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
