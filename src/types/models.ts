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
