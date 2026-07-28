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

export type NarrativeDay = { day: number; title: string; summary: string };

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: "no-key" };

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
    'Respond with JSON only: {"days":[{"day":1,"title":"...","summary":"..."}]}',
    "",
    JSON.stringify(skeleton),
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a concise travel writer. You never invent places." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      // 429 here means the account is out of credit, not that the app is
      // rate-limiting itself — worth distinguishing in the log and to the UI.
      const reason = response.status === 429 ? "quota" : response.status === 401 ? "auth" : "unavailable";
      console.warn(`[trip-narrative] OpenAI ${response.status} (${reason}); keeping generated copy.`);
      return { ok: false, reason };
    }

    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return { ok: false, reason: "unavailable" };

    const parsed = JSON.parse(raw);
    const days = Array.isArray(parsed?.days) ? parsed.days : null;
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
  } catch (error) {
    console.warn("[trip-narrative] request failed; keeping generated copy.", error);
    return { ok: false, reason: "unavailable" };
  }
};
