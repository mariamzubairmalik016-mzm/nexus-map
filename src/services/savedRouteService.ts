import { offlineDb } from "./offlineDb";
import type { RouteAlternative } from "../types/navigation";
import type { RouteType, SavedRoute, TravelMode } from "../types/savedRoute";

/**
 * Saved routes live entirely in IndexedDB: geometry, summary and instructions
 * are all stored, so reopening one offline never contacts a routing provider.
 */

export const savedRouteService = {
  list: async (): Promise<SavedRoute[]> => {
    const routes = await offlineDb.getSavedRoutes().catch(() => [] as SavedRoute[]);
    return routes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  get: async (id: string): Promise<SavedRoute | null> => {
    const routes = await offlineDb.getSavedRoutes().catch(() => [] as SavedRoute[]);
    return routes.find((route) => route.id === id) ?? null;
  },

  save: async (input: {
    title: string;
    route: RouteAlternative;
    originName: string;
    destinationName: string;
    travelMode: TravelMode;
    routeType: RouteType;
    avoidTolls: boolean;
    avoidFerries: boolean;
  }): Promise<SavedRoute> => {
    const { route } = input;
    const now = new Date().toISOString();

    const first = route.coordinates[0];
    const last = route.coordinates[route.coordinates.length - 1];

    const saved: SavedRoute = {
      id: crypto.randomUUID(),
      title: input.title.trim() || `${input.originName} → ${input.destinationName}`,
      originName: input.originName,
      destinationName: input.destinationName,
      origin: { latitude: first[0], longitude: first[1] },
      destination: { latitude: last[0], longitude: last[1] },
      distanceMeters: route.summary.lengthMeters,
      durationSeconds: route.summary.travelTimeSeconds,
      geometry: route.coordinates,
      instructions: route.instructions,
      travelMode: input.travelMode,
      routeType: input.routeType,
      avoidTolls: input.avoidTolls,
      avoidFerries: input.avoidFerries,
      // Geometry + instructions are stored locally, so it opens with no network.
      offlineAvailable: true,
      createdAt: now,
      updatedAt: now,
    };

    await offlineDb.saveRoute(saved);
    return saved;
  },

  rename: async (id: string, title: string): Promise<SavedRoute | null> => {
    const existing = await savedRouteService.get(id);
    if (!existing) return null;
    const updated = { ...existing, title: title.trim() || existing.title, updatedAt: new Date().toISOString() };
    await offlineDb.saveRoute(updated);
    return updated;
  },

  remove: (id: string) => offlineDb.deleteRoute(id),
};

/** Turns a saved route back into the shape the map and route list consume. */
export const savedRouteToAlternative = (saved: SavedRoute): RouteAlternative => ({
  id: `saved-${saved.id}`,
  summary: {
    lengthMeters: saved.distanceMeters,
    travelTimeSeconds: saved.durationSeconds,
    trafficDelaySeconds: 0,
  },
  coordinates: saved.geometry,
  instructions: saved.instructions,
});
