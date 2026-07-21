import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { apiRouter } from "./routes/index.js";
import { healthRouter } from "./routes/health.routes.js";

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

app.get("/", (_request, response) => {
  response.json({
    success: true,
    message: "Nexus Map Backend API",
    docs: "/health",
  });
});

// Health check available at both the root and the API namespace.
app.use("/health", healthRouter);
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);
