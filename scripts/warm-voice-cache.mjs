#!/usr/bin/env node
/**
 * Pre-renders the assistant's most-repeated lines into `public/voice`.
 *
 * Gemini's free tier allows ten speech requests per model per day. That is
 * about twenty spoken sentences before the assistant drops to the browser's
 * robotic voice — not enough to demo with, and it is wasted on the same
 * greeting every single time the assistant is opened. Rendering those lines
 * once and shipping the audio with the app means they never cost quota again,
 * and the whole daily allowance is left for things the user actually asked.
 *
 *   node scripts/warm-voice-cache.mjs                  # first working model
 *   node scripts/warm-voice-cache.mjs --model gemini-2.5-flash-preview-tts
 *   node scripts/warm-voice-cache.mjs --voice Orus
 *
 * Warm the SAME model the app will speak with — audio is keyed by model, so a
 * file rendered by one model is ignored when another is doing the talking.
 * Pinning `GEMINI_TTS_MODEL` in `.env.local` to the model warmed here is the
 * surest way to guarantee every one of these lines is free.
 *
 * Quota exhaustion is expected, not an error: whatever was rendered is kept,
 * and re-running tomorrow skips those and continues. Lines are ordered by how
 * often they are heard, so a run that dies halfway still bought the important
 * ones.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "voice");

// Same order as TTS_MODELS in src/app/api/ai/tts/route.ts. The cache filename
// includes the model, so warming a different one than the app asks for first
// renders audio the app will never look for.
const MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-pro-preview-tts",
];

const DEFAULT_VOICE = "Charon";

// Must match STYLE in src/app/api/ai/tts/route.ts, or the audio rendered here
// will not match what the app asks for at runtime.
const STYLE =
  "Say the following the way a real man speaks to a friend — warm, relaxed, " +
  "natural pace, light breaths, never like a news announcer or a robot:";

const argOf = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
};

/**
 * Reads the speech key without pulling in a dotenv dependency.
 *
 * Prefers GEMINI_TTS_API_KEY, matching the route: when speech has its own key
 * the warm-up must spend that project's allowance, not the chat model's.
 */
const readKey = async () => {
  const NAMES = ["GEMINI_TTS_API_KEY", "GEMINI_API_KEY"];

  for (const name of NAMES) {
    if (process.env[name]) return process.env[name];
  }

  for (const file of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(ROOT, file), "utf8");
      for (const name of NAMES) {
        const match = contents.match(new RegExp(`^${name}=(.*)$`, "m"));
        if (match) {
          const value = match[1].trim().replace(/^["']|["']$/g, "");
          if (value) return value;
        }
      }
    } catch {
      // Try the next file.
    }
  }
  return null;
};

/** Identical to `fileFor` in the TTS route — both must agree or nothing hits. */
const fileFor = (model, voice, text) =>
  `${createHash("sha256").update(`${model}::${voice}::${text}`).digest("hex").slice(0, 32)}.wav`;

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const sampleRateFrom = (mimeType) => {
  const match = typeof mimeType === "string" ? mimeType.match(/rate=(\d+)/) : null;
  const rate = match ? Number(match[1]) : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : 24000;
};

function pcmToWav(pcm, sampleRate, numChannels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
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
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Returns a WAV buffer, the string "quota" when the day is spent, or null. */
const render = async (model, voice, text, apiKey) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE} ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    },
  );

  if (response.status === 429) return "quota";

  if (!response.ok) {
    console.error(`   ! ${response.status}: ${(await response.text()).slice(0, 160)}`);
    return null;
  }

  const payload = await response.json();
  const part = payload?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) return null;

  return pcmToWav(Buffer.from(part.data, "base64"), sampleRateFrom(part.mimeType));
};

const main = async () => {
  const apiKey = await readKey();
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found in the environment, .env.local or .env.");
    process.exit(1);
  }

  const voice = argOf("voice") || process.env.GEMINI_TTS_VOICE || DEFAULT_VOICE;
  const requested = argOf("model") || process.env.GEMINI_TTS_MODEL;
  const chain = requested ? [requested] : MODELS;

  const { greeting, phrases } = JSON.parse(
    await readFile(join(ROOT, "src", "services", "voicePhrases.json"), "utf8"),
  );
  const lines = [greeting, ...phrases];

  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Voice: ${voice}`);
  console.log(`Models: ${chain.join(" → ")}`);
  console.log(`Lines: ${lines.length}\n`);

  let model = null;
  let rendered = 0;
  let skipped = 0;
  const remaining = [];

  for (const text of lines) {
    const label = text.length > 52 ? `${text.slice(0, 52)}…` : text;

    // Once a model is chosen, stay on it: mixing models here would ship audio
    // in two different voices.
    if (model) {
      const path = join(OUT_DIR, fileFor(model, voice, text));
      if (await exists(path)) {
        console.log(`  = ${label}`);
        skipped += 1;
        continue;
      }

      const audio = await render(model, voice, text, apiKey);
      if (audio === "quota") {
        console.log(`  · ${label}  (quota reached)`);
        remaining.push(text);
        continue;
      }
      if (!audio) {
        remaining.push(text);
        continue;
      }

      await writeFile(path, audio);
      console.log(`  + ${label}  (${Math.round(audio.length / 1024)} KB)`);
      rendered += 1;
      continue;
    }

    // No model settled yet — walk the chain to find one with quota left.
    let done = false;
    for (const candidate of chain) {
      const path = join(OUT_DIR, fileFor(candidate, voice, text));
      if (await exists(path)) {
        model = candidate;
        console.log(`  = ${label}`);
        skipped += 1;
        done = true;
        break;
      }

      const audio = await render(candidate, voice, text, apiKey);
      if (audio === "quota" || !audio) continue;

      await writeFile(path, audio);
      model = candidate;
      console.log(`  + ${label}  (${Math.round(audio.length / 1024)} KB)`);
      rendered += 1;
      done = true;
      break;
    }

    if (!done) remaining.push(text);
  }

  console.log(`\n${rendered} rendered, ${skipped} already present, ${remaining.length} left.`);

  if (model) {
    console.log(`\nRendered with: ${model}`);
    console.log("Pin it so the app speaks with the same voice these were made in:");
    console.log(`  GEMINI_TTS_MODEL=${model}`);
    if (voice !== DEFAULT_VOICE) console.log(`  GEMINI_TTS_VOICE=${voice}`);
  }

  if (remaining.length) {
    console.log(
      `\nThe daily quota ran out with ${remaining.length} line(s) to go. ` +
        "Nothing is lost — run this again after the quota resets (midnight " +
        "Pacific) and it will pick up where it stopped.",
    );
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
