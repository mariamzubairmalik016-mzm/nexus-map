import { NextRequest, NextResponse, after } from "next/server";

import {
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
} from "../../../../services/voiceCacheCore";

export const dynamic = "force-dynamic";

/**
 * Gemini text-to-speech for the Live AI assistant.
 *
 * The provider chain, the cooldowns and the three caches all live in
 * `services/voiceCacheCore` so the scheduled warm-up can reuse them directly
 * rather than calling this route over HTTP.
 */

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

    /**
     * Speech gets its own key when one is provided.
     *
     * The free tier meters per project, so sharing a key with the chat model
     * means a busy conversation can spend the day's speech allowance on text.
     * A separate key keeps the two budgets apart; without one, the shared key
     * still works exactly as before.
     */
    const apiKey = process.env.GEMINI_TTS_API_KEY || process.env.GEMINI_API_KEY;
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

      const name = fileFor(model, voice, text);

      const onDisk = await readFromDisk(name);
      if (onDisk) {
        remember(key, { audio: onDisk, model });
        pinSession(session, model);
        return respond(onDisk, model, "disk");
      }

      const inDb = await readFromDb(name);
      if (inDb) {
        remember(key, { audio: inDb, model });
        pinSession(session, model);
        return respond(inDb, model, "db");
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
          const name = fileFor(model, voice, text);
          remember(`${model}::${voice}::${text}`, { audio, model });
          await Promise.all([
            writeToDb(name, model, voice, text, audio),
            writeToDisk(name, audio),
          ]);
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

      const name = fileFor(model, voice, text);
      remember(`${model}::${voice}::${text}`, { audio, model });
      pinSession(session, model);
      void writeToDb(name, model, voice, text, audio);
      void writeToDisk(name, audio);
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
