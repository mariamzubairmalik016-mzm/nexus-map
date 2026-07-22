import { Router } from "express";
import { z } from "zod";

import {
  calculateTomTomRoutes,
  fetchTomTomTile,
  getTomTomIncidents,
  searchTomTom,
} from "../services/tomtom.service.js";
import { searchGeoCatalog } from "../services/geoCatalog.service.js";
import { searchGeoapify } from "../services/geoapify.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const navigationRouter = Router();

type SearchItem = {
  id: string;
  name: string;
  address: string;
  city?: string;
  province?: string;
  country?: string;
  countryCode?: string;
  category?: string;
  position: { latitude: number; longitude: number };
  source?: string;
  score?: number;
};

const PK_BBOX = { minLat: 23, maxLat: 37, minLon: 60, maxLon: 78 };

navigationRouter.get(
  "/search",
  asyncHandler(async (request, response) => {
    const query = z.string().min(2).parse(request.query.q);
    const lat = request.query.lat ? Number(request.query.lat) : undefined;
    const lon = request.query.lon ? Number(request.query.lon) : undefined;

    // Pakistan-priority mode: when the search is biased inside Pakistan, run an
    // extra countrySet=PK pass and boost Pakistan results in ranking. Global
    // searches (Dubai, London…) still win via raw provider score.
    const inPakistan =
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      (lat as number) >= PK_BBOX.minLat &&
      (lat as number) <= PK_BBOX.maxLat &&
      (lon as number) >= PK_BBOX.minLon &&
      (lon as number) <= PK_BBOX.maxLon;

    // TomTom stays the primary/worldwide provider. Inside Pakistan we add a
    // TomTom PK pass AND a Geoapify PK pass (Geoapify has far better OSM POI
    // coverage for local malls/institutes TomTom lacks). Each is best-effort.
    const empty = Promise.resolve([] as SearchItem[]);
    const [catalog, worldwide, pkTomTom, pkGeoapify] = await Promise.all([
      (searchGeoCatalog(query, 8) as Promise<SearchItem[]>).catch(() => [] as SearchItem[]),
      (searchTomTom(query, lat, lon) as Promise<SearchItem[]>).catch(() => [] as SearchItem[]),
      inPakistan ? (searchTomTom(query, lat, lon, "PK") as Promise<SearchItem[]>).catch(() => [] as SearchItem[]) : empty,
      inPakistan ? (searchGeoapify(query, lat, lon, "pk") as Promise<SearchItem[]>).catch(() => [] as SearchItem[]) : empty,
    ]);

    const all: SearchItem[] = [
      // All scores are on a ~0..1 relevance scale.
      ...catalog.map((c) => ({ ...c, source: "supabase", score: c.score ?? 0.7 })),
      ...worldwide.map((t) => ({ ...t, source: "tomtom" })),
      ...pkTomTom.map((t) => ({ ...t, source: "tomtom" })),
      ...pkGeoapify, // already tagged source: "geoapify" and scored
    ];

    // De-duplicate, keeping the higher-scoring copy.
    const unique = new Map<string, SearchItem>();
    for (const item of all) {
      const key = `${item.name.toLowerCase()}-${item.position.latitude.toFixed(3)}-${item.position.longitude.toFixed(3)}`;
      const existing = unique.get(key);
      if (!existing || (item.score ?? 0) > (existing.score ?? 0)) unique.set(key, item);
    }

    // TomTom is the PRIMARY provider. Supplementary providers (Geoapify /
    // catalog) may only OUTRANK TomTom when TomTom itself is weak — i.e. its
    // best match is low-relevance (the niche-PK-POI case). When TomTom has a
    // decent match (a real city/place), it leads and Geoapify is capped just
    // below it. This keeps global search correct (Tokyo, Sydney, London) while
    // still surfacing Pakistani POIs TomTom lacks (Lucky One Mall, Dolmen Mall).
    const tomtomBest = all.reduce((m, r) => (r.source === "tomtom" ? Math.max(m, r.score ?? 0) : m), 0);
    const geoapifyMayLead = tomtomBest < 0.5;
    const effective = (r: SearchItem) => {
      const s = r.score ?? 0;
      if (r.source === "tomtom") return s * 1.1;
      return geoapifyMayLead ? s : Math.min(s, tomtomBest * 0.95);
    };
    const ranked = [...unique.values()].sort((a, b) => effective(b) - effective(a)).slice(0, 12);

    response.json({ success: true, data: ranked });
  }),
);

navigationRouter.post(
  "/routes",
  asyncHandler(async (request, response) => {
    const body = z
      .object({
        start: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        destination: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        travelMode: z
          .enum([
            "car",
            "truck",
            "taxi",
            "bus",
            "van",
            "motorcycle",
            "bicycle",
            "pedestrian",
          ])
          .default("car"),
        avoidTolls: z.boolean().default(false),
        alternatives: z
          .number()
          .int()
          .min(0)
          .max(5)
          .default(2),
      })
      .parse(request.body);

    const data = await calculateTomTomRoutes(body);
    response.json({ success: true, data });
  }),
);

navigationRouter.get(
  "/traffic-incidents",
  asyncHandler(async (request, response) => {
    const bbox = z
      .string()
      .regex(
        /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
      )
      .parse(request.query.bbox);

    const data = await getTomTomIncidents(bbox);
    response.json({ success: true, data });
  }),
);

navigationRouter.get(
  "/map-tile/:z/:x/:y",
  asyncHandler(async (request, response) => {
    const tile = await fetchTomTomTile(
      "map",
      String(request.params.z),
      String(request.params.x),
      String(request.params.y),
    );

    response.setHeader("Content-Type", tile.contentType);
    response.setHeader("Cache-Control", tile.cacheControl);
    response.send(tile.bytes);
  }),
);

navigationRouter.get(
  "/traffic-tile/:z/:x/:y",
  asyncHandler(async (request, response) => {
    const tile = await fetchTomTomTile(
      "traffic",
      String(request.params.z),
      String(request.params.x),
      String(request.params.y),
    );

    response.setHeader("Content-Type", tile.contentType);
    response.setHeader("Cache-Control", "public, max-age=30");
    response.send(tile.bytes);
  }),
);
