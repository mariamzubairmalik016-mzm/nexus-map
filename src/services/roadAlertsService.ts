import { api } from "./api";
import { offlineDb } from "./offlineDb";
import { supabase } from "../lib/supabase";
import { networkStatus } from "./networkStatus";
import {
  EMPTY_SOURCES_META,
  type AlertSeverity,
  type RoadAlert,
  type RoadAlertType,
  type SourcesMeta,
} from "../types/roadAlerts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
  source?: string; // all | api | community | admin | cached | demo
  includeDemo?: boolean;
  lat?: number;
  lng?: number;
  radiusKm?: number;
};

export type AlertsResult = { alerts: RoadAlert[]; meta: SourcesMeta; live: boolean };

export const roadAlertsService = {
  // Mixed-source fetch. Caches real alerts; falls back to the offline cache
  // (preserving each alert's original source) when the network is unavailable.
  async list(filter: AlertsFilter = {}): Promise<AlertsResult> {
    const params = new URLSearchParams();
    if (filter.type) params.set("type", filter.type);
    if (filter.severity) params.set("severity", filter.severity);
    if (filter.status) params.set("status", filter.status);
    if (filter.source && filter.source !== "cached") params.set("source", filter.source);
    if (filter.includeDemo) params.set("includeDemo", "true");
    if (filter.lat != null) params.set("lat", String(filter.lat));
    if (filter.lng != null) params.set("lng", String(filter.lng));
    if (filter.radiusKm != null) params.set("radiusKm", String(filter.radiusKm));

    // Offline-first: serve the cache directly without touching the network.
    if (networkStatus.isOffline()) {
      const cached = (await offlineDb.getRoadAlerts().catch(() => [])).map((a) => ({
        ...a,
        originalSource: a.source,
        source: "cached" as const,
      }));
      return { alerts: cached, meta: { ...EMPTY_SOURCES_META, cached: { count: cached.length } }, live: false };
    }

    try {
      const response = await fetch(`${API_URL}/road-alerts?${params.toString()}`);
      if (!response.ok) throw new Error(String(response.status));
      const json = (await response.json()) as { data: RoadAlert[]; meta?: { sources?: SourcesMeta } };
      const alerts = json.data ?? [];
      const meta = json.meta?.sources ?? EMPTY_SOURCES_META;
      // Cache only real alerts (never demo) so offline shows genuine data.
      void offlineDb.saveRoadAlerts(alerts.filter((a) => a.source !== "demo")).catch(() => {});
      return { alerts, meta, live: true };
    } catch {
      // Offline / server down: serve the cache, keeping the original source.
      try {
        const cached = (await offlineDb.getRoadAlerts()).map((a) => ({
          ...a,
          originalSource: a.source,
          source: "cached" as const,
        }));
        return {
          alerts: cached,
          meta: { ...EMPTY_SOURCES_META, cached: { count: cached.length } },
          live: false,
        };
      } catch {
        return { alerts: [], meta: EMPTY_SOURCES_META, live: false };
      }
    }
  },

  report: (input: ReportInput) => api.post<RoadAlert>("/road-alerts", input),
  confirm: (id: string) => api.post<RoadAlert>(`/road-alerts/${id}/confirm`, {}),
  resolve: (id: string) => api.post<RoadAlert>(`/road-alerts/${id}/resolve`, {}),

  // Supabase Realtime when the road_alerts table exists; otherwise a no-op.
  subscribeRealtime(onChange: () => void): () => void {
    // Never open a Realtime WebSocket while offline (prevents reconnect floods).
    if (!supabase || networkStatus.isOffline()) return () => {};
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
