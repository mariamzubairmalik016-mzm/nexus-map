import { NextRequest, NextResponse } from "next/server";
import { chatComplete, chatCompleteJson, ChatMessage } from "../../../../services/llm";
import { searchTomTom } from "../../../../services/tomtom.service";
import { searchOsm } from "../../../../services/osmGeocode.service";
import { searchGeoapify } from "../../../../services/geoapify.service";
import {
  ACTION_GUIDE,
  ALERT_SEVERITIES,
  ALERT_TYPES,
  CURRENCIES,
  NEARBY_CATEGORIES,
  PAGES,
  type NearbyCategory,
  TOURISM_CATEGORIES,
  TRANSPORTS,
  TRAVEL_MOODS,
  TRIP_TYPES,
  isPageKey,
  matchOption,
  needsConfirmation,
  pageDirectory,
  sameAction,
  snapToOption,
  type VoiceAction,
} from "../../../../services/voiceActions";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are "Nexus Map Assistant", the voice of the Nexus Map travel app.
If anyone asks who made or created you, reply exactly: "Nexus Map ne".

VOICE
Everything in "spokenResponse" is read out loud by a speech engine, and that
engine takes about as long to produce the audio as the audio lasts. Every extra
word is extra silence for someone waiting to be answered. So: BE SHORT.

- Acting on a request: ONE sentence, ideally under twelve words.
  "Routing you from Lahore to Islamabad now." — not a word more.
- Answering a question: two sentences at most.
- No lists, no markdown, no URLs, no coordinates, no pleasantries, no
  restating what the user just said back to them.

Only add a follow-up offer when it is genuinely the obvious next step, and keep
it to three or four words: "Start navigation?" not "Would you like me to start
the navigation for you now?"

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

ASK BEFORE YOU GUESS
For a trip plan you need a destination, how many days, and a budget. If the user
has not given you those, ASK — one short question at a time, action NONE, the way
a travel agent would. Do not fire off a plan built on invented numbers, and do
not fire off a plan while a question of yours is still unanswered.
  User: "plan a trip for me"
  You:  "Of course — where would you like to go?"           (action NONE)
  User: "Skardu"
  You:  "Nice. How many days, and what's your budget?"      (action NONE)
  User: "5 days, one lakh"
  You:  "Perfect, building your 5-day Skardu plan now."     (action PLAN_TRIP)
Once you have enough, act immediately — never ask a fourth question to confirm
what the user already told you. Read the conversation above before asking: if an
answer is already there, use it.

This applies to PLAN_TRIP and NOTHING ELSE. Routes, searches, tourism and
opening pages are never interrogated — you run them straight away and let the
results answer the question. A mood on its own is a complete FIND_TOURISM
request; run it, then offer to narrow it down:
  "somewhere relaxing with a beach"  → mood relax, category beach. Not a question.
  "somewhere romantic for a honeymoon" → mood romantic. Not a question.
  "I want an adventure"              → mood adventure. Not a question.
Asking "where would you like to go?" for any of those is wrong — showing them
places IS the answer, and they can refine from there.

CONFIRM BEFORE YOU PUBLISH
REPORT_ALERT and SOS are different from everything else: one warns every other
driver, the other summons help. They take two turns, and which turn you are on
is stated under CONTEXT as "Awaiting confirmation".

Turn one — nothing is awaiting confirmation. Return the action AND phrase your
reply as a question. The action will NOT be sent yet, so you must not say it
was:
  User: "there's been an accident here"
  You:  "I can warn other drivers about an accident here. Shall I send it?"  (REPORT_ALERT)

Turn two — CONTEXT says that action is awaiting confirmation. If the user
agreed, return the SAME action, with the same alertType, and now you may say it
has been sent. If they declined or changed the subject, return NONE and let it
go:
  User: "yes, send it"
  You:  "Sent — other drivers will see it."                                  (REPORT_ALERT, same alertType)

NEVER say something has been reported, sent or raised unless CONTEXT told you it
was awaiting confirmation and the user just agreed. Claiming a hazard warning
went out when it did not is worse than not sending it at all.

EXPLAINING
When the user asks what something is, how a feature works, or what the app can
do, answer properly from the knowledge below — in two or three spoken sentences,
no lists. If they ask for something the app genuinely cannot do, say so plainly
and offer the closest thing it can.

SUGGEST THE NEXT STEP
You are an assistant, not a button. After you do something, offer the obvious
next thing in the same breath — one short clause, not a menu:
  after a route      → "Want me to start navigation?"
  after a trip plan  → "Shall I show you places to see there?"
  after tourism      → "Want directions to any of these?"
  after a search     → "Should I route you there?"
Skip the offer when the user is clearly mid-task or just asked a question. Never
stack two questions, and never repeat an offer they have already declined.

Pages you can open:
${pageDirectory()}

Actions:
${ACTION_GUIDE}

WHAT NEXUS MAP IS — use this to answer questions about the app
Nexus Map is a worldwide navigation and travel app. What it actually does:
- Live map with GPS, turn-by-turn navigation, alternative routes, live traffic,
  and route options: fastest or shortest, by car, on foot or by bicycle, and
  avoiding tolls or ferries.
- Search that works down to street level worldwide, combining TomTom, Geoapify
  and OpenStreetMap so coverage holds up where any one of them is thin.
- AI trip planner: give it a destination, days and budget and it writes an
  itinerary with a hotel suggestion and a budget breakdown.
- Smart Tourism: attractions, hotels, restaurants and things to do, searchable
  by city, by mood (relax, adventure, romantic, family, food, photography,
  history, beach, snow, nature, luxury, budget) or by category, with reviews.
- Offline maps: download a region while online and its tiles and saved routes
  keep working with no connection.
- Community road alerts: accidents, blocked roads, police checkpoints and
  hazards reported by other users, which can be confirmed or marked resolved.
- Safety centre: SOS, emergency contacts and location sharing.
- Favourites, trip history, saved routes, notifications and a profile.

Honest limits — say these plainly if asked, never pretend otherwise:
- Creating a NEW route needs an internet connection. Already-saved routes open
  offline; new ones do not.
- Offline maps only cover regions the user downloaded beforehand.
- Map data quality varies by country. Where TomTom is thin — Pakistan has no
  street-level data there, Japan no points of interest — the app falls back to
  OpenStreetMap.
- A trip plan for a place with little data is a starting template, not
  researched local advice.

RULES
- Never invent latitude or longitude. Give place NAMES; they get looked up for you.
- "take me to X" / "set destination X" / "X ka route" → ROUTE (to: "X").
- "X se Y" / "from X to Y" → ROUTE with both from and to.
- "start navigation" / "chalo shuru karo" → ROUTE with start: true, or CLICK "Start Navigation" if a route is already on screen.
- Trip / itinerary / holiday planning → PLAN_TRIP, once you have destination,
  days and budget. See ASK BEFORE YOU GUESS above.
- Tourist places, attractions, "what is there to see", hotels, restaurants,
  "somewhere relaxing" → FIND_TOURISM.
- A question you can simply answer, or a question you are asking → NONE.

Also report which language the USER spoke, as a BCP-47 tag the browser's speech
recogniser understands: en-US, ur-PK, hi-IN, ar-SA, es-ES, fr-FR, de-DE, pt-BR,
tr-TR, id-ID, bn-BD, fa-IR, ru-RU, zh-CN, ja-JP, ko-KR, and so on. Judge it from
what they meant, not the spelling — speech recognition mangles words, so
"mujhe la hore jana hey" is ur-PK, not English.

Reply with JSON only, exactly this shape:
{ "spokenResponse": "...", "language": "ur-PK", "action": { ... } }`;

type LiveReply = { spokenResponse?: unknown; language?: unknown; action?: unknown };

/**
 * Languages whose speakers expect their own script, keyed by ISO-639-1.
 *
 * The prompt already demands native script, and mostly gets it — but "koi acha
 * hotel dhundo Hunza me" occasionally comes back as "Hunza mein behtareen
 * hotels dhoond raha hoon", mirroring the romanised input. Spoken aloud that is
 * read with English phonetics and sounds wrong, so it is caught and rewritten.
 */
const NATIVE_SCRIPTS: Record<string, string> = {
  ur: "Urdu (Arabic script)",
  hi: "Hindi (Devanagari)",
  pa: "Punjabi (Shahmukhi)",
  ar: "Arabic",
  fa: "Persian (Arabic script)",
  bn: "Bengali",
  ta: "Tamil",
  ru: "Russian (Cyrillic)",
  el: "Greek",
  he: "Hebrew",
  th: "Thai",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
};

/**
 * Rewrites a reply that came back romanised into the script it belongs in.
 *
 * Only the spoken text is regenerated — the action was already resolved and
 * must not change underneath the user because of a spelling problem.
 */
const enforceNativeScript = async (
  text: string,
  language: string | null,
): Promise<string> => {
  const script = language ? NATIVE_SCRIPTS[language.split("-")[0].toLowerCase()] : undefined;
  if (!script) return text;

  // Any character outside ASCII means a native script is already in use.
  const hasNonAscii = [...text].some((character) => character.charCodeAt(0) > 127);
  if (hasNonAscii) return text;

  const rewritten = await chatComplete(
    [
      {
        role: "system",
        content:
          `Rewrite the user's sentence in ${script}, keeping the meaning and tone exactly. ` +
          `Place names may keep their usual spelling. Output only the rewritten sentence, nothing else.`,
      },
      { role: "user", content: text },
    ],
    { maxTokens: 300, temperature: 0.2 },
  );

  return rewritten?.trim() || text;
};

type Coordinates = { latitude: number; longitude: number };

/**
 * Resolve a place name to coordinates using the same three providers the
 * search box uses, biased toward wherever the user currently is.
 *
 * The model is never asked for coordinates: prompted for lat/lng it returns
 * confident, wrong numbers — "Liberty Market Lahore" came back as a point in
 * open farmland. Names it knows; geocoding is the geocoder's job.
 */
/**
 * The closest place of a given Geoapify category.
 *
 * Geoapify is queried directly rather than through `fetchLivePlaces`, which
 * takes one of its own seven category *keys* and quietly falls back to
 * "attraction" for anything else — passing it a raw category string made
 * "nearest petrol pump", "nearest hospital" and "nearest ATM" all answer with
 * the same temple.
 */
const nearestOfCategory = async (
  geoapifyCategory: string,
  near: Coordinates,
): Promise<{ name: string; position: Coordinates } | null> => {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return null;

  const url =
    `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(geoapifyCategory)}` +
    `&filter=circle:${near.longitude},${near.latitude},15000` +
    `&bias=proximity:${near.longitude},${near.latitude}` +
    `&limit=20&apiKey=${key}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;

    const payload = await response.json();
    const features: any[] = Array.isArray(payload?.features) ? payload.features : [];

    const candidates = features
      .map((feature) => {
        const [longitude, latitude] = feature?.geometry?.coordinates ?? [];
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        const properties = feature.properties ?? {};
        return {
          name: properties.name || properties.address_line1 || "",
          position: { latitude, longitude },
          distance: Math.hypot(
            (latitude - near.latitude) * 111,
            (longitude - near.longitude) * 111 * Math.cos((near.latitude * Math.PI) / 180),
          ),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      // An unnamed point is useless read aloud, so prefer named results.
      .sort((a, b) => Number(!a.name) - Number(!b.name) || a.distance - b.distance);

    return candidates[0] ?? null;
  } catch {
    return null;
  }
};

/**
 * Writes the line spoken when a hazard report or SOS is offered.
 *
 * The model's own wording is discarded here rather than checked, because
 * checking was not enough. Told to confirm first, it said "I am sending an
 * emergency alert for you right now" and sent nothing; asked to at least
 * phrase it as a question, it produced "I am sending an emergency alert right
 * now. Are you in a safe place?" — a question mark attached to the same false
 * claim. Someone in trouble would have sat waiting for help nobody had called.
 *
 * So the offer is generated from the action itself. The model only translates.
 */
const offerLine = async (action: VoiceAction, language: string | null): Promise<string> => {
  const request =
    action.type === "SOS"
      ? "raise an emergency SOS alert with their current location"
      : `warn other drivers about ${
          action.type === "REPORT_ALERT" ? action.alertType.replace(/_/g, " ") : "a hazard"
        } at their current location`;

  const fallback =
    action.type === "SOS"
      ? "I can raise an emergency SOS with your location. Should I send it?"
      : "I can warn other drivers about this. Should I send it?";

  const written = await chatComplete(
    [
      {
        role: "system",
        content:
          `Write ONE short spoken sentence asking the user for permission to ${request}. ` +
          "Nothing has been sent yet, so it must not say or imply that it has — no " +
          `"I am sending", no "sent". It must end in a question mark. Write it in ` +
          `${language || "en-US"}, in that language's own script. Output only the sentence.`,
      },
      { role: "user", content: "Write the question." },
    ],
    { maxTokens: 120, temperature: 0.3 },
  );

  const line = written?.trim();
  return line && /[?؟¿]/.test(line) ? line : fallback;
};

/**
 * Nothing here may take longer than this.
 *
 * Every one of these is a network call to somebody else's server, sitting
 * between the user finishing a sentence and hearing a reply. Nominatim's
 * public demo server in particular can take seconds, and waiting for it means
 * the whole assistant waits. Better a slightly worse answer, quickly, than a
 * perfect one after the user has given up.
 */
const PROVIDER_TIMEOUT_MS = 2500;

/** Runs a promise with a deadline, falling back rather than failing. */
const withDeadline = async <T>(work: Promise<T>, fallback: T, ms = PROVIDER_TIMEOUT_MS): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Small time-to-live cache. Two calls dominate a spoken turn and both repeat
 * constantly: the user's country never changes during a session, and a demo
 * says "Lahore" and "Islamabad" over and over.
 */
const cached = <T>(limit: number, ttlMs: number) => {
  const store = new Map<string, { value: T; expires: number }>();

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expires < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T) {
      if (store.size >= limit) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expires: Date.now() + ttlMs });
    },
  };
};

const countryCache = cached<string | undefined>(200, 60 * 60 * 1000);

/** ISO alpha-2 for the user's position, so a query does not jump the border. */
const countryFor = async (near?: Coordinates | null): Promise<string | undefined> => {
  const key = process.env.TOMTOM_API_KEY;
  if (!near || !key) return undefined;

  // Two decimal places is about a kilometre — far finer than a country border
  // needs, and enough that a moving user still reuses the same entry.
  const cacheKey = `${near.latitude.toFixed(2)},${near.longitude.toFixed(2)}`;
  const hit = countryCache.get(cacheKey);
  if (hit !== undefined) return hit;

  try {
    const response = await withDeadline(
      fetch(
        `https://api.tomtom.com/search/2/reverseGeocode/${near.latitude},${near.longitude}.json?key=${key}`,
        { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) },
      ),
      null as Response | null,
    );
    if (!response?.ok) return undefined;

    const data = await response.json();
    const code = data?.addresses?.[0]?.address?.countryCode;
    const country = typeof code === "string" ? code : undefined;
    countryCache.set(cacheKey, country);
    return country;
  } catch {
    return undefined;
  }
};

/** OSM/Geoapify types that mean "a place people live in" rather than a shop. */
const SETTLEMENT = /^(city|town|village|municipality|administrative|county|state|suburb|geography|populated)/i;

/**
 * Words that describe what a place *is*, which the map may not carry.
 *
 * Lahore's Anarkali is in OpenStreetMap as plain "انارکلی" — searching the way
 * people actually say it, "Anarkali Bazaar", misses it entirely and instead
 * exactly matches a suburb of that name 87 km away, which then wins on every
 * ranking signal there is. Dropping the descriptive tail and searching again
 * finds the real place. Kept to generic words only: trimming anything else
 * would turn "New York" into "New".
 */
const GENERIC_TAIL =
  /\s+(bazaar|bazar|market|mandi|road|rd|street|st|chowk|plaza|mall|station|stop|adda|park|bagh|colony|town|society|phase|block)$/i;

/** How far is "somewhere else entirely", in km. */
const FAR_AWAY_KM = 60;
/** How close a retry must land before it is believed over the first answer. */
const NEARBY_ENOUGH_KM = 25;

type Located = { name: string; position: Coordinates; distanceKm: number | null };

/** One search across all three providers, ranked. */
const lookup = async (
  term: string,
  near: Coordinates | null,
  country: string | undefined,
): Promise<Located | null> => {
  // Each provider gets its own deadline rather than a shared one, so the two
  // fast ones still contribute when the slow one is having a bad day.
  const [tomtom, geoapify, osm] = await Promise.all([
    withDeadline(searchTomTom(term, near?.latitude, near?.longitude).catch(() => []), []),
    withDeadline(searchGeoapify(term, near ?? null, country).catch(() => []), []),
    withDeadline(searchOsm(term, country).catch(() => []), []),
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

  /** Rough great-circle distance in km — good enough for ranking. */
  const distanceKm = (item: any) => {
    if (!near) return null;
    return Math.hypot(
      (item.position.latitude - near.latitude) * 111,
      (item.position.longitude - near.longitude) * 111 * Math.cos((near.latitude * Math.PI) / 180),
    );
  };

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

    /**
     * Nearness, worth at most 2 and fading out over ~100 km.
     *
     * Deliberately small. It has to settle ties between places of the same
     * name — "Anarkali Bazaar" matched a market 90 km from Lahore as readily
     * as the famous one the user was standing next to — without ever
     * outweighing prominence, or "Islamabad" asked from Karachi would snap to
     * a village in Sindh instead of the capital.
     */
    const distance = distanceKm(item);
    const closeness = distance === null ? 0 : 2 * Math.exp(-distance / 100);

    return nameScore * 10 + settlement * 3 + prominence * 5 + closeness - index * 0.01;
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
    distanceKm: distanceKm(best),
  };
};

/**
 * Resolve a place name to coordinates, retrying without a descriptive tail
 * when the first answer lands implausibly far away.
 *
 * The retry only wins if it finds something genuinely close, so a deliberate
 * long-distance request ("route to Islamabad" from Karachi) keeps its answer
 * — the far result is the right one there, and no retry is even attempted
 * unless the query ends in a generic word like "Bazaar" or "Road".
 */
const geocodeCache = cached<{ name: string; position: Coordinates } | null>(300, 30 * 60 * 1000);

const geocode = async (
  query: string,
  near?: Coordinates | null,
): Promise<{ name: string; position: Coordinates } | null> => {
  const term = query.trim();
  if (term.length < 2) return null;

  // Biased by roughly-where-you-are, since the same words resolve differently
  // from different cities. A demo says the same handful of place names over
  // and over; each one should cost a network round trip once.
  const cacheKey = near
    ? `${term.toLowerCase()}@${near.latitude.toFixed(1)},${near.longitude.toFixed(1)}`
    : term.toLowerCase();

  const hit = geocodeCache.get(cacheKey);
  if (hit !== undefined) return hit;

  const country = await countryFor(near);
  const first = await lookup(term, near ?? null, country);

  const shouldRetry =
    near &&
    first &&
    first.distanceKm !== null &&
    first.distanceKm > FAR_AWAY_KM &&
    GENERIC_TAIL.test(term);

  if (shouldRetry) {
    const trimmed = term.replace(GENERIC_TAIL, "").trim();
    if (trimmed.length >= 3) {
      const second = await lookup(trimmed, near ?? null, country);
      if (second && second.distanceKm !== null && second.distanceKm < NEARBY_ENOUGH_KM) {
        const better = { name: second.name, position: second.position };
        geocodeCache.set(cacheKey, better);
        return better;
      }
    }
  }

  const result = first ? { name: first.name, position: first.position } : null;
  geocodeCache.set(cacheKey, result);
  return result;
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
      // Both ends at once. Resolving them one after the other doubled the wait
      // on the single most common command there is.
      const [destination, origin] = await Promise.all([
        geocode(action.to, near),
        action.from ? geocode(action.from, near) : Promise.resolve(null),
      ]);

      if (!destination) {
        return {
          action: { type: "NONE" },
          spokenOverride: `I could not find ${action.to} on the map. Could you say the name again, or add the city?`,
        };
      }

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
      const category = matchOption(action.category, Object.keys(NEARBY_CATEGORIES) as NearbyCategory[]);
      const spoken = String(action.category ?? "place").replace(/_/g, " ");

      if (!near) {
        return {
          action: { type: "NONE" },
          spokenOverride:
            "I need your location for that. Turn on location access and ask me again.",
        };
      }
      if (!category) {
        return { action: { type: "NONE" }, spokenOverride: `I can't search for ${spoken} nearby.` };
      }

      const nearest = await nearestOfCategory(NEARBY_CATEGORIES[category], near);

      if (!nearest) {
        return {
          action: { type: "NONE" },
          spokenOverride: `I couldn't find a ${spoken} within about fifteen kilometres of you.`,
        };
      }

      return {
        action: {
          type: "NAVIGATE",
          url: `${PAGES.map.path}?${params({
            place: nearest.name || spoken,
            lat: nearest.position.latitude,
            lng: nearest.position.longitude,
          })}`,
        },
      };
    }

    case "FIND_TOURISM": {
      // Not geocoded: the tourism search takes a free-text city or place name
      // and does its own lookup, and a mood or category alone is a valid
      // search with no place attached at all.
      if (!action.query && !action.mood && !action.category) {
        return { action: { type: "NAVIGATE", page: "tourism" } };
      }
      return {
        action: {
          type: "NAVIGATE",
          url: `${PAGES.tourism.path}?${params({
            q: action.query,
            mood: matchOption(action.mood, TRAVEL_MOODS),
            category: matchOption(action.category, TOURISM_CATEGORIES),
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

    case "REPORT_ALERT": {
      // Validated here so a hallucinated type never reaches the database, and
      // so the user is told why nothing happened rather than being left to
      // assume their warning went out.
      const alertType = matchOption(action.alertType, ALERT_TYPES);
      if (!alertType) {
        return {
          action: { type: "NONE" },
          spokenOverride: "I'm not sure what kind of hazard that is. Can you describe it again?",
        };
      }
      if (!near) {
        return {
          action: { type: "NONE" },
          spokenOverride:
            "I need your location to report a hazard. Turn on location access and tell me again.",
        };
      }
      return {
        action: {
          type: "REPORT_ALERT",
          alertType,
          severity: snapToOption(action.severity, ALERT_SEVERITIES, "medium"),
          description: String(action.description ?? "").trim().slice(0, 500),
        },
      };
    }

    case "SOS": {
      if (!near) {
        return {
          action: { type: "NONE" },
          spokenOverride:
            "I can't raise an SOS without your location. Turn on location access and tell me again.",
        };
      }
      return {
        action: { type: "SOS", message: String(action.message ?? "").trim().slice(0, 500) || undefined },
      };
    }

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

    /**
     * The consequential action offered on the previous turn, echoed back by
     * the browser.
     *
     * Whether an alert is being *offered* or *sent* cannot be left to the
     * model to remember: asked to report an accident it would reply with a
     * question but no action, and then on "yes, send it" return the action and
     * announce it had been sent — so the user was told a hazard warning had
     * gone out when nothing had been submitted at all. Stating the turn
     * explicitly removes the guesswork.
     */
    const pending: VoiceAction | null =
      body?.pending && typeof body.pending.type === "string" ? body.pending : null;

    const context = [
      body?.page ? `The user is currently on the ${body.page} page.` : null,
      near ? `Their current position is ${near.latitude.toFixed(4)}, ${near.longitude.toFixed(4)}.` : null,
      pending
        ? `Awaiting confirmation: ${pending.type}` +
          (pending.type === "REPORT_ALERT" ? ` (${pending.alertType})` : "") +
          ". If the user just agreed, return this same action and it will be sent."
        : "Nothing is awaiting confirmation, so any REPORT_ALERT or SOS you return will only be offered, not sent.",
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

    // Our own corrections are written in English, so only the model's prose is
    // script-checked — rewriting a "could not find that place" message into
    // Urdu would be wrong when the user was speaking English.
    /**
     * The single authority on whether a consequential action is sent.
     *
     * True only when this exact action was already offered and the model has
     * returned it again. The browser refuses to submit without it, so a model
     * that skips its own confirmation step still cannot publish anything.
     */
    const submit = needsConfirmation(action) && sameAction(pending, action);

    // Offering, not sending: the line is written from the action rather than
    // taken from the model, which cannot be trusted not to announce a send
    // that has not happened.
    const offering = !spokenOverride && needsConfirmation(action) && !submit;

    let spoken = offering
      ? await offerLine(action, language)
      : (spokenOverride ?? reply.spokenResponse);

    if (!spokenOverride && !offering) spoken = await enforceNativeScript(spoken, language);

    return NextResponse.json({
      success: true,
      data: { spokenResponse: spoken, language, action, submit },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
