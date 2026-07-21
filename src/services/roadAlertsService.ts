import { api } from "./api";
import { offlineDb } from "./offlineDb";
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
      await offlineDb.saveRoadAlerts(alerts);
      return { alerts, live: true };
    } catch {
      const cached = (await offlineDb.getRoadAlerts()).map((a) => ({ ...a, source: "cached" as const }));
      return { alerts: cached, live: false };
    }
  },

  report: (input: ReportInput) => api.post<RoadAlert>("/road-alerts", input),
  confirm: (id: string) => api.post<RoadAlert>(`/road-alerts/${id}/confirm`, {}),
  resolve: (id: string) => api.post<RoadAlert>(`/road-alerts/${id}/resolve`, {}),
};
