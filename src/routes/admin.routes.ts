import { Router } from "express";
import { memoryStore } from "../data/memoryStore.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/stats", (_request, response) => {
  response.json({
    success: true,
    data: {
      places: memoryStore.places.length,
      reports: memoryStore.reports.length,
      pendingReports: memoryStore.reports.filter(
        (item) => item.status === "pending",
      ).length,
      offlineJobs: memoryStore.offlineJobs.length,
      tripPlans: memoryStore.tripPlans.length,
    },
  });
});

adminRouter.patch("/reports/:id/:status", (request, response) => {
  const status = request.params.status as "approved" | "rejected";

  if (!["approved", "rejected"].includes(status)) {
    response.status(400).json({ success: false, message: "Invalid status." });
    return;
  }

  const report = memoryStore.reports.find((item) => item.id === request.params.id);

  if (!report) {
    response.status(404).json({ success: false, message: "Report not found." });
    return;
  }

  report.status = status;
  response.json({ success: true, data: report });
});
