import { sql } from "drizzle-orm";

import { db } from "../db";
import { pageDirectory } from "./voiceActions";

/**
 * The assistant's brain for the native-audio path, grounded in the app's own
 * database rather than in whatever the model happens to remember.
 *
 * The text path builds its prompt from `voiceActions` alone, which describes
 * what the assistant can *do* but not what the app actually *has*. That gap is
 * why the assistant would cheerfully discuss a city with no row in `geo_cities`
 * and then fail to route to it. Here the cities and the tourism catalogue are
 * read out of Postgres and named in the instruction, so the model recommends
 * what the app can deliver and says so plainly when it cannot.
 *
 * Read once per process and kept — the catalogue changes rarely, and a Live
 * session cannot afford a database round trip before it starts talking.
 */

const CACHE_TTL_MS = 30 * 60 * 1000;

let cached: { text: string; expires: number } | null = null;

/**
 * `is_active` and `is_featured` are integers in Postgres, not booleans — 0 and
 * 1. Written as `is_active = true` the query does not merely return nothing, it
 * fails outright: `operator does not exist: integer = boolean`. That failure
 * was swallowed by the catch below and the assistant simply ran ungrounded, so
 * the flags are compared against 1 here and typed as numbers.
 */
type CityRow = { name: string; country: string | null; featured: number };
type PoiRow = { name: string; category: string | null; city: string | null };

/**
 * Names, not rows.
 *
 * The point is coverage — the model needs to know Skardu is in the database and
 * Zurich is not. Descriptions and coordinates would multiply the prompt for no
 * gain, since every place the assistant acts on is geocoded properly at the
 * moment it acts.
 */
const loadCatalogue = async (): Promise<{ cities: CityRow[]; pois: PoiRow[] }> => {
  const [cities, pois] = await Promise.all([
    db
      .execute(
        sql`select name, country_iso2 as country, is_featured as featured
            from geo_cities where is_active = 1
            order by is_featured desc, population desc nulls last limit 200`,
      )
      .then((result) => result.rows as unknown as CityRow[]),
    db
      .execute(
        sql`select name, category, city from tourism_pois order by is_featured desc limit 120`,
      )
      .then((result) => result.rows as unknown as PoiRow[]),
  ]);
  return { cities, pois };
};

const catalogueText = ({ cities, pois }: { cities: CityRow[]; pois: PoiRow[] }): string => {
  if (!cities.length && !pois.length) return "";

  const byCountry = new Map<string, string[]>();
  for (const city of cities) {
    const key = city.country ?? "other";
    if (!byCountry.has(key)) byCountry.set(key, []);
    byCountry.get(key)!.push(city.name);
  }

  const cityLines = [...byCountry.entries()]
    .map(([country, names]) => `  ${country}: ${names.join(", ")}`)
    .join("\n");

  const poiLines = pois
    .map((poi) => `  ${poi.name}${poi.city ? ` (${poi.city})` : ""}${poi.category ? ` — ${poi.category}` : ""}`)
    .join("\n");

  return `
WHAT THIS APP ACTUALLY HAS
Cities with their own data (${cities.length}):
${cityLines}

Tourism places in the catalogue (${pois.length}):
${poiLines}

Anywhere not listed above can still be searched and routed to through the live
geocoder — the list is what the app has curated, not the limit of where it can
take someone. Never claim a curated page exists for a place that is not on it.
`.trim();
};

/**
 * Spoken, not written.
 *
 * This model's output is audio: there is no screen to read, no second chance to
 * skim. Everything that made the text prompt work — brevity, one idea at a time,
 * asking rather than guessing — matters more here, not less.
 */
const VOICE_RULES = `
You are the Nexus Map assistant. You are speaking out loud, not writing.

VOICE
- One or two sentences. Never a list, never markdown, never a URL, never
  coordinates. If the honest answer needs more, give the headline and offer the
  detail: "About four hours. Want the stops?"
- Speak whatever language the user speaks, in that language's own script.
  Roman Urdu in, Urdu out. Never answer in a language they did not use.
- If anyone asks who made or created you, say exactly: "Nexus Map ne".

ACTING
- To make the app do something — route, search, plan a trip, open a page, find
  tourist places — call runAppCommand with what the user asked, in their own
  words. Do not describe the action instead of taking it.
- Only when the app must actually DO something. A question you can simply
  answer — who made you, what you can do, how long a drive takes — is answered
  with your voice and nothing else. There is no "none" command: calling the
  tool with a placeholder sends the app off to resolve a place named "none".
- Pass the user's sentence, not a label for it. "Skardu mein kya tourist places
  hain?" — that whole sentence. Not "FIND_TOURISM", not "tourism", not a
  category: whatever resolves the request needs the place and the intent, and a
  label throws both away.
- Saying you are doing it is not doing it. If your reply begins "I'm routing
  you" or "میں روٹ بنا رہا ہوں", the tool call has to accompany it. A sentence
  with no call behind it is a promise the app never keeps.
- Say what you are doing as you do it, in the present: "Lahore se Islamabad ka
  route bana raha hoon."
- Never say something has been sent, reported or raised unless the tool result
  told you it was. Reporting a hazard and raising an SOS are seen by other
  people; for those, state what you are about to do and wait to be told to go
  ahead before calling the tool a second time.

ASKING
- A trip plan needs a destination, a length and a budget. If one is missing,
  ask for it — one at a time, not all three at once. Everything else runs
  immediately without confirmation.
- If you did not catch something, say so and ask again. Do not guess a place
  name; a wrong pin is worse than a second question.
`.trim();

export const buildBrain = async (): Promise<string> => {
  if (cached && cached.expires > Date.now()) return cached.text;

  let grounding = "";
  try {
    grounding = catalogueText(await loadCatalogue());
  } catch (error) {
    /**
     * A database that is down must not leave the assistant mute — it loses the
     * catalogue and falls back to the live geocoder for everything.
     *
     * The cause is logged alongside the message because Drizzle's own message
     * is only the SQL it tried; the reason it failed lives in `cause`. Without
     * it this read as "catalogue unavailable" — indistinguishable from an
     * unreachable database — while the real fault was a type mismatch in this
     * file's own query, and it went unnoticed for exactly that reason.
     */
    const cause = (error as { cause?: { message?: string } }).cause?.message;
    console.warn(
      "[brain] catalogue unavailable — running ungrounded:",
      cause ?? (error as Error).message,
    );
  }

  /**
   * `ACTION_GUIDE` is deliberately absent.
   *
   * It is the JSON catalogue the text pipeline needs in order to emit an action
   * object, and putting it here taught this model to think in action names
   * instead of sentences: asked for tourist places in Skardu it called the tool
   * with the literal string "FIND_TOURISM", losing the one thing the resolver
   * needs, which is the place. The guide belongs to whatever produces the
   * action — `/api/ai/live` — not to the voice that reports the request.
   */
  const text = [VOICE_RULES, grounding, `PAGES YOU CAN OPEN\n${pageDirectory()}`]
    .filter(Boolean)
    .join("\n\n");

  cached = { text, expires: Date.now() + CACHE_TTL_MS };
  return text;
};

/** Forces the next call to re-read the catalogue. Used by tests and seeds. */
export const forgetBrain = () => {
  cached = null;
};
