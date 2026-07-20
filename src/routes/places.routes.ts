import { Router } from "express";
import { z } from "zod";
import { memoryStore } from "../data/memoryStore.js";

export const placesRouter = Router();

placesRouter.get("/", (request, response) => {
  const query = String(request.query.q ?? "").trim().toLowerCase();
  const category = String(request.query.category ?? "").trim().toLowerCase();

  const places = memoryStore.places.filter((place) => {
    const matchesQuery =
      !query ||
      `${place.name} ${place.city} ${place.country}`
        .toLowerCase()
        .includes(query);
    const matchesCategory =
      !category || place.category.toLowerCase() === category;

    return matchesQuery && matchesCategory;
  });

  response.json({ success: true, data: places });
});

placesRouter.get("/:id", (request, response) => {
  const place = memoryStore.places.find((item) => item.id === request.params.id);

  if (!place) {
    response.status(404).json({ success: false, message: "Place not found." });
    return;
  }

  response.json({ success: true, data: place });
});

placesRouter.post("/", (request, response) => {
  const body = z
    .object({
      name: z.string().min(2),
      country: z.string().min(2),
      city: z.string().min(2),
      category: z.string().min(2),
      description: z.string().min(5),
      latitude: z.number(),
      longitude: z.number(),
      imageUrl: z.string().url().optional(),
      rating: z.number().min(0).max(5).default(0),
    })
    .parse(request.body);

  const place = {
    id: crypto.randomUUID(),
    ...body,
    isVerified: false,
    createdAt: new Date().toISOString(),
  };

  memoryStore.places.unshift(place);
  response.status(201).json({ success: true, data: place });
});
