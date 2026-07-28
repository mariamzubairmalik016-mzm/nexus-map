/**
 * Optional model-written layer over a data-grounded itinerary.
 *
 * The planner builds the plan deterministically: real places, real times, real
 * costs. This only rewrites the prose — day titles and summaries — so the
 * itinerary stays factual even when the model is unavailable or wrong.
 *
 * The model is never asked to invent places. It receives the stops that were
 * already chosen from `tourism_pois` / TomTom and is told to describe those and
 * nothing else. That ordering matters: an LLM asked to "plan a trip to X" will
 * happily produce plausible venues that do not exist.
 *
 * Returns null on any failure — no key, no quota, timeout, bad shape — and the
 * caller keeps its own copy.
 */

import { chatCompleteJson, llmAvailable } from "./llm";

export type NarrativeDay = { day: number; title: string; summary: string };

export type NarrativeResult =
  | { ok: true; days: NarrativeDay[] }
  | { ok: false; reason: "no-key" | "quota" | "auth" | "unavailable" };

/**
 * Only the fields the narrative actually reads. Deliberately structural rather
 * than `TripDay[]` — this layer must not be able to touch times or costs, and
 * a narrow input makes that a compile-time guarantee instead of a convention.
 */
type ItineraryOutline = Array<{ day: number; activities: Array<{ title: string }> }>;

export const writeNarrative = async (input: {
  destination: string;
  tripType: string;
  transport: string;
  currency: string;
  itinerary: ItineraryOutline;
}): Promise<NarrativeResult> => {
  if (!llmAvailable()) return { ok: false, reason: "no-key" };

  // Only the facts the model is allowed to describe.
  const skeleton = input.itinerary.map((day) => ({
    day: day.day,
    stops: day.activities.map((a) => a.title),
  }));

  const prompt = [
    `Trip: ${input.itinerary.length}-day ${input.tripType} trip to ${input.destination} by ${input.transport}.`,
    "",
    "Each day below lists the stops already chosen. For EACH day write a title (max 8 words) and a summary (one sentence, max 25 words).",
    "Describe ONLY the stops listed. Do not add, rename, or invent any place, restaurant or landmark.",
    'Respond with JSON only, no markdown fences: {"days":[{"day":1,"title":"...","summary":"..."}]}',
    "",
    JSON.stringify(skeleton),
  ].join("\n");

  const parsed = await chatCompleteJson<{ days?: unknown }>(
    [
      { role: "system", content: "You are a concise travel writer. You never invent places. You reply with JSON only." },
      { role: "user", content: prompt },
    ],
    { maxTokens: 900, temperature: 0.7 },
  );

  if (!parsed) return { ok: false, reason: "unavailable" };

  const days = Array.isArray(parsed.days) ? parsed.days : null;
  if (!days) return { ok: false, reason: "unavailable" };

  const cleaned: NarrativeDay[] = days
    .filter((d: unknown): d is NarrativeDay => {
      const row = d as NarrativeDay;
      return (
        typeof row?.day === "number" &&
        typeof row?.title === "string" &&
        typeof row?.summary === "string" &&
        row.title.trim().length > 0
      );
    })
    .map((d: NarrativeDay) => ({ day: d.day, title: d.title.trim(), summary: d.summary.trim() }));

  return cleaned.length > 0 ? { ok: true, days: cleaned } : { ok: false, reason: "unavailable" };
};
