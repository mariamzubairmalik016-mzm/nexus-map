export type Place = {
  id: string;
  name: string;
  country: string;
  city: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  rating: number;
  isVerified: boolean;
  createdAt: string;
};

export type CommunityReport = {
  id: string;
  userId: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  helpfulCount: number;
  createdAt: string;
};

export type Favorite = {
  id: string;
  userId: string;
  placeId: string;
  createdAt: string;
};

export type RouteHistory = {
  id: string;
  userId: string;
  startName: string;
  destinationName: string;
  distanceKm: number;
  durationMinutes: number;
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "warning" | "security" | "location";
  isRead: boolean;
  createdAt: string;
};

export type OfflineMapJob = {
  id: string;
  userId: string;
  location: string;
  scope: "city" | "district" | "province" | "country";
  status: "queued" | "processing" | "ready" | "failed";
  progress: number;
  estimatedSizeMb: number;
  createdAt: string;
};

export type TripPlan = {
  id: string;
  userId: string;
  destination: string;
  days: number;
  budget: number;
  tripType: string;
  transport: string;
  itinerary: Array<{
    day: number;
    title: string;
    activities: string[];
  }>;
  createdAt: string;
};

export const ROAD_ALERT_TYPES = [
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

export type RoadAlertType = (typeof ROAD_ALERT_TYPES)[number];
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

export type AuditEntry = {
  id: string;
  adminId?: string;
  action: string;
  entity: string;
  entityId?: string;
  notes?: string;
  createdAt: string;
};
