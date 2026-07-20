import { Router } from "express";
import { z } from "zod";
import { memoryStore } from "../data/memoryStore.js";
import { requireAuth } from "../middleware/auth.js";

export const reportsRouter = Router();

reportsRouter.get("/", (_request, response) => {
  response.json({ success: true, data: memoryStore.reports });
});

reportsRouter.post("/", requireAuth, (request, response) => {
  const body = z
    .object({
      title: z.string().min(4),
      description: z.string().min(10),
      location: z.string().min(3),
      category: z.string().min(2),
    })
    .parse(request.body);

  const report = {
    id: crypto.randomUUID(),
    userId: request.authUser!.id,
    ...body,
    status: "pending" as const,
    helpfulCount: 0,
    createdAt: new Date().toISOString(),
  };

  memoryStore.reports.unshift(report);
  response.status(201).json({ success: true, data: report });
});

reportsRouter.post("/:id/helpful", requireAuth, (request, response) => {
  const report = memoryStore.reports.find((item) => item.id === request.params.id);

  if (!report) {
    response.status(404).json({ success: false, message: "Report not found." });
    return;
  }

  report.helpfulCount += 1;
  response.json({ success: true, data: report });
});
