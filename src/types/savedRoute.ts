import type { Coordinates, RouteInstruction } from "./navigation";

export type TravelMode = "car" | "pedestrian" | "bicycle";
export type RouteType = "fastest" | "shortest";

/**
 * A route the user saved. Everything needed to redraw it — geometry, summary
 * and instructions — is stored, so opening it offline never contacts the
 * routing provider.
 */
export type SavedRoute = {
  id: string;
  title: string;
  originName: string;
  destinationName: string;
  origin: Coordinates;
  destination: Coordinates;
  distanceMeters: number;
  durationSeconds: number;
  /** Polyline as [lat, lng] pairs, matching RouteAlternative.coordinates. */
  geometry: [number, number][];
  instructions: RouteInstruction[];
  travelMode: TravelMode;
  routeType: RouteType;
  avoidTolls: boolean;
  avoidFerries: boolean;
  offlineAvailable: boolean;
  createdAt: string;
  updatedAt: string;
};
