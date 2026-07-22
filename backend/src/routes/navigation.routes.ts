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
import type { NormalizedPlace } from "../types/place.js";
import { isInPakistan, rankPlaces, resultsAreWeak } from "../services/placeRanking.js";

export const navigationRouter = Router();

/** A place name the user never means literally — it must not reach a provider. */
const NON_SEARCHABLE = new Set(["current location", "my location", "your location"]);

navigationRouter.get(
  "/search",
  asyncHandler(async (request, response) => {
    const query = z.string().min(2).parse(request.query.q);
    const lat = request.query.lat ? Number(request.query.lat) : undefined;
    const lon = request.query.lon ? Number(request.query.lon) : undefined;

    // "Current Location" is a UI label, not a place. Never send it upstream.
    if (NON_SEARCHABLE.has(query.trim().toLowerCase())) {
      response.json({ success: true, data: [] });
      return;
    }

    const bias = {
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
    };
    const biasInPakistan = isInPakistan(bias.lat, bias.lon);

    const never = <T>(promise: Promise<T[]>) => promise.catch(() => [] as T[]);
    const empty = Promise.resolve([] as NormalizedPlace[]);

    // TomTom is the PRIMARY provider and always runs worldwide. Inside Pakistan
    // we add a countrySet=PK TomTom pass plus a Geoapify PK pass, because
    // Geoapify's OSM data covers local malls/institutes TomTom lacks.
    const [catalog, worldwide, pkTomTom, pkGeoapify] = await Promise.all([
      never(searchGeoCatalog(query, 8)),
      never(searchTomTom(query, bias.lat, bias.lon)),
      biasInPakistan ? never(searchTomTom(query, bias.lat, bias.lon, "PK")) : empty,
      biasInPakistan ? never(searchGeoapify(query, bias.lat, bias.lon, "pk")) : empty,
    ]);

    let all: NormalizedPlace[] = [...catalog, ...worldwide, ...pkTomTom, ...pkGeoapify];

    // Worldwide fallback: if nothing so far actually matches what was typed
    // (no results, or only weak/foreign partial matches), ask Geoapify without
    // a country filter. This is the "TomTom gave no/poor results" branch and
    // costs an extra call only when the first pass was unsatisfying.
    if (resultsAreWeak(all, { query, ...bias })) {
      const fallback = await never(searchGeoapify(query, bias.lat, bias.lon));
      all = [...all, ...fallback];
    }

    const ranked = rankPlaces(all, { query, ...bias }, 12);

    response.json({ success: true, data: ranked });
  }),
);

/** Coordinates only — a finite, in-range lat/lng pair. Nothing else routes. */
const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

navigationRouter.post(
  "/routes",
  asyncHandler(async (request, response) => {
    const body = z
      .object({
        start: coordinateSchema,
        destination: coordinateSchema,
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
        routeType: z.enum(["fastest", "shortest", "eco", "thrilling"]).default("fastest"),
        avoidTolls: z.boolean().default(false),
        avoidFerries: z.boolean().default(false),
        alternatives: z
          .number()
          .int()
          .min(0)
          .max(5)
          .default(2),
      })
      .superRefine((value, context) => {
        // Routing identical points wastes a provider call and returns nothing
        // useful — reject it here with a message the UI can show verbatim.
        if (
          value.start.latitude === value.destination.latitude &&
          value.start.longitude === value.destination.longitude
        ) {
          context.addIssue({
            code: "custom",
            message: "Start and destination are the same place.",
            path: ["destination"],
          });
        }
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
