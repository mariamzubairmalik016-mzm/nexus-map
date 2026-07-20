import { Router } from "express";
import { databaseConfigured } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.json({
    success: true,
    service: "Nexus Map Backend",
    status: "online",
    database: databaseConfigured ? "supabase" : "demo-memory",
    timestamp: new Date().toISOString(),
  });
});
