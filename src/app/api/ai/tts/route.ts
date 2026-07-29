import { NextRequest, NextResponse } from "next/server";

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
 * Tried in order. 3.1 is the best sounding but has the 10/day cap, so 2.5
 * carries the session once that runs out; both share the same voice catalog,
 * so the voice does not change when we fall through.
 */
const TTS_MODELS = [
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
];

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
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      console.warn(`[tts] ${model} → ${response.status}: ${(await response.text()).slice(0, 200)}`);
      return null;
    }

    const payload = await response.json();
    const part = payload?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!part?.data) {
      console.warn(`[tts] ${model} returned no audio`);
      return null;
    }

    return pcmToWav(Buffer.from(part.data, "base64"), sampleRateFrom(part.mimeType));
  } catch (error) {
    console.warn(`[tts] ${model} failed:`, (error as Error).message);
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

    const key = `${voice}::${text}`;
    const hit = cache.get(key);
    if (hit) {
      // Re-insert so the LRU treats a reused line as fresh.
      cache.delete(key);
      cache.set(key, hit);
      return new NextResponse(new Uint8Array(hit.audio), {
        headers: {
          "Content-Type": "audio/wav",
          "X-Nexus-Voice": voice,
          "X-Nexus-TTS-Model": hit.model,
          "X-Nexus-TTS-Cache": "hit",
        },
      });
    }

    for (const model of TTS_MODELS) {
      const audio = await synthesise(model, text, voice, apiKey);
      if (!audio) continue;

      remember(key, { audio, model });
      return new NextResponse(new Uint8Array(audio), {
        headers: {
          "Content-Type": "audio/wav",
          "X-Nexus-Voice": voice,
          "X-Nexus-TTS-Model": model,
          "X-Nexus-TTS-Cache": "miss",
        },
      });
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
