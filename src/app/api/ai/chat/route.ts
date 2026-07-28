import { NextRequest, NextResponse } from "next/server";
import { ilike, or, sql } from "drizzle-orm";

import { db } from "../../../../db";
import { geoCities, tourismPOIs, roadAlerts } from "../../../../db/schema";
import { searchTomTom } from "../../../../services/tomtom.service";
import { chatComplete } from "../../../../services/llm";

/**
 * Assistant endpoint for the floating chatbot.
 *
 * This route did not exist. `AIChatbot` is mounted in the root layout, so it
 * renders on every page, and every message it sent hit a 404 — the widget was
 * visibly broken app-wide.
 *
 * Two answer paths, in order:
 *   1. A language model, when one is reachable (OpenRouter or OpenAI).
 *   2. A grounded responder that answers from this app's own data — the city
 *      catalogue, the POI table, active road alerts, and TomTom search.
 *
 * The fallback exists because a chatbot that can only fail is worse than one
 * with a smaller range. It answers from records that actually exist and says
 * so plainly when it has nothing; it never invents a place or a road closure.
 */

export const dynamic = "force-dynamic";

type ChatTurn = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = [
  "You are the Nexus Map travel assistant.",
  "Help with destinations, routes, road conditions, offline maps and trip planning.",
  "Be concise — two short paragraphs at most, no markdown headings.",
  "If you are not certain about a fact (a road closure, an opening time, a price), say so rather than guessing.",
].join(" ");

/** Ask the model. Returns null on any failure so the caller can fall back. */
async function askModel(message: string, history: ChatTurn[]): Promise<string | null> {
  return chatComplete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: message },
    ],
    { maxTokens: 400, temperature: 0.6 },
  );
}

/** Pull the most likely place name out of a free-text question. */
function extractSubject(message: string): string | null {
  const cleaned = message
    .replace(/[?!.,]/g, " ")
    .replace(
      /\b(how|do|i|get|to|from|what|is|are|the|a|an|in|at|on|tell|me|about|show|find|near|nearby|best|places?|visit|travel|go|route|way|there|can|you|please)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 3 ? cleaned : null;
}

/**
 * Answer from this app's real records. Every branch cites what it looked in,
 * so the user can tell app data from a general reply.
 */
async function groundedAnswer(message: string): Promise<string> {
  const text = message.toLowerCase();

  // --- Road conditions: answer from the live alerts table -----------------
  // Trailing `s?` matters: `\bclosure\b` does not match "closures", which is
  // how people actually phrase the question.
  if (/\b(alerts?|closures?|closed|traffic|road conditions?|blocked|landslides?|accidents?)\b/.test(text)) {
    try {
      const active = await db
        .select({ type: roadAlerts.type, severity: roadAlerts.severity, description: roadAlerts.description })
        .from(roadAlerts)
        .where(sql`${roadAlerts.status} = 'active'`)
        .limit(5);

      if (active.length === 0) {
        return "There are no active road alerts recorded right now. The Road Alerts page pulls live incidents from TomTom for the area you are viewing, so it is worth checking there for the route you have in mind — I only see alerts that have been reported into Nexus Map.";
      }

      const lines = active
        .map((a) => `• ${a.type} (${a.severity})${a.description ? ` — ${a.description}` : ""}`)
        .join("\n");
      return `There ${active.length === 1 ? "is 1 active alert" : `are ${active.length} active alerts`} on record:\n\n${lines}\n\nOpen Road Alerts to see them on the map with live TomTom incidents alongside.`;
    } catch {
      return "I could not reach the alerts database just now. The Road Alerts page will still show live TomTom incidents for the area you are viewing.";
    }
  }

  // --- Offline maps -------------------------------------------------------
  if (/\b(offline|download|no signal|without internet)\b/.test(text)) {
    return "Offline Maps lets you download a region so its tiles, your saved places and your saved routes stay available with no connection. One limit worth knowing: a route you have already saved works offline, but calculating a brand-new route needs a connection, because routing runs through TomTom.";
  }

  // --- Place lookup: cities, then POIs, then live TomTom search ------------
  const subject = extractSubject(message);
  if (subject) {
    try {
      const cities = await db
        .select({ name: geoCities.name, country: geoCities.countryIso2, lat: geoCities.latitude, lng: geoCities.longitude })
        .from(geoCities)
        .where(ilike(geoCities.name, `%${subject}%`))
        .limit(3);

      if (cities.length > 0) {
        const city = cities[0];
        const others = cities.slice(1).map((c) => c.name).join(", ");
        return `${city.name} (${city.country}) is in the Nexus Map catalogue at ${city.lat.toFixed(4)}, ${city.lng.toFixed(4)}. You can open it on the World Map to plan a route, or save it for offline use.${others ? ` I also matched: ${others}.` : ""}`;
      }

      const pois = await db
        .select({ name: tourismPOIs.name, city: tourismPOIs.city, category: tourismPOIs.category, description: tourismPOIs.shortDescription })
        .from(tourismPOIs)
        .where(or(ilike(tourismPOIs.name, `%${subject}%`), ilike(tourismPOIs.city, `%${subject}%`)))
        .limit(3);

      if (pois.length > 0) {
        const lines = pois
          .map((p) => `• ${p.name} — ${p.category} in ${p.city}${p.description ? `. ${p.description}` : ""}`)
          .join("\n");
        return `Here is what I have for "${subject}":\n\n${lines}\n\nSmart Tourism has the full entries with ratings and directions.`;
      }

      // Nothing local — fall back to live provider search rather than guessing.
      const live = await searchTomTom(subject);
      if (live.length > 0) {
        const top = live.slice(0, 3).map((r) => `• ${r.name}${r.country ? ` — ${r.country}` : ""}`).join("\n");
        return `That is not in the Nexus Map catalogue, but live search found:\n\n${top}\n\nSearch the same term on the World Map to drop a pin and route to it.`;
      }
    } catch {
      // fall through to the generic reply
    }
  }

  return "I can help with destinations, routes, road alerts, offline maps and trip planning. Try naming a place — \"Hunza\", \"Badshahi Mosque\", \"Lahore\" — or ask about current road alerts, and I will answer from what Nexus Map actually has on record.";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ success: false, message: "Message is required." }, { status: 400 });
    }

    const reply = (await askModel(message, history)) ?? (await groundedAnswer(message));

    return NextResponse.json({ success: true, data: { reply } });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
