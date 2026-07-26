import type { Coordinates } from "../types";

export type RouteResult = {
  distanceKm: number;
  durationMinutes: number;
  routeCoordinates: [number, number][];
};

type OsrmResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }>;
};

export const calculateDrivingRoute = async (
  start: Coordinates,
  destination: Coordinates,
): Promise<RouteResult> => {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Route service is unavailable.");

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) throw new Error("No route found.");

  return {
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
    routeCoordinates: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
  };
};
