import type { Coordinates } from "../types/navigation";

/**
 * OSRM routing over the OpenStreetMap road network.
 *
 * Used when TomTom's road graph is too sparse to start a route where the user
 * actually is. Measured in Karachi, routing from North Nazimabad
 * (24.9425, 67.0477):
 *
 *   TomTom  ->  start snapped 2,300 m away, into Nusrat Bhutto Colony
 *   OSRM    ->  start snapped 2 m away, onto Shahrah-e-Jahangir
 *
 * That 2.3 km snap is what made routes appear to begin in Naya Nazimabad for a
 * user in North Nazimabad. TomTom stays primary — it carries live traffic, and
 * its network is better across most of the world — but a route that begins in
 * the wrong neighbourhood is wrong regardless of how good its ETA is.
 *
 * NOTE: router.project-osrm.org is a public demo instance intended for light
 * use, not production traffic. A real deployment should self-host OSRM or move
 * to a paid provider.
 */

const OSRM_BASE = "https://router.project-osrm.org/route/v1";

/** Metres between two coordinates (haversine). */
export const distanceMeters = (a: Coordinates, b: Coordinates): number => {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

const PROFILE: Record<string, string> = {
  car: "driving",
  pedestrian: "foot",
  bicycle: "bike",
};

export type OsrmRoute = {
  id: string;
  summary: {
    lengthMeters: number;
    travelTimeSeconds: number;
    trafficDelaySeconds: number;
  };
  coordinates: Array<[number, number]>;
  instructions: Array<{
    id: string;
    message: string;
    routeOffsetMeters: number;
    travelTimeSeconds: number;
    point: Coordinates;
  }>;
};

type OsrmStep = {
  distance: number;
  duration: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string; location?: [number, number] };
};

/** Turn an OSRM maneuver into a readable instruction. */
const describe = (step: OsrmStep): string => {
  const type = step.maneuver?.type || "continue";
  const modifier = step.maneuver?.modifier;
  const road = step.name?.trim();
  const onto = road ? ` onto ${road}` : "";

  switch (type) {
    case "depart":
      return road ? `Head out on ${road}` : "Start your journey";
    case "arrive":
      return "You have arrived at your destination";
    case "roundabout":
    case "rotary":
      return `At the roundabout, take the exit${onto}`;
    case "merge":
      return `Merge${onto}`;
    case "fork":
      return `Keep ${modifier || "ahead"}${onto}`;
    case "on ramp":
      return `Take the ramp${onto}`;
    case "off ramp":
      return `Take the exit${onto}`;
    default:
      return modifier ? `Turn ${modifier}${onto}` : `Continue${onto}`;
  }
};

export const routeViaOsrm = async (input: {
  start: Coordinates;
  destination: Coordinates;
  travelMode?: string;
  alternatives?: number;
}): Promise<OsrmRoute[]> => {
  const profile = PROFILE[input.travelMode || "car"] || "driving";

  // OSRM takes lon,lat — the reverse of everything else in this app.
  const coords =
    `${input.start.longitude},${input.start.latitude};` +
    `${input.destination.longitude},${input.destination.latitude}`;

  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "true",
    alternatives: (input.alternatives ?? 0) > 0 ? "true" : "false",
  });

  const response = await fetch(`${OSRM_BASE}/${profile}/${coords}?${params.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`OSRM returned ${response.status}`);

  const data = await response.json();
  if (data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error(`OSRM: ${data.code || "no route"}`);
  }

  return data.routes.map((route: any, routeIndex: number) => {
    // Instruction offsets are cumulative along the route; OSRM reports each
    // step's own length, so accumulate as we go.
    let offset = 0;
    const instructions = (route.legs || []).flatMap((leg: any, legIndex: number) =>
      (leg.steps || []).map((step: OsrmStep, stepIndex: number) => {
        const point = step.maneuver?.location;
        const entry = {
          id: `instruction-osrm-${routeIndex}-${legIndex}-${stepIndex}`,
          message: describe(step),
          routeOffsetMeters: Math.round(offset),
          travelTimeSeconds: Math.round(step.duration || 0),
          point: point
            ? { latitude: point[1], longitude: point[0] }
            : { latitude: input.start.latitude, longitude: input.start.longitude },
        };
        offset += step.distance || 0;
        return entry;
      }),
    );

    return {
      id: `route-osrm-${routeIndex}-${Math.round(route.distance)}`,
      summary: {
        lengthMeters: route.distance,
        travelTimeSeconds: route.duration,
        // OSRM has no live traffic; report 0 rather than implying a delay.
        trafficDelaySeconds: 0,
      },
      coordinates: (route.geometry?.coordinates || []).map(
        (coord: [number, number]) => [coord[1], coord[0]] as [number, number],
      ),
      instructions,
    };
  });
};
