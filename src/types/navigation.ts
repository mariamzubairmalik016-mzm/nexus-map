export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type SearchSuggestion = {
  id: string;
  name: string;
  address: string;
  city?: string;
  country?: string;
  category?: string;
  position: Coordinates;
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
