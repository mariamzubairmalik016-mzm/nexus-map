export const ALERT_TYPES = [
  "accident",
  "road_closed",
  "construction",
  "damaged_road",
  "potholes",
  "heavy_traffic",
  "flooded_road",
  "water_logging",
  "fog",
  "landslide",
  "bridge_closed",
  "obstruction",
  "police_checkpoint",
  "protest",
  "dangerous_area",
  "transport_disruption",
  "no_parking",
  "other",
] as const;

export type RoadAlertType = (typeof ALERT_TYPES)[number];
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "active" | "monitoring" | "resolved";
export type AlertSource = "api" | "admin" | "community" | "cached" | "demo";

export type RoadAlert = {
  id: string;
  type: RoadAlertType;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  location: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: AlertSource;
  // When a cached copy is shown offline, source becomes "cached" and this keeps
  // the real origin (e.g. "community", "api") for the "Cached • Originally …" badge.
  originalSource?: AlertSource;
  reporterId?: string;
  verificationCount: number;
  reportCount: number;
  imageUrl?: string;
  estimatedDelayMinutes?: number;
  alternateRoute?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export const ALERT_LABELS: Record<RoadAlertType, string> = {
  accident: "Accident",
  road_closed: "Road Closed",
  construction: "Construction",
  damaged_road: "Damaged Road",
  potholes: "Potholes",
  heavy_traffic: "Heavy Traffic",
  flooded_road: "Flooded Road",
  water_logging: "Water Logging",
  fog: "Fog / Low Visibility",
  landslide: "Landslide",
  bridge_closed: "Bridge Closed",
  obstruction: "Fallen Tree / Obstruction",
  police_checkpoint: "Police Checkpoint",
  protest: "Protest / Gathering",
  dangerous_area: "Dangerous Area",
  transport_disruption: "Transport Disruption",
  no_parking: "Parking Unavailable",
  other: "Other Hazard",
};

export const SEVERITY_META: Record<AlertSeverity, { label: string; chip: string; dot: string }> = {
  low: { label: "Low", chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", dot: "bg-emerald-400" },
  medium: { label: "Medium", chip: "border-amber-400/30 bg-amber-400/10 text-amber-300", dot: "bg-amber-400" },
  high: { label: "High", chip: "border-orange-400/30 bg-orange-400/10 text-orange-300", dot: "bg-orange-400" },
  critical: { label: "Critical", chip: "border-red-400/30 bg-red-400/10 text-red-300", dot: "bg-red-400" },
};

// Human-facing label for the data source (never claim simulated data is live).
export const SOURCE_LABELS: Record<AlertSource, string> = {
  api: "Live API",
  admin: "Admin",
  community: "Community",
  cached: "Cached",
  demo: "Demo",
};

// Badge styling per source — Demo is a neutral gray so it never looks like a live provider.
export const SOURCE_BADGE: Record<AlertSource, string> = {
  api: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  community: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  admin: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  cached: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  demo: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

export type SourcesMeta = {
  api: { status: "connected" | "not-queried" | "error" | "not-configured"; count: number };
  community: { count: number };
  admin: { count: number };
  cached: { count: number };
  demo: { enabled: boolean; count: number };
};

export const EMPTY_SOURCES_META: SourcesMeta = {
  api: { status: "not-queried", count: 0 },
  community: { count: 0 },
  admin: { count: 0 },
  cached: { count: 0 },
  demo: { enabled: false, count: 0 },
};
