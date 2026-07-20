import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";

type Note = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "pending" | "verified";
  helpfulCount: number;
  position: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
};

const notes: Note[] = [
  {
    id: "community-karachi-1",
    title: "Road repair work",
    description:
      "Uneven road surface reported. Drive carefully.",
    category: "construction",
    status: "verified",
    helpfulCount: 12,
    position: {
      latitude: 24.9008,
      longitude: 67.1681,
    },
    createdAt: new Date().toISOString(),
  },
];

const inside = (
  note: Note,
  west: number,
  south: number,
  east: number,
  north: number,
) =>
  note.position.longitude >= west &&
  note.position.longitude <= east &&
  note.position.latitude >= south &&
  note.position.latitude <= north;

export const communityNotesRouter = Router();

communityNotesRouter.get("/notes", (request, response) => {
  const bbox = String(request.query.bbox ?? "")
    .split(",")
    .map(Number);

  const [west, south, east, north] = bbox;

  const data =
    bbox.length === 4 && bbox.every(Number.isFinite)
      ? notes.filter((note) =>
          inside(note, west, south, east, north),
        )
      : notes;

  response.json({ success: true, data });
});

communityNotesRouter.post(
  "/notes",
  requireAuth,
  (request, response) => {
    const body = z
      .object({
        title: z.string().min(4),
        description: z.string().min(8),
        category: z.string().min(2),
        position: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
      })
      .parse(request.body);

    const note: Note = {
      id: crypto.randomUUID(),
      ...body,
      status: "pending",
      helpfulCount: 0,
      createdAt: new Date().toISOString(),
    };

    notes.unshift(note);
    response.status(201).json({ success: true, data: note });
  },
);
