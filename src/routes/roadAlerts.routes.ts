import { Router } from "express";

export const roadAlertsRouter = Router();

roadAlertsRouter.get("/", (request, response) => {
  const latitude = Number(request.query.lat ?? 24.8607);
  const longitude = Number(request.query.lng ?? 67.0011);

  response.json({
    success: true,
    data: [
      {
        id: "alert-1",
        title: "Traffic congestion reported",
        description:
          "Traffic is moving slowly near the selected route. Allow extra travel time.",
        severity: "medium",
        type: "traffic",
        location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "alert-2",
        title: "Road condition advisory",
        description:
          "This is demo alert data until a live traffic provider is connected.",
        severity: "low",
        type: "construction",
        location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        updatedAt: new Date().toISOString(),
      },
    ],
  });
});
