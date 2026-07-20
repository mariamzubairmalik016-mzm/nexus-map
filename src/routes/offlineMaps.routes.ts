import { Router } from "express";
import { z } from "zod";
import { memoryStore } from "../data/memoryStore.js";
import { requireAuth } from "../middleware/auth.js";

export const offlineMapsRouter = Router();
offlineMapsRouter.use(requireAuth);

offlineMapsRouter.get("/", (request, response) => {
  response.json({
    success: true,
    data: memoryStore.offlineJobs.filter(
      (item) => item.userId === request.authUser!.id,
    ),
  });
});

offlineMapsRouter.post("/", (request, response) => {
  const body = z
    .object({
      location: z.string().min(2),
      scope: z.enum(["city", "district", "province", "country"]),
    })
    .parse(request.body);

  const sizeByScope = {
    city: 140,
    district: 260,
    province: 480,
    country: 950,
  };

  const job = {
    id: crypto.randomUUID(),
    userId: request.authUser!.id,
    ...body,
    status: "queued" as const,
    progress: 0,
    estimatedSizeMb: sizeByScope[body.scope],
    createdAt: new Date().toISOString(),
  };

  memoryStore.offlineJobs.unshift(job);

  setTimeout(() => {
    job.status = "processing";
    job.progress = 45;
  }, 500);

  setTimeout(() => {
    job.status = "ready";
    job.progress = 100;
  }, 1500);

  response.status(202).json({ success: true, data: job });
});

offlineMapsRouter.delete("/:id", (request, response) => {
  const index = memoryStore.offlineJobs.findIndex(
    (item) =>
      item.id === request.params.id &&
      item.userId === request.authUser!.id,
  );

  if (index >= 0) memoryStore.offlineJobs.splice(index, 1);
  response.status(204).send();
});
