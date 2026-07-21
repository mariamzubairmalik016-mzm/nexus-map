import { z } from "zod";

import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = env.OPENAI_MODEL || "gpt-4o-mini";

export const aiConfigured = Boolean(env.OPENAI_API_KEY);

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Call the OpenAI Chat Completions API from the server only.
 * The API key never leaves the backend and is never included in responses.
 * Prompt contents are never logged.
 */
export const chatComplete = async (
  messages: ChatMessage[],
  options: { json?: boolean; maxTokens?: number; temperature?: number } = {},
): Promise<string> => {
  if (!env.OPENAI_API_KEY) {
    throw new HttpError(503, "AI is not configured on the server.");
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1200,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch {
    throw new HttpError(502, "The AI service is temporarily unavailable.");
  }

  if (!response.ok) {
    // Log only the status — never the provider body (may echo the request) or key.
    console.error(`[nexus] AI request failed with status ${response.status}`);
    throw new HttpError(502, "The AI service is temporarily unavailable.");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, "The AI service returned an empty response.");
  return content;
};

// --- Simple per-key sliding-window rate limiter (in-memory) ---
const hits = new Map<string, number[]>();
export const checkRateLimit = (key: string, max = 20, windowMs = 60_000) => {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
};

// --- AI trip planner ---
const activitySchema = z.object({
  time: z.string(),
  title: z.string(),
  description: z.string(),
  category: z
    .enum(["arrival", "sightseeing", "food", "nature", "shopping", "rest", "travel", "departure"])
    .catch("sightseeing"),
  estimatedCost: z.number().nonnegative().catch(0),
});

const daySchema = z.object({
  day: z.number(),
  title: z.string(),
  summary: z.string(),
  estimatedDailyCost: z.number().nonnegative().catch(0),
  activities: z.array(activitySchema).min(1),
});

const aiPlanSchema = z.object({
  hotelSuggestion: z.string(),
  foodSuggestion: z.string(),
  packingList: z.array(z.string()).min(1),
  safetyTips: z.array(z.string()).min(1),
  itinerary: z.array(daySchema).min(1),
});

export type TripPlanInput = {
  destination: string;
  days: number;
  budget: number;
  currency: string;
  tripType: string;
  transport: string;
};

export const generateAiTripPlan = async (input: TripPlanInput) => {
  const system =
    "You are Nexus AI, an expert travel planner. Return ONLY valid JSON matching the requested schema. " +
    "Costs are realistic integers in the requested currency; per-day and total costs must stay within the user's total budget.";

  const user =
    `Plan a ${input.days}-day ${input.tripType} trip to "${input.destination}", traveling by ${input.transport}, ` +
    `total budget ${input.budget} ${input.currency}. Return JSON with EXACTLY these keys: ` +
    `hotelSuggestion (string), foodSuggestion (string), packingList (6-8 strings), safetyTips (4-6 strings), ` +
    `itinerary (array with one object per day: { day:number, title:string, summary:string, estimatedDailyCost:number, ` +
    `activities: 4-6 of { time:"HH:MM", title:string, description:string, ` +
    `category: one of arrival|sightseeing|food|nature|shopping|rest|travel|departure, estimatedCost:number } }).`;

  const raw = await chatComplete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { json: true, maxTokens: 2400, temperature: 0.7 },
  );

  const parsed = aiPlanSchema.parse(JSON.parse(raw));

  const itinerary = parsed.itinerary.slice(0, input.days).map((day, index) => ({
    ...day,
    day: index + 1,
    estimatedDailyCost:
      day.estimatedDailyCost ||
      day.activities.reduce((sum, activity) => sum + activity.estimatedCost, 0),
  }));

  const estimatedTotalCost = itinerary.reduce((sum, day) => sum + day.estimatedDailyCost, 0);

  return {
    id: crypto.randomUUID(),
    destination: input.destination,
    days: input.days,
    budget: input.budget,
    currency: input.currency,
    tripType: input.tripType,
    transport: input.transport,
    hotelSuggestion: parsed.hotelSuggestion,
    foodSuggestion: parsed.foodSuggestion,
    packingList: parsed.packingList,
    safetyTips: parsed.safetyTips,
    itinerary,
    estimatedTotalCost,
    createdAt: new Date().toISOString(),
  };
};
