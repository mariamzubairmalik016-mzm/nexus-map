import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { voiceCache } from "../db/schema";

/**
 * Speech rendering and its caches, shared by the speech route and the cron
 * job that refills the cache after each daily quota reset.
 *
 * The cron used to do its work by calling `/api/ai/tts` over HTTP. A function
 * calling its own deployment is not reliable on Vercel — the origin derived
 * from the incoming request is not always reachable from inside — and when
 * that fetch failed the job reported it as a quota refusal and stopped on the
 * first line, which is exactly what happened on its first run. Sharing the
 * code removes the network hop and the guesswork with it.
 */

/**
 * Tried in order. 3.1 sounds best but is capped at 10 requests a day; 2.5
 * carries the session once that runs out.
 *
 * They share the voice *catalog*, not the voice itself — "Charon" on 2.5 has a
 * noticeably different timbre from "Charon" on 3.1. Falling through therefore
 * changes how the assistant sounds mid-conversation, which is jarring, so a
 * model that fails is put on cooldown and the working one is kept for the rest
 * of the session rather than being retried on every line.
 */
const TTS_MODELS = [
  // 2.5-flash leads on speed: it returned audio in 3.2s against 9.0s from
  // 3.1-flash for the same sentence.
  //
  // It does NOT, as this comment previously claimed, carry "~100 requests/day
  // against ~10 for the other two" — that was the reason it was chosen, and it
  // is wrong. Asked for one line past its allowance, the API is explicit:
  //
  //   quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier
  //   quotaDimensions: { model: "gemini-2.5-flash-tts" }
  //   quotaValue: "10"
  //
  // Ten, the same as the rest. So the chain below is worth three times as much
  // as any single model, and pinning GEMINI_TTS_MODEL — which reduces the list
  // to one entry in the route — costs two thirds of the day's speech. Pin it
  // for a steady voice, not because one model lasts longer; it does not.
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-pro-preview-tts",
];

/**
 * How long a failed model is skipped.
 *
 * The free-tier cap that bites here is `GenerateRequestsPerDayPerProjectPerModel`
 * — ten requests per day, per model. Google's `retryDelay` on that error says
 * about eleven seconds, which is wrong in any useful sense: the quota will not
 * return until the day rolls over. Retrying on Google's word produces a voice
 * that flips between models every few sentences, which is the flaw this cooldown
 * exists to prevent. An hour is long enough to outlast any session and short
 * enough to notice a daily reset.
 */
const DAILY_QUOTA_COOLDOWN_MS = 60 * 60 * 1000;
const TRANSIENT_COOLDOWN_MS = 60 * 1000;

const cooldowns = new Map<string, number>();

const isAvailable = (model: string) => (cooldowns.get(model) ?? 0) < Date.now();

const benchModel = (model: string, daily: boolean) => {
  cooldowns.set(model, Date.now() + (daily ? DAILY_QUOTA_COOLDOWN_MS : TRANSIENT_COOLDOWN_MS));
};

/**
 * The model each open conversation is speaking with.
 *
 * Cooldowns alone cannot guarantee a steady voice: a daily quota resetting
 * halfway through a conversation would promote the assistant back to a better
 * model and visibly change how it sounds mid-sentence. Pinning per session
 * means the voice can only change if the pinned model actually stops working.
 */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const sessionModels = new Map<string, { model: string; expires: number }>();

const pinnedFor = (session: string | null): string | null => {
  if (!session) return null;
  const entry = sessionModels.get(session);
  if (!entry || entry.expires < Date.now()) {
    if (entry) sessionModels.delete(session);
    return null;
  }
  return entry.model;
};

const pinSession = (session: string | null, model: string) => {
  if (!session) return;
  // Bound the map: a long-running server would otherwise accumulate one entry
  // per visitor forever.
  if (sessionModels.size > 500) {
    for (const [key, entry] of sessionModels) {
      if (entry.expires < Date.now()) sessionModels.delete(key);
    }
  }
  sessionModels.set(session, { model, expires: Date.now() + SESSION_TTL_MS });
};

/**
 * Default speaker. Charon is the deep, warm male voice in Gemini's catalog —
 * the closest to an ordinary man talking. Override with `GEMINI_TTS_VOICE`;
 * other male options are Orus (firm), Iapetus (clear), Algieba (smooth),
 * Umbriel (easy-going), Gacrux (mature) and Puck (upbeat, younger).
 */
const DEFAULT_VOICE = "Charon";

/**
 * Delivery direction. Gemini TTS takes style as plain language ahead of the
 * line and does not speak the direction itself. Without it the read is flat
 * and announcer-like; with it the model adds the breaths and uneven pacing
 * that make a voice sound like a person.
 */
const STYLE =
  "Say the following the way a real man speaks to a friend — warm, relaxed, " +
  "natural pace, light breaths, never like a news announcer or a robot:";

/** Cheap LRU. Greetings and confirmations repeat constantly; quota does not. */
const CACHE_LIMIT = 60;
const cache = new Map<string, { audio: Buffer; model: string }>();

const remember = (key: string, value: { audio: Buffer; model: string }) => {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
};

/**
 * Two disk caches sit behind the in-memory one, because ten requests a day is
 * not a budget you can afford to spend twice on the same sentence.
 *
 * `public/voice` holds lines rendered ahead of time by
 * `scripts/warm-voice-cache.mjs` and shipped with the app — the greeting and
 * the handful of confirmations the assistant repeats constantly. It is read
 * only, which is what makes it work on a host with a read-only filesystem.
 *
 * The temp directory catches everything else generated at runtime, so a
 * restart does not throw away a session's worth of audio. It is per-instance
 * and disposable; losing it costs a regeneration, nothing more.
 */
const SHIPPED_DIR = join(process.cwd(), "public", "voice");
const RUNTIME_DIR = join(tmpdir(), "nexus-voice");

/** Same inputs must always produce the same filename, in the app and in the script. */
const fileFor = (model: string, voice: string, text: string) =>
  `${createHash("sha256").update(`${model}::${voice}::${text}`).digest("hex").slice(0, 32)}.wav`;

const readFromDisk = async (name: string): Promise<Buffer | null> => {
  for (const directory of [SHIPPED_DIR, RUNTIME_DIR]) {
    try {
      return await readFile(join(directory, name));
    } catch {
      // Not in this one — try the next, then fall through to generating it.
    }
  }
  return null;
};

/**
 * The durable cache.
 *
 * Memory dies with the instance and the temp directory is wiped on deploy, so
 * a line rendered at runtime used to be re-rendered on every cold start —
 * spending a daily budget of roughly a hundred requests on sentences already
 * produced. A row survives both, and every instance shares it.
 */
const readFromDb = async (id: string): Promise<Buffer | null> => {
  try {
    const rows = await db.select().from(voiceCache).where(eq(voiceCache.id, id)).limit(1);
    return rows[0] ? Buffer.from(rows[0].audioBase64, "base64") : null;
  } catch {
    // No database configured, or it is unreachable — speech must not fail for
    // that, so treat it as a miss.
    return null;
  }
};

const writeToDb = async (
  id: string,
  model: string,
  voice: string,
  phrase: string,
  audio: Buffer,
) => {
  try {
    await db
      .insert(voiceCache)
      .values({ id, model, voice, phrase, audioBase64: audio.toString("base64") })
      .onConflictDoNothing();
  } catch (error) {
    console.warn("[tts] could not persist audio to the database:", (error as Error).message);
  }
};

const writeToDisk = async (name: string, audio: Buffer) => {
  try {
    await mkdir(RUNTIME_DIR, { recursive: true });
    await writeFile(join(RUNTIME_DIR, name), audio);
  } catch (error) {
    // A read-only or full disk must not fail the request — the audio is
    // already in memory and on its way to the browser.
    console.warn("[tts] could not persist audio:", (error as Error).message);
  }
};

/** Pulls `rate=NNNNN` out of `audio/L16;codec=pcm;rate=24000`. */
const sampleRateFrom = (mimeType: unknown): number => {
  if (typeof mimeType !== "string") return 24000;
  const match = mimeType.match(/rate=(\d+)/);
  const rate = match ? Number(match[1]) : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : 24000;
};

/** Wraps raw PCM in a WAV container so an <audio> element can play it. */
function pcmToWav(pcmData: Buffer, sampleRate: number, numChannels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmData.length, 40);
  return Buffer.concat([header, pcmData]);
}

/** One attempt against one model. Returns null so the caller can try the next. */
const synthesise = async (
  model: string,
  text: string,
  voice: string,
  apiKey: string,
): Promise<Buffer | null> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${STYLE} ${text}` }] }],
          generationConfig: {
            // Required — without it the model may answer with text instead of
            // audio and the response carries no inlineData at all.
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
          },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      console.warn(`[tts] ${model} → ${response.status}: ${detail.slice(0, 200)}`);
      // Google labels the quota it refused on. A per-day cap is out for the
      // rest of the day; a per-minute one is worth retrying shortly.
      benchModel(model, response.status === 429 && /PerDay/i.test(detail));
      return null;
    }

    const payload = await response.json();
    const part = payload?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!part?.data) {
      console.warn(`[tts] ${model} returned no audio`);
      benchModel(model, false);
      return null;
    }

    return pcmToWav(Buffer.from(part.data, "base64"), sampleRateFrom(part.mimeType));
  } catch (error) {
    console.warn(`[tts] ${model} failed:`, (error as Error).message);
    benchModel(model, false);
    return null;
  }
};

export {
  TTS_MODELS,
  DEFAULT_VOICE,
  isAvailable,
  pinnedFor,
  pinSession,
  cache,
  remember,
  fileFor,
  readFromDisk,
  readFromDb,
  writeToDb,
  writeToDisk,
  synthesise,
};
