import { api } from "./api";
import { offlineDb } from "./offlineDb";
import { networkStatus } from "./networkStatus";
import {
  EMPTY_SOURCES_META,
  type AlertSeverity,
  type RoadAlert,
  type RoadAlertType,
  type SourcesMeta,
} from "../types/roadAlerts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

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

/**
 * An alert is only usable if it can actually be placed on the map. A response
 * is not guaranteed to match `RoadAlert` just because it is typed as one — a
 * legacy or demo payload can carry its position as a `location` string with no
 * numeric latitude/longitude, and MapLibre throws on a non-finite LngLat, which
 * unmounts the map and blanks the page.
 *
 * Dropping such records here, at the single boundary where alerts enter the
 * app, keeps both React state and the IndexedDB cache clean — otherwise one bad
 * record gets persisted and keeps breaking the map long after the server is
 * fixed.
 */
export const isPlaceableAlert = (alert: RoadAlert): boolean =>
  Number.isFinite(alert?.latitude) && Number.isFinite(alert?.longitude);

const isPlaceable = isPlaceableAlert;

export const usableAlerts = (alerts: RoadAlert[]): RoadAlert[] => {
  const usable = alerts.filter(isPlaceable);
  if ((process.env.NODE_ENV === 'development') && usable.length !== alerts.length) {
    console.warn(
      `[roadAlerts] dropped ${alerts.length - usable.length} alert(s) with no usable coordinates`,
    );
  }
  return usable;
};

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
      const cached = usableAlerts(await offlineDb.getRoadAlerts().catch(() => [])).map((a) => ({
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
      const alerts = usableAlerts(json.data ?? []);
      const meta = json.meta?.sources ?? EMPTY_SOURCES_META;
      // Cache only real alerts (never demo) so offline shows genuine data.
      void offlineDb.saveRoadAlerts(alerts.filter((a) => a.source !== "demo")).catch(() => {});
      return { alerts, meta, live: true };
    } catch {
      // Offline / server down: serve the cache, keeping the original source.
      try {
        const cached = usableAlerts(await offlineDb.getRoadAlerts()).map((a) => ({
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

  /**
   * Live alert updates.
   *
   * Vercel Postgres has no websockets, so this polls. Three things make the
   * polling behave like a live feed rather than a timer:
   *
   *   - 10s while the tab is visible, not 30s. Half a minute is long enough
   *     that a hazard someone just reported feels absent rather than new.
   *   - Nothing at all while the tab is hidden. The old interval kept firing
   *     in background tabs, burning requests nobody could see.
   *   - An immediate refresh when the tab is focused again or the connection
   *     returns, so what you see on returning is current rather than however
   *     stale it was when you left.
   */
  subscribeRealtime(onChange: () => void): () => void {
    const POLL_MS = 10_000;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        if (!networkStatus.isOffline() && document.visibilityState === "visible") onChange();
      }, POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!networkStatus.isOffline()) onChange();
        start();
      } else {
        stop();
      }
    };

    const onOnline = () => {
      onChange();
      start();
    };

    if (document.visibilityState === "visible" && !networkStatus.isOffline()) start();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", stop);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", stop);
    };
  },
};
