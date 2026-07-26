export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type PlaceProvider = "tomtom" | "geoapify" | "catalog" | "offline" | "gps" | "saved";

/**
 * One normalized search result. The backend emits this shape for every
 * provider; `position` mirrors `lat`/`lng` and is what the map and routing
 * layers consume.
 */
export type SearchSuggestion = {
  id: string;
  provider?: PlaceProvider;
  providerId?: string;
  name: string;
  displayName?: string;
  address: string;
  city?: string;
  province?: string;
  country?: string;
  countryCode?: string;
  category?: string;
  lat?: number;
  lng?: number;
  score?: number;
  position: Coordinates;
};

/** A place the user explicitly saved (Home / Work / University / custom). */
export type SavedPlaceCategory = "home" | "work" | "university" | "custom";

export type SavedPlace = {
  id: string;
  userId?: string;
  label: string;
  category: SavedPlaceCategory;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  notes?: string;
  favorite: boolean;
  lastVisitedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Set locally while an offline change is waiting to reach the database. */
  pendingSync?: boolean;
  deleted?: boolean;
};

/** A search the user actually selected, kept for offline reuse. */
export type RecentSearch = {
  id: string;
  query: string;
  name: string;
  displayName: string;
  address?: string;
  latitude: number;
  longitude: number;
  provider?: PlaceProvider;
  searchedAt: string;
};

export type RouteInstruction = {
  id: string;
  message: string;
  routeOffsetMeters: number;
  travelTimeSeconds: number;
  point: Coordinates;
};

export type RouteAlternative = {
  id: string;
  summary: {
    lengthMeters: number;
    travelTimeSeconds: number;
    trafficDelaySeconds: number;
    departureTime?: string;
    arrivalTime?: string;
  };
  coordinates: [number, number][];
  instructions: RouteInstruction[];
};

export type TrafficIncident = {
  id: string;
  title: string;
  description: string;
  severity: number;
  category: string;
  position?: Coordinates;
  geometry?: [number, number][];
};

export type CommunityNote = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "pending" | "verified";
  helpfulCount: number;
  position: Coordinates;
  createdAt: string;
};
