import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { aiConfigured, chatComplete, checkRateLimit } from "../services/ai.service.js";

export const aiRouter = Router();

// Real AI chatbot — authenticated, rate-limited, key stays on the server.
aiRouter.post(
  "/chat",
  requireAuth,
  asyncHandler(async (request, response) => {
    const { message, history } = z
      .object({
        message: z.string().trim().min(1).max(1000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(2000),
            }),
          )
          .max(10)
          .optional(),
      })
      .parse(request.body);

    if (!aiConfigured) {
      throw new HttpError(503, "The AI assistant is not configured yet.");
    }

    if (!checkRateLimit(`chat:${request.authUser!.id}`)) {
      throw new HttpError(429, "Too many requests — please wait a moment.");
    }

    const messages = [
      {
        role: "system" as const,
        content:
          "You are Nexus AI, a concise, friendly travel and navigation assistant for the Nexus Map app. " +
          "Help with destinations, routes, hotels, food, safety and offline maps. Keep answers short and practical.",
      },
      ...(history ?? []),
      { role: "user" as const, content: message },
    ];

    // Prompt contents are intentionally not logged.
    const reply = await chatComplete(messages, { maxTokens: 500, temperature: 0.6 });
    response.json({ success: true, data: { reply } });
  }),
);
