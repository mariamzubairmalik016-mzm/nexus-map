import { Router } from "express";
import { z } from "zod";

import {
  calculateTomTomRoutes,
  fetchTomTomTile,
  getTomTomIncidents,
  searchTomTom,
} from "../services/tomtom.service.js";
import { searchGeoCatalog } from "../services/geoCatalog.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const navigationRouter = Router();

navigationRouter.get(
  "/search",
  asyncHandler(async (request, response) => {
    const query = z.string().min(2).parse(request.query.q);

    const lat = request.query.lat
      ? Number(request.query.lat)
      : undefined;

    const lon = request.query.lon
      ? Number(request.query.lon)
      : undefined;

    const [catalogResults, tomTomResults] =
      await Promise.allSettled([
        searchGeoCatalog(query, 8),
        searchTomTom(query, lat, lon),
      ]);

    const catalog =
      catalogResults.status === "fulfilled"
        ? catalogResults.value
        : [];

    const tomTom =
      tomTomResults.status === "fulfilled"
        ? tomTomResults.value.map((item) => ({
            ...item,
            source: "tomtom" as const,
          }))
        : [];

    const unique = new Map<
      string,
      (typeof catalog)[number] | (typeof tomTom)[number]
    >();

    for (const item of [...catalog, ...tomTom]) {
      const key = `${item.name.toLowerCase()}-${item.position.latitude.toFixed(
        4,
      )}-${item.position.longitude.toFixed(4)}`;

      if (!unique.has(key)) unique.set(key, item);
    }

    response.json({
      success: true,
      data: Array.from(unique.values()).slice(0, 12),
    });
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
