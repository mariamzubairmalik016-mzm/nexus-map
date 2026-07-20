import { Router } from "express";
import { memoryStore } from "../data/memoryStore.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", (request, response) => {
  response.json({
    success: true,
    data: memoryStore.notifications.filter(
      (item) => item.userId === request.authUser!.id,
    ),
  });
});

notificationsRouter.patch("/:id/read", (request, response) => {
  const item = memoryStore.notifications.find(
    (notification) =>
      notification.id === request.params.id &&
      notification.userId === request.authUser!.id,
  );

  if (!item) {
    response.status(404).json({ success: false, message: "Notification not found." });
    return;
  }

  item.isRead = true;
  response.json({ success: true, data: item });
});

notificationsRouter.patch("/read-all", (request, response) => {
  for (const item of memoryStore.notifications) {
    if (item.userId === request.authUser!.id) item.isRead = true;
  }
  response.json({ success: true });
});
