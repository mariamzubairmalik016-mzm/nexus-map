import type {
  CommunityNote,
  Coordinates,
  RouteAlternative,
  SearchSuggestion,
  TrafficIncident,
} from "../types/navigation";
import { assertOnline } from "./networkStatus";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

type ApiResult<T> = {
  success: boolean;
  data: T;
  message?: string;
};

const request = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  // Navigation depends on the live TomTom proxy — never call it offline.
  assertOnline();
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-demo-user-id": "demo-user",
      "x-demo-user-email": "mariam@example.com",
      "x-demo-user-role": "user",
      ...options.headers,
    },
  });

  const result = (await response.json()) as ApiResult<T>;

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Navigation request failed.");
  }

  return result.data;
};

export const navigationApi = {
  search: (
    query: string,
    bias?: Coordinates | null,
  ): Promise<SearchSuggestion[]> => {
    const params = new URLSearchParams({ q: query });

    if (bias) {
      params.set("lat", String(bias.latitude));
      params.set("lon", String(bias.longitude));
    }

    return request(`/navigation/search?${params.toString()}`);
  },

  routes: (
    start: Coordinates,
    destination: Coordinates,
    options: {
      travelMode: string;
      avoidTolls: boolean;
      alternatives: number;
    },
  ): Promise<RouteAlternative[]> =>
    request("/navigation/routes", {
      method: "POST",
      body: JSON.stringify({ start, destination, ...options }),
    }),

  trafficIncidents: (
    west: number,
    south: number,
    east: number,
    north: number,
  ): Promise<TrafficIncident[]> =>
    request(
      `/navigation/traffic-incidents?bbox=${west},${south},${east},${north}`,
    ),

  communityNotes: (
    west: number,
    south: number,
    east: number,
    north: number,
  ): Promise<CommunityNote[]> =>
    request(
      `/community/notes?bbox=${west},${south},${east},${north}`,
    ),

  createCommunityNote: (
    note: Omit<CommunityNote, "id" | "status" | "helpfulCount" | "createdAt">,
  ): Promise<CommunityNote> =>
    request("/community/notes", {
      method: "POST",
      body: JSON.stringify(note),
    }),
};
