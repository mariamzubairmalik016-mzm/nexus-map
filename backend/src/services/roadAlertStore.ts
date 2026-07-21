import { supabaseAdmin } from "../config/supabase.js";
import { memoryStore } from "../data/memoryStore.js";
import type { RoadAlert } from "../types/models.js";

const TABLE = "road_alerts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const fromRow = (r: any): RoadAlert => ({
  id: r.id,
  type: r.type,
  title: r.title,
  description: r.description,
  latitude: r.latitude,
  longitude: r.longitude,
  location: r.location ?? "",
  severity: r.severity,
  status: r.status,
  source: r.source,
  reporterId: r.reporter_id ?? undefined,
  verificationCount: r.verification_count ?? 0,
  reportCount: r.report_count ?? 0,
  imageUrl: r.image_url ?? undefined,
  estimatedDelayMinutes: r.estimated_delay_minutes ?? undefined,
  alternateRoute: r.alternate_route ?? undefined,
  isVerified: r.is_verified ?? false,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  expiresAt: r.expires_at,
});

const toRow = (a: RoadAlert) => ({
  id: a.id,
  type: a.type,
  title: a.title,
  description: a.description,
  latitude: a.latitude,
  longitude: a.longitude,
  location: a.location,
  severity: a.severity,
  status: a.status,
  source: a.source,
  reporter_id: a.reporterId ?? null,
  verification_count: a.verificationCount,
  report_count: a.reportCount,
  image_url: a.imageUrl ?? null,
  estimated_delay_minutes: a.estimatedDelayMinutes ?? null,
  alternate_route: a.alternateRoute ?? null,
  is_verified: a.isVerified,
  created_at: a.createdAt,
  updated_at: a.updatedAt,
  expires_at: a.expiresAt,
});

/**
 * Road-alert persistence. Prefers the Supabase `road_alerts` table when it is
 * reachable, and falls back transparently to the in-memory store otherwise
 * (so the feature works even before the SQL migration has been run).
 */
export const roadAlertStore = {
  async list(): Promise<RoadAlert[]> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from(TABLE).select("*").order("created_at", { ascending: false });
      if (!error && data) return data.map(fromRow);
    }
    return [...memoryStore.roadAlerts];
  },

  async insert(alert: RoadAlert): Promise<RoadAlert> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from(TABLE).insert(toRow(alert)).select("*").single();
      if (!error && data) return fromRow(data);
    }
    memoryStore.roadAlerts.unshift(alert);
    return alert;
  },

  async update(id: string, patch: Partial<RoadAlert>): Promise<RoadAlert | null> {
    const updatedAt = new Date().toISOString();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from(TABLE)
        .update(buildPatch(patch, updatedAt))
        .eq("id", id)
        .select("*")
        .single();
      if (!error && data) return fromRow(data);
    }
    const found = memoryStore.roadAlerts.find((a) => a.id === id);
    if (!found) return null;
    Object.assign(found, patch, { updatedAt });
    return found;
  },

  async remove(id: string): Promise<boolean> {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from(TABLE).delete().eq("id", id);
      if (!error) return true;
    }
    const index = memoryStore.roadAlerts.findIndex((a) => a.id === id);
    if (index < 0) return false;
    memoryStore.roadAlerts.splice(index, 1);
    return true;
  },
};

const COLUMN: Record<string, string> = {
  status: "status",
  severity: "severity",
  title: "title",
  description: "description",
  isVerified: "is_verified",
  verificationCount: "verification_count",
  reportCount: "report_count",
  estimatedDelayMinutes: "estimated_delay_minutes",
  alternateRoute: "alternate_route",
};

const buildPatch = (patch: Partial<RoadAlert>, updatedAt: string) => {
  const out: Record<string, unknown> = { updated_at: updatedAt };
  for (const [key, value] of Object.entries(patch)) {
    const col = COLUMN[key];
    if (col) out[col] = value;
  }
  return out;
};
