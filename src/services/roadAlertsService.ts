import { api } from "./api";
import { offlineDb } from "./offlineDb";
import { supabase } from "../lib/supabase";
import type { AlertSeverity, RoadAlert, RoadAlertType } from "../types/roadAlerts";

export type ReportInput = {
  type: RoadAlertType;
  description: string;
  latitude: number;
  longitude: number;
  severity: AlertSeverity;
  title?: string;
  location?: string;
  estimatedDelayMinutes?: number;
  alternateRoute?: string;
};

export type AlertsFilter = {
  type?: string;
  severity?: string;
  status?: string;
};

export const roadAlertsService = {
  // Fetch live alerts and cache them; fall back to the IndexedDB cache offline.
  async list(filter: AlertsFilter = {}): Promise<{ alerts: RoadAlert[]; live: boolean }> {
    const params = new URLSearchParams();
    if (filter.type) params.set("type", filter.type);
    if (filter.severity) params.set("severity", filter.severity);
    if (filter.status) params.set("status", filter.status);
    const qs = params.toString() ? `?${params.toString()}` : "";

    try {
      const alerts = await api.get<RoadAlert[]>(`/road-alerts${qs}`);
      // Cache is best-effort — never let a cache-write failure hide live data.
      void offlineDb.saveRoadAlerts(alerts).catch(() => {});
      return { alerts, live: true };
    } catch {
      // Offline / server down: fall back to the cache. If IndexedDB itself is
      // unavailable, return an empty list rather than crashing the page.
      try {
        const cached = (await offlineDb.getRoadAlerts()).map((a) => ({ ...a, source: "cached" as const }));
        return { alerts: cached, live: false };
      } catch {
        return { alerts: [], live: false };
      }
    }
  },

  report: (input: ReportInput) => api.post<RoadAlert>("/road-alerts", input),
  confirm: (id: string) => api.post<RoadAlert>(`/road-alerts/${id}/confirm`, {}),
  resolve: (id: string) => api.post<RoadAlert>(`/road-alerts/${id}/resolve`, {}),

  // Supabase Realtime when the road_alerts table exists; otherwise a no-op
  // (polling covers refresh). Returns an unsubscribe function.
  subscribeRealtime(onChange: () => void): () => void {
    if (!supabase) return () => {};
    const client = supabase;
    const channel = client
      .channel("nexus-road-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "road_alerts" }, () => onChange())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  },
};
