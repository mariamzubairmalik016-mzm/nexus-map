import { Router } from "express";
import { z } from "zod";
import { memoryStore } from "../data/memoryStore.js";
import { requireAuth } from "../middleware/auth.js";

export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);

favoritesRouter.get("/", (request, response) => {
  const favorites = memoryStore.favorites.filter(
    (item) => item.userId === request.authUser!.id,
  );
  response.json({ success: true, data: favorites });
});

favoritesRouter.post("/", (request, response) => {
  const { placeId } = z.object({ placeId: z.string().min(1) }).parse(request.body);

  const existing = memoryStore.favorites.find(
    (item) =>
      item.userId === request.authUser!.id && item.placeId === placeId,
  );

  if (existing) {
    response.json({ success: true, data: existing });
    return;
  }

  const favorite = {
    id: crypto.randomUUID(),
    userId: request.authUser!.id,
    placeId,
    createdAt: new Date().toISOString(),
  };

  memoryStore.favorites.unshift(favorite);
  response.status(201).json({ success: true, data: favorite });
});

favoritesRouter.delete("/:placeId", (request, response) => {
  const index = memoryStore.favorites.findIndex(
    (item) =>
      item.userId === request.authUser!.id &&
      item.placeId === request.params.placeId,
  );

  if (index >= 0) memoryStore.favorites.splice(index, 1);
  response.status(204).send();
});
