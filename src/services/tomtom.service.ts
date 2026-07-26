import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

const TOMTOM_BASE = "https://api.tomtom.com";

const fetchTomTom = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new HttpError(
      response.status,
      `TomTom request failed: ${text.slice(0, 250)}`,
    );
  }

  return (await response.json()) as T;
};

export const searchTomTom = async (
  query: string,
  lat?: number,
  lon?: number,
) => {
  const params = new URLSearchParams({
    key: env.TOMTOM_API_KEY,
    limit: "8",
    language: "en-GB",
    idxSet:
      "POI,Addr,Str,XStr,Geo,PAD",
    minFuzzyLevel: "1",
    maxFuzzyLevel: "4",
  });

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    params.set("lat", String(lat));
    params.set("lon", String(lon));
    params.set("radius", "100000");
  }

  const url =
    `${TOMTOM_BASE}/search/2/search/` +
    `${encodeURIComponent(query)}.json?${params.toString()}`;

  type SearchResponse = {
    results: Array<{
      id: string;
      type: string;
      score: number;
      position: { lat: number; lon: number };
      address: {
        freeformAddress?: string;
        municipality?: string;
        country?: string;
      };
      poi?: {
        name?: string;
        categories?: string[];
      };
    }>;
  };

  const data = await fetchTomTom<SearchResponse>(url);

  return data.results.map((result) => ({
    id: result.id,
    name:
      result.poi?.name ||
      result.address.freeformAddress ||
      "Unknown place",
    address:
      result.address.freeformAddress ||
      [
        result.address.municipality,
        result.address.country,
      ]
        .filter(Boolean)
        .join(", "),
    city: result.address.municipality,
    country: result.address.country,
    category: result.poi?.categories?.[0] || result.type,
    position: {
      latitude: result.position.lat,
      longitude: result.position.lon,
    },
  }));
};

export const calculateTomTomRoutes = async (input: {
  start: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  travelMode: string;
  avoidTolls: boolean;
  alternatives: number;
}) => {
  const routePoints =
    `${input.start.latitude},${input.start.longitude}:` +
    `${input.destination.latitude},${input.destination.longitude}`;

  const params = new URLSearchParams({
    key: env.TOMTOM_API_KEY,
    traffic: "true",
    travelMode: input.travelMode,
    routeType: "fastest",
    instructionsType: "text",
    language: "en-GB",
    computeTravelTimeFor: "all",
    routeRepresentation: "polyline",
    maxAlternatives: String(
      Math.max(0, Math.min(input.alternatives, 5)),
    ),
  });

  if (input.avoidTolls) {
    params.set("avoid", "tollRoads");
  }

  const url =
    `${TOMTOM_BASE}/routing/1/calculateRoute/` +
    `${routePoints}/json?${params.toString()}`;

  type RouteResponse = {
    routes: Array<{
      summary: {
        lengthInMeters: number;
        travelTimeInSeconds: number;
        trafficDelayInSeconds: number;
        departureTime?: string;
        arrivalTime?: string;
      };
      legs: Array<{
        points: Array<{
          latitude: number;
          longitude: number;
        }>;
      }>;
      guidance?: {
        instructions: Array<{
          routeOffsetInMeters: number;
          travelTimeInSeconds: number;
          message: string;
          point: {
            latitude: number;
            longitude: number;
          };
        }>;
      };
    }>;
  };

  try {
    const data = await fetchTomTom<RouteResponse>(url);

    return data.routes.map((route, routeIndex) => ({
      id: `route-${routeIndex}-${route.summary.lengthInMeters}`,
      summary: {
        lengthMeters: route.summary.lengthInMeters,
        travelTimeSeconds: route.summary.travelTimeInSeconds,
        trafficDelaySeconds: route.summary.trafficDelayInSeconds,
        departureTime: route.summary.departureTime,
        arrivalTime: route.summary.arrivalTime,
      },
      coordinates: route.legs.flatMap((leg) =>
        leg.points.map(
          (point) =>
            [point.latitude, point.longitude] as [number, number],
        ),
      ),
      instructions:
        route.guidance?.instructions.map((instruction, index) => ({
          id: `instruction-${routeIndex}-${index}`,
          message: instruction.message,
          routeOffsetMeters: instruction.routeOffsetInMeters,
          travelTimeSeconds: instruction.travelTimeInSeconds,
          point: {
            latitude: instruction.point.latitude,
            longitude: instruction.point.longitude,
          },
        })) ?? [],
    }));
  } catch (error) {
    if ((process.env.NODE_ENV === 'development')) {
      console.warn("TomTom routing failed, falling back to OSRM...", error);
    }
    
    // OSRM expects lon,lat;lon,lat
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${input.start.longitude},${input.start.latitude};${input.destination.longitude},${input.destination.latitude}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(osrmUrl);
    if (!osrmRes.ok) throw error; // throw original TomTom error if fallback fails
    
    const osrmData = await osrmRes.json();
    if (osrmData.code !== 'Ok' || !osrmData.routes?.length) throw error;

    return osrmData.routes.map((route: any, routeIndex: number) => ({
      id: `route-osrm-${routeIndex}-${route.distance}`,
      summary: {
        lengthMeters: route.distance,
        travelTimeSeconds: route.duration,
        trafficDelaySeconds: 0,
      },
      coordinates: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]), // OSRM is [lon, lat], we need [lat, lon]
      instructions: []
    }));
  }
};

export const getTomTomIncidents = async (
  bbox: string,
) => {
  const params = new URLSearchParams({
    key: env.TOMTOM_API_KEY,
    bbox,
    fields:
      "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},from,to,length,delay,roadNumbers,timeValidity}}}",
    language: "en-GB",
    timeValidityFilter: "present",
  });

  const url =
    `${TOMTOM_BASE}/traffic/services/5/incidentDetails?` +
    params.toString();

  type IncidentResponse = {
    incidents?: Array<{
      type: string;
      geometry?: {
        type: string;
        coordinates: number[] | number[][];
      };
      properties: {
        id: string;
        iconCategory: number;
        magnitudeOfDelay?: number;
        events?: Array<{ description: string; code: number }>;
        from?: string;
        to?: string;
      };
    }>;
  };

  const data = await fetchTomTom<IncidentResponse>(url);

  return (data.incidents ?? []).map((incident) => {
    const coordinates = incident.geometry?.coordinates;
    const first =
      Array.isArray(coordinates?.[0])
        ? (coordinates as number[][])[0]
        : (coordinates as number[] | undefined);

    return {
      id: incident.properties.id,
      title:
        incident.properties.events?.[0]?.description ||
        "Traffic incident",
      description: [
        incident.properties.from,
        incident.properties.to,
      ]
        .filter(Boolean)
        .join(" → "),
      severity: incident.properties.magnitudeOfDelay ?? 0,
      category: String(incident.properties.iconCategory),
      position:
        first && first.length >= 2
          ? {
              latitude: first[1],
              longitude: first[0],
            }
          : undefined,
    };
  });
};

export const searchCategoryTomTom = async (
  categorySet: string,
  lat: number,
  lon: number,
  radius = 50000,
  limit = 20,
) => {
  const params = new URLSearchParams({
    key: env.TOMTOM_API_KEY,
    categorySet,
    lat: String(lat),
    lon: String(lon),
    radius: String(radius),
    limit: String(limit),
    language: "en-GB",
  });

  const url = `${TOMTOM_BASE}/search/2/categorySearch/.json?${params.toString()}`;

  type CategorySearchResponse = {
    results: Array<{
      id: string;
      poi: { name: string; categories?: string[]; phone?: string; url?: string };
      position: { lat: number; lon: number };
      address: { freeformAddress: string; municipality?: string; country?: string };
      dist: number;
    }>;
  };

  const data = await fetchTomTom<CategorySearchResponse>(url);

  return data.results.map((result) => ({
    id: result.id,
    name: result.poi?.name || "Unknown place",
    address: result.address?.freeformAddress || [result.address?.municipality, result.address?.country].filter(Boolean).join(", "),
    city: result.address?.municipality,
    country: result.address?.country,
    position: { latitude: result.position.lat, longitude: result.position.lon },
    distance: result.dist,
    category: result.poi?.categories?.[0],
    phone: result.poi?.phone,
    website: result.poi?.url,
  }));
};

export const fetchTomTomTile = async (
  kind: "map" | "traffic",
  z: string,
  x: string,
  y: string,
) => {
  const url =
    kind === "map"
      ? `${TOMTOM_BASE}/map/1/tile/basic/main/${z}/${x}/${y}.png?key=${env.TOMTOM_API_KEY}&tileSize=256`
      : `${TOMTOM_BASE}/traffic/map/4/tile/flow/relative0/${z}/${x}/${y}.png?key=${env.TOMTOM_API_KEY}&tileSize=256`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new HttpError(response.status, "Map tile request failed.");
  }

  return {
    contentType:
      response.headers.get("content-type") || "image/png",
    cacheControl:
      response.headers.get("cache-control") ||
      "public, max-age=60",
    bytes: Buffer.from(await response.arrayBuffer()),
  };
};
