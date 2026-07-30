import { NextRequest, NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const dynamic = "force-dynamic";

/**
 * Gemini text-to-speech for the Live AI assistant.
 *
 * Two things were making the assistant sound like a robot rather than a person:
 *
 *   1. `gemini-3.1-flash-tts-preview` is capped at **10 requests per day** on
 *      the free tier ("Quota exceeded ... limit: 10, model: gemini-3.1-flash-tts").
 *      After roughly ten spoken sentences every call 429s and the browser's
 *      built-in SpeechSynthesis takes over — which is the robotic voice.
 *   2. The sample rate was hardcoded to 24000 while the WAV header was written
 *      before the real rate was known. Gemini reports it in the mimeType
 *      (`audio/L16;codec=pcm;rate=24000`); a mismatch plays the voice too fast
 *      or too slow, which reads as synthetic even when the audio is fine.
 *
 * So: walk a chain of TTS models, stop at the first that answers, parse the
 * rate the model actually returned, and cache by (text, voice) so repeated
 * lines — the greeting, "okay", confirmations — never spend quota twice.
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
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-preview-tts",
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voice =
      (typeof body?.voice === "string" && body.voice.trim()) ||
      process.env.GEMINI_TTS_VOICE ||
      DEFAULT_VOICE;

    if (!text) {
      return new NextResponse("Text is required", { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new NextResponse("Gemini API key not configured", { status: 500 });
    }

    const session = typeof body?.session === "string" ? body.session : null;
    /** Return only what is already cached; never block on generation. */
    const cachedOnly = body?.cachedOnly === true;

    // Order of authority: an explicit env pin, then whatever this conversation
    // is already speaking with, then anything not on cooldown. If everything is
    // benched, try the whole chain anyway rather than going silent.
    const envPin = process.env.GEMINI_TTS_MODEL;
    const sessionPin = pinnedFor(session);
    const available = TTS_MODELS.filter(isAvailable);

    const models = envPin
      ? [envPin]
      : sessionPin
        ? // Keep the pinned model first, but leave the others as a fallback in
          // case it has since stopped working.
          [sessionPin, ...TTS_MODELS.filter((model) => model !== sessionPin && isAvailable(model))]
        : available.length
          ? available
          : TTS_MODELS;

    const respond = (audio: Buffer, model: string, source: string) =>
      new NextResponse(new Uint8Array(audio), {
        headers: {
          "Content-Type": "audio/wav",
          "X-Nexus-Voice": voice,
          "X-Nexus-TTS-Model": model,
          "X-Nexus-TTS-Cache": source,
        },
      });

    /**
     * Which models' cached audio may be used.
     *
     * Cache entries are keyed by model as well as voice, because "Charon" does
     * not sound the same on every model. Once a conversation has settled on
     * one, only that one's audio may be replayed — otherwise a cache hit would
     * change the voice mid-conversation, the very thing the pin prevents.
     * Before a conversation has settled, any cached model is fair game, and
     * playing it settles the conversation on that model.
     */
    const cacheable = envPin || sessionPin ? [models[0]] : models;

    for (const model of cacheable) {
      const key = `${model}::${voice}::${text}`;

      const inMemory = cache.get(key);
      if (inMemory) {
        // Re-insert so the LRU treats a reused line as fresh.
        cache.delete(key);
        cache.set(key, inMemory);
        pinSession(session, model);
        return respond(inMemory.audio, model, "memory");
      }

      const onDisk = await readFromDisk(fileFor(model, voice, text));
      if (onDisk) {
        remember(key, { audio: onDisk, model });
        pinSession(session, model);
        return respond(onDisk, model, "disk");
      }
    }

    /**
     * Cache-only mode — the assistant's default.
     *
     * Generating a novel sentence measured at 4.4s on this deployment, and
     * once the free tier's ten-per-day cap is spent every attempt burns
     * several more seconds before failing. Either way the user sat in silence
     * waiting for audio, which is what "it gets stuck" was.
     *
     * So the live path never waits for generation. A miss returns 204
     * immediately and the browser speaks the line itself — instantly, and with
     * no quota. Generation still starts here in the background, so the same
     * sentence is real Gemini audio the next time it comes up, and the common
     * lines settle into the cache on their own within a few conversations.
     */
    if (cachedOnly) {
      // `after` and not a bare promise: on Vercel the function is frozen once
      // the response is sent, so a detached async call is killed part-way and
      // the line never actually lands in the cache. This keeps the instance
      // alive until the render finishes.
      after(async () => {
        for (const model of models) {
          const audio = await synthesise(model, text, voice, apiKey);
          if (!audio) continue;
          remember(`${model}::${voice}::${text}`, { audio, model });
          await writeToDisk(fileFor(model, voice, text), audio);
          return;
        }
      });

      return new NextResponse(null, {
        status: 204,
        headers: { "X-Nexus-TTS-Cache": "miss-deferred" },
      });
    }

    for (const model of models) {
      const audio = await synthesise(model, text, voice, apiKey);
      if (!audio) continue;

      remember(`${model}::${voice}::${text}`, { audio, model });
      pinSession(session, model);
      void writeToDisk(fileFor(model, voice, text), audio);
      return respond(audio, model, "miss");
    }

    // Every model refused. The client falls back to the browser voice; say why
    // in a header so it is visible in the network tab rather than a mystery.
    return new NextResponse("All Gemini TTS models are rate-limited or unavailable", {
      status: 503,
      headers: { "X-Nexus-TTS-Model": "none" },
    });
  } catch (error) {
    return new NextResponse((error as Error).message, { status: 500 });
  }
}
