import { NextRequest, NextResponse } from "next/server";
import { chatCompleteJson, ChatMessage } from "../../../../services/llm";
import { searchTomTom } from "../../../../services/tomtom.service";
import { searchOsm } from "../../../../services/osmGeocode.service";
import { searchGeoapify } from "../../../../services/geoapify.service";
import {
  ACTION_GUIDE,
  CURRENCIES,
  PAGES,
  TRANSPORTS,
  TRIP_TYPES,
  isPageKey,
  pageDirectory,
  snapToOption,
  type VoiceAction,
} from "../../../../services/voiceActions";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are "Nexus Map Assistant", the voice of the Nexus Map travel app.
If anyone asks who made or created you, reply exactly: "Nexus Map ne".

VOICE
Everything you write in "spokenResponse" is spoken out loud, so write it the way
a person talks: short, warm, no lists, no markdown, no URLs, no coordinates.
One or two sentences. Confirm what you are doing as you do it ("Sure — routing
you from Lahore to Islamabad now").

LANGUAGE
Match the user's language exactly. This is not optional and you get it wrong by
defaulting to Urdu — do not.
- User speaks English → reply in English.
- User speaks Urdu (in Urdu script) → reply in Urdu script.
- User speaks romanised Urdu/Hindi ("mujhe Lahore jana hai") → they are speaking
  Urdu, so reply in Urdu SCRIPT: "میں ٹھیک ہوں", never "Main theek hoon".
- Any other language → reply in that language, in its own native script.
Romanised text is mispronounced badly by the voice engine, so native script is
required for every non-Latin language. Place names may stay in their usual
spelling. If the user mixes languages, follow the dominant one.

CONTROL
You drive the whole app. When the user asks for something, DO it with an action
instead of explaining how they could do it themselves. Never tell the user to
tap, click or open something — you open it.

Pages you can open:
${pageDirectory()}

Actions:
${ACTION_GUIDE}

RULES
- Never invent latitude or longitude. Give place NAMES; they get looked up for you.
- "take me to X" / "set destination X" / "X ka route" → ROUTE (to: "X").
- "X se Y" / "from X to Y" → ROUTE with both from and to.
- "start navigation" / "chalo shuru karo" → ROUTE with start: true, or CLICK "Start Navigation" if a route is already on screen.
- Trip / itinerary / holiday planning → PLAN_TRIP. Guess sensible days, budget and
  currency from context rather than interrogating the user; mention what you assumed.
- A question you can simply answer → NONE.

Also report which language the USER spoke, as a BCP-47 tag the browser's speech
recogniser understands: en-US, ur-PK, hi-IN, ar-SA, es-ES, fr-FR, de-DE, pt-BR,
tr-TR, id-ID, bn-BD, fa-IR, ru-RU, zh-CN, ja-JP, ko-KR, and so on. Judge it from
what they meant, not the spelling — speech recognition mangles words, so
"mujhe la hore jana hey" is ur-PK, not English.

Reply with JSON only, exactly this shape:
{ "spokenResponse": "...", "language": "ur-PK", "action": { ... } }`;

type LiveReply = { spokenResponse?: unknown; language?: unknown; action?: unknown };

type Coordinates = { latitude: number; longitude: number };

/**
 * Resolve a place name to coordinates using the same three providers the
 * search box uses, biased toward wherever the user currently is.
 *
 * The model is never asked for coordinates: prompted for lat/lng it returns
 * confident, wrong numbers — "Liberty Market Lahore" came back as a point in
 * open farmland. Names it knows; geocoding is the geocoder's job.
 */
/** ISO alpha-2 for the user's position, so a query does not jump the border. */
const countryFor = async (near?: Coordinates | null): Promise<string | undefined> => {
  const key = process.env.TOMTOM_API_KEY;
  if (!near || !key) return undefined;

  try {
    const response = await fetch(
      `https://api.tomtom.com/search/2/reverseGeocode/${near.latitude},${near.longitude}.json?key=${key}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    const code = data?.addresses?.[0]?.address?.countryCode;
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
};

/** OSM/Geoapify types that mean "a place people live in" rather than a shop. */
const SETTLEMENT = /^(city|town|village|municipality|administrative|county|state|suburb|geography|populated)/i;

const geocode = async (
  query: string,
  near?: Coordinates | null,
): Promise<{ name: string; position: Coordinates } | null> => {
  const term = query.trim();
  if (term.length < 2) return null;

  const country = await countryFor(near);

  const [tomtom, geoapify, osm] = await Promise.all([
    searchTomTom(term, near?.latitude, near?.longitude).catch(() => []),
    searchGeoapify(term, near ?? null, country).catch(() => []),
    searchOsm(term, country).catch(() => []),
  ]);

  const candidates = [...tomtom, ...geoapify, ...osm].filter(
    (item: any) =>
      Number.isFinite(item?.position?.latitude) && Number.isFinite(item?.position?.longitude),
  ) as any[];

  if (!candidates.length) return null;

  /**
   * Pick the place the user meant, not merely the first hit.
   *
   * Two failures made this necessary, and they pull in opposite directions:
   *
   *   - Taking the first result labelled Lahore "Islamabad Lahore" — TomTom's
   *     index is POI-heavy, so a shop outranked the city it sits in.
   *   - Taking the best *name* match sent "Islamabad" to a village of that
   *     name in Sindh, because the proximity bias from a Karachi user ranked
   *     it above the capital 1,100 km away.
   *
   * So all three signals are weighed: how well the name matches, whether the
   * result is a settlement at all, and Nominatim's prominence score — the only
   * thing that separates a capital from a hamlet of the same name. Provider
   * order breaks the remaining ties.
   */
  const wanted = term.toLowerCase();

  const score = (item: any, index: number) => {
    const name = String(item?.name ?? "").toLowerCase();

    const nameScore =
      name === wanted
        ? 4
        : name.startsWith(`${wanted},`) || name.startsWith(`${wanted} `)
          ? 3
          : name.includes(wanted)
            ? 2
            : 0;

    const settlement = SETTLEMENT.test(String(item?.category ?? "")) ? 1 : 0;
    const prominence = typeof item?.importance === "number" ? item.importance : 0;

    return nameScore * 10 + settlement * 3 + prominence * 5 - index * 0.01;
  };

  let best = candidates[0];
  let bestScore = score(candidates[0], 0);

  candidates.forEach((item, index) => {
    const value = score(item, index);
    if (value > bestScore) {
      best = item;
      bestScore = value;
    }
  });

  return {
    name: typeof best.name === "string" && best.name.trim() ? best.name : term,
    position: {
      latitude: best.position.latitude,
      longitude: best.position.longitude,
    },
  };
};

const params = (entries: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

/**
 * Turn a model action into something the browser can run.
 *
 * ROUTE / PLAN_TRIP / SEARCH / NEARBY become a NAVIGATE with real coordinates
 * baked into the URL — the map and planner pages auto-execute from those
 * params, so the user never has to touch anything. Anything that cannot be
 * geocoded comes back with a spoken correction instead of a wrong pin.
 */
const resolveAction = async (
  action: VoiceAction,
  near: Coordinates | null,
): Promise<{ action: VoiceAction; spokenOverride?: string }> => {
  switch (action.type) {
    case "ROUTE": {
      const destination = await geocode(action.to, near);
      if (!destination) {
        return {
          action: { type: "NONE" },
          spokenOverride: `I could not find ${action.to} on the map. Could you say the name again, or add the city?`,
        };
      }

      const origin = action.from ? await geocode(action.from, near) : null;
      if (action.from && !origin) {
        return {
          action: { type: "NONE" },
          spokenOverride: `I found ${destination.name}, but not ${action.from}. Which city is that in?`,
        };
      }

      return {
        action: {
          type: "NAVIGATE",
          url: `${PAGES.map.path}?${params({
            place: destination.name,
            lat: destination.position.latitude,
            lng: destination.position.longitude,
            from: origin?.name,
            fromLat: origin?.position.latitude,
            fromLng: origin?.position.longitude,
            mode: action.mode,
            go: action.start ? "1" : undefined,
          })}`,
        },
      };
    }

    case "SEARCH": {
      const place = await geocode(action.query, near);
      if (!place) {
        return {
          action: { type: "NONE" },
          spokenOverride: `I could not find ${action.query}. Try adding the city name.`,
        };
      }
      return {
        action: {
          type: "NAVIGATE",
          url: `${PAGES.map.path}?${params({
            place: place.name,
            lat: place.position.latitude,
            lng: place.position.longitude,
          })}`,
        },
      };
    }

    case "NEARBY": {
      // Same path as SEARCH, but the geocode is biased hard to where the user
      // is standing — "petrol pump" only means anything relative to them.
      const place = await geocode(action.category, near);
      if (!place) {
        return {
          action: { type: "NONE" },
          spokenOverride: `I couldn't find a ${action.category} near you.`,
        };
      }
      return {
        action: {
          type: "NAVIGATE",
          url: `${PAGES.map.path}?${params({
            place: place.name,
            lat: place.position.latitude,
            lng: place.position.longitude,
          })}`,
        },
      };
    }

    case "PLAN_TRIP":
      return {
        action: {
          type: "NAVIGATE",
          url: `${PAGES.planner.path}?${params({
            destination: action.destination,
            days: clamp(action.days, 1, 14, 4),
            budget: clamp(action.budget, 1, 100_000_000, 80_000),
            // Snapped to the planner's own dropdown values — an invented
            // option renders the select blank and the plan comes out wrong.
            currency: snapToOption(action.currency, CURRENCIES, "PKR"),
            tripType: snapToOption(action.tripType, TRIP_TYPES, "Family"),
            transport: snapToOption(action.transport, TRANSPORTS, "Car"),
          })}`,
        },
      };

    case "NAVIGATE": {
      // Trust page keys; accept only in-app URLs so a hallucinated external
      // link can never redirect the user off the site.
      if (isPageKey(action.page)) return { action: { type: "NAVIGATE", page: action.page } };
      if (typeof action.url === "string" && action.url.startsWith("/")) {
        return { action: { type: "NAVIGATE", url: action.url } };
      }
      return { action: { type: "NONE" } };
    }

    default:
      return { action };
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history: { role: string; content: string }[] = Array.isArray(body?.history)
      ? body.history
      : [];

    // Where the user is, sent by the browser. Used to bias geocoding and to
    // answer "nearest petrol pump" style questions from the right city.
    const near: Coordinates | null =
      Number.isFinite(body?.location?.latitude) && Number.isFinite(body?.location?.longitude)
        ? { latitude: body.location.latitude, longitude: body.location.longitude }
        : null;

    if (!message) {
      return NextResponse.json({ success: false, message: "Message is required." }, { status: 400 });
    }

    const context = [
      body?.page ? `The user is currently on the ${body.page} page.` : null,
      near ? `Their current position is ${near.latitude.toFixed(4)}, ${near.longitude.toFixed(4)}.` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const messages: ChatMessage[] = [
      { role: "system", content: context ? `${SYSTEM_PROMPT}\n\nCONTEXT\n${context}` : SYSTEM_PROMPT },
      ...history.slice(-8).map((turn) => ({
        role: (turn.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: String(turn.content ?? ""),
      })),
      { role: "user", content: message },
    ];

    const reply = await chatCompleteJson<LiveReply>(messages, {
      maxTokens: 700,
      temperature: 0.6,
    });

    if (!reply || typeof reply.spokenResponse !== "string") {
      return NextResponse.json({
        success: true,
        data: {
          spokenResponse: "I'm having trouble thinking right now. Could you say that again?",
          action: { type: "NONE" },
        },
      });
    }

    const raw = (reply.action ?? { type: "NONE" }) as VoiceAction;
    const { action, spokenOverride } = await resolveAction(
      raw && typeof raw.type === "string" ? raw : { type: "NONE" },
      near,
    );

    // Anything that is not a plausible BCP-47 tag is dropped rather than fed
    // to the recogniser, which throws on a malformed language.
    const language =
      typeof reply.language === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(reply.language)
        ? reply.language
        : null;

    return NextResponse.json({
      success: true,
      data: {
        spokenResponse: spokenOverride ?? reply.spokenResponse,
        language,
        action,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
