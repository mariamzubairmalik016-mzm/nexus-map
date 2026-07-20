import { Router } from "express";
import { z } from "zod";
import { memoryStore } from "../data/memoryStore.js";
import { requireAuth } from "../middleware/auth.js";

export const historyRouter = Router();
historyRouter.use(requireAuth);

historyRouter.get("/", (request, response) => {
  response.json({
    success: true,
    data: memoryStore.history.filter(
      (item) => item.userId === request.authUser!.id,
    ),
  });
});

historyRouter.post("/", (request, response) => {
  const body = z
    .object({
      startName: z.string().min(2),
      destinationName: z.string().min(2),
      distanceKm: z.number().nonnegative(),
      durationMinutes: z.number().nonnegative(),
    })
    .parse(request.body);

  const record = {
    id: crypto.randomUUID(),
    userId: request.authUser!.id,
    ...body,
    createdAt: new Date().toISOString(),
  };

  memoryStore.history.unshift(record);
  response.status(201).json({ success: true, data: record });
});

historyRouter.delete("/:id", (request, response) => {
  const index = memoryStore.history.findIndex(
    (item) =>
      item.id === request.params.id &&
      item.userId === request.authUser!.id,
  );

  if (index >= 0) memoryStore.history.splice(index, 1);
  response.status(204).send();
});
