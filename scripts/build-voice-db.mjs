#!/usr/bin/env node
/**
 * Builds the complete speech cache — every phrase, in both stores, without
 * ever spending more quota than the free tier actually allows.
 *
 *   node scripts/build-voice-db.mjs --check     # coverage report, zero API calls
 *   node scripts/build-voice-db.mjs --sync      # mirror disk ⇄ database, zero API calls
 *   node scripts/build-voice-db.mjs             # sync, then render what is still missing
 *
 * This exists because `warm-voice-cache.mjs` only ever wrote to `public/voice`.
 * The `voice_cache` table — the one store that survives both a redeploy and a
 * cold start, and the only one shared between instances — was filled purely as
 * a side effect of live traffic. So the shipped lines were on disk and absent
 * from the database, while the lines a real conversation produced were in the
 * database and absent from disk, and neither store was ever complete.
 *
 * Three rules keep the day's quota intact:
 *
 *   1. Copying costs nothing. A line present in either store is written into
 *      the other with no API call at all. This alone closed most of the gap on
 *      the first run; rendering is only ever a last resort.
 *   2. A refusal costs nothing. Google rejects an over-quota request before it
 *      counts against the daily total, so probing a model to find out whether
 *      it has anything left is free. There is no need to guess.
 *   3. Successes are counted, per model and per key, and the run stops at the
 *      cap on its own. The cap is the real quota — see BUDGET.
 *
 * Whatever is rendered is kept. A run that stops at the cap resumes exactly
 * where it left off tomorrow, because coverage is recomputed from the stores
 * rather than from a progress file that could go stale.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "voice");

/**
 * The measured free-tier ceiling, not an estimate.
 *
 * `voiceCacheCore.ts` used to claim 2.5-flash carried "~100 requests/day
 * against ~10 for the other two", and pinned the app to it on that basis. The
 * API disagrees. Asked for one more line than it would give, it answers:
 *
 *   quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier
 *   quotaDimensions: { model: "gemini-2.5-flash-tts" }
 *   quotaValue: "10"
 *
 * Ten, the same as the others. The quota is scoped per project, per model —
 * so two keys belonging to two different projects genuinely double the budget,
 * and two keys on the same project share one. The script discovers which it is
 * by trying, since a refusal is free.
 */
const BUDGET = 10;

/** Tried in this order. Keyed into the cache filename, so they never mix. */
const MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-pro-preview-tts",
];

const DEFAULT_VOICE = "Charon";

/** Must stay byte-identical to STYLE in src/services/voiceCacheCore.ts. */
const STYLE =
  "Say the following the way a real man speaks to a friend — warm, relaxed, " +
  "natural pace, light breaths, never like a news announcer or a robot:";

const has = (name) => process.argv.includes(`--${name}`);
const argOf = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
};

/** Identical to `fileFor` in voiceCacheCore.ts — both must agree or nothing hits. */
const fileFor = (model, voice, text) =>
  `${createHash("sha256").update(`${model}::${voice}::${text}`).digest("hex").slice(0, 32)}.wav`;

/** Reads a var from the environment, then .env.local, then .env. */
const readEnv = async (names) => {
  for (const name of names) {
    if (process.env[name]) return { name, value: process.env[name] };
  }
  for (const file of [".env.local", ".env"]) {
    try {
      const contents = await readFile(join(ROOT, file), "utf8");
      for (const name of names) {
        const match = contents.match(new RegExp(`^${name}=(.*)$`, "m"));
        const value = match?.[1].trim().replace(/^["']|["']$/g, "");
        if (value) return { name, value };
      }
    } catch {
      // Try the next file.
    }
  }
  return null;
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

/**
 * One attempt against one model with one key.
 *
 * Returns the audio, or "quota" when the day is spent on that pair — which is
 * information, not a failure, and cost nothing to obtain.
 */
const render = async (model, voice, text, apiKey) => {
  let response;
  try {
    response = await fetch(
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
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch (error) {
    console.error(`     ! network: ${error.message}`);
    return null;
  }

  if (response.status === 429) return "quota";

  if (!response.ok) {
    console.error(`     ! ${response.status}: ${(await response.text()).slice(0, 160)}`);
    return null;
  }

  const payload = await response.json();
  const part = payload?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

  /**
   * A 200 carrying no audio still counts against the day.
   *
   * Observed on a very short line: `finishReason: "OTHER"`, three prompt
   * tokens, no `inlineData` at all. The request was accepted and charged, and
   * the model simply declined to speak it. Treated as a spend so the counter
   * stays honest, and reported so a phrase that reliably produces it can be
   * rewritten rather than retried every day.
   */
  if (!part?.data) {
    console.error(`     ! accepted but returned no audio (finishReason: ${payload?.candidates?.[0]?.finishReason})`);
    return "spent";
  }

  return pcmToWav(Buffer.from(part.data, "base64"), sampleRateFrom(part.mimeType));
};

const main = async () => {
  const check = has("check");
  const syncOnly = has("sync");
  const voice = argOf("voice") || process.env.GEMINI_TTS_VOICE || DEFAULT_VOICE;

  const pin = argOf("model") || (await readEnv(["GEMINI_TTS_MODEL"]))?.value;
  /**
   * Which models to build for.
   *
   * Audio is keyed by model, and the app looks up only the model it is pinned
   * to. Rendering another one produces files nothing will ever ask for — so by
   * default this builds exactly what the app will play, and `--all-models`
   * exists only for deliberately preparing a fallback ahead of an unpin.
   */
  const models = has("all-models") ? MODELS : pin ? [pin] : MODELS.slice(0, 1);

  const { greeting, phrases } = JSON.parse(
    await readFile(join(ROOT, "src", "services", "voicePhrases.json"), "utf8"),
  );
  const lines = [greeting, ...phrases];

  await mkdir(OUT_DIR, { recursive: true });
  const onDisk = new Set(await readdir(OUT_DIR).catch(() => []));

  const databaseUrl = (await readEnv(["DATABASE_URL"]))?.value;
  const pool = databaseUrl
    ? new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
    : null;

  let inDb = new Map();
  if (pool) {
    try {
      const { rows } = await pool.query("select id, model, voice, phrase from voice_cache");
      inDb = new Map(rows.map((row) => [row.id, row]));
    } catch (error) {
      console.error(`Database unreachable (${error.message}) — disk only.`);
    }
  } else {
    console.error("No DATABASE_URL — disk only.");
  }

  console.log(`Voice:  ${voice}`);
  console.log(`Models: ${models.join(", ")}${pin && !has("all-models") ? "  (pinned)" : ""}`);
  console.log(`Lines:  ${lines.length}  →  ${lines.length * models.length} entries\n`);

  // ---- Coverage, computed from the stores themselves. No API calls. --------

  const entries = [];
  for (const model of models) {
    for (const text of lines) {
      const id = fileFor(model, voice, text);
      entries.push({ id, model, text, disk: onDisk.has(id), db: inDb.has(id) });
    }
  }

  const label = (text) => (text.length > 46 ? `${text.slice(0, 46)}…` : text);
  const mark = (ok) => (ok ? "yes" : " - ");

  console.log(`  ${"line".padEnd(48)} disk  db`);
  for (const entry of entries) {
    console.log(`  ${label(entry.text).padEnd(48)} ${mark(entry.disk)}  ${mark(entry.db)}`);
  }

  const missing = entries.filter((entry) => !entry.disk && !entry.db);
  const lopsided = entries.filter((entry) => entry.disk !== entry.db);
  console.log(
    `\n  ${entries.length - missing.length}/${entries.length} rendered · ` +
      `${lopsided.length} in one store only · ${missing.length} not rendered at all`,
  );

  if (check) {
    console.log("\n--check: nothing was called, nothing was spent.");
    await pool?.end();
    return;
  }

  // ---- Mirror the two stores. Still no API calls. --------------------------

  let copied = 0;
  for (const entry of lopsided) {
    if (entry.disk && !entry.db) {
      if (!pool) continue;
      const audio = await readFile(join(OUT_DIR, entry.id));
      await pool.query(
        `insert into voice_cache (id, model, voice, phrase, audio_base64)
         values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
        [entry.id, entry.model, voice, entry.text, audio.toString("base64")],
      );
      console.log(`  disk → db   ${label(entry.text)}`);
      entry.db = true;
      copied += 1;
    } else if (entry.db && !entry.disk) {
      const { rows } = await pool.query("select audio_base64 from voice_cache where id = $1", [
        entry.id,
      ]);
      if (!rows[0]) continue;
      await writeFile(join(OUT_DIR, entry.id), Buffer.from(rows[0].audio_base64, "base64"));
      console.log(`  db → disk   ${label(entry.text)}`);
      entry.disk = true;
      copied += 1;
    }
  }
  if (copied) console.log(`\n  ${copied} entr${copied === 1 ? "y" : "ies"} mirrored — no quota spent.\n`);

  if (syncOnly) {
    console.log("--sync: stores mirrored, nothing rendered.");
    await pool?.end();
    return;
  }

  const stillMissing = entries.filter((entry) => !entry.disk && !entry.db);
  if (!stillMissing.length) {
    console.log("Every line is present in both stores. Nothing to render.");
    await pool?.end();
    return;
  }

  // ---- Render what is left, one bucket at a time. -------------------------

  /**
   * A bucket is one key against one model — the exact scope the daily quota is
   * metered on. Two keys in two projects therefore give two full budgets; two
   * keys in one project share a single one, and the second simply refuses for
   * free the moment the first is spent.
   */
  const keys = [];
  for (const name of ["GEMINI_TTS_API_KEY", "GEMINI_API_KEY"]) {
    const found = await readEnv([name]);
    if (found && !keys.some((key) => key.value === found.value)) keys.push(found);
  }
  if (!keys.length) {
    console.error("No GEMINI_TTS_API_KEY or GEMINI_API_KEY found.");
    await pool?.end();
    process.exitCode = 1;
    return;
  }

  const cap = Number(argOf("budget")) || BUDGET;
  const buckets = [];
  for (const model of models) {
    for (const key of keys) buckets.push({ model, key, spent: 0, exhausted: false });
  }

  console.log(
    `Rendering ${stillMissing.length} line(s) across ${buckets.length} bucket(s) ` +
      `(${keys.map((key) => key.name).join(" + ")}), cap ${cap} each.\n`,
  );

  let rendered = 0;
  const left = [];

  for (const entry of stillMissing) {
    const bucket = buckets.find(
      (candidate) =>
        candidate.model === entry.model && !candidate.exhausted && candidate.spent < cap,
    );
    if (!bucket) {
      left.push(entry);
      continue;
    }

    const audio = await render(bucket.model, voice, entry.text, bucket.key.value);

    if (audio === "quota") {
      bucket.exhausted = true;
      console.log(`  · ${label(entry.text)}  (${bucket.key.name} out for ${bucket.model})`);
      // Nothing was spent — put the line back through the loop against the
      // next bucket rather than giving up on it.
      stillMissing.push(entry);
      continue;
    }

    if (audio === "spent") {
      bucket.spent += 1;
      left.push(entry);
      continue;
    }

    if (!audio) {
      left.push(entry);
      continue;
    }

    bucket.spent += 1;
    await writeFile(join(OUT_DIR, entry.id), audio);
    if (pool) {
      await pool
        .query(
          `insert into voice_cache (id, model, voice, phrase, audio_base64)
           values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
          [entry.id, entry.model, voice, entry.text, audio.toString("base64")],
        )
        .catch((error) => console.error(`     ! db write: ${error.message}`));
    }
    console.log(
      `  + ${label(entry.text)}  (${Math.round(audio.length / 1024)} KB, ${bucket.key.name})`,
    );
    rendered += 1;
  }

  console.log(`\n${rendered} rendered, ${left.length} left.`);
  for (const bucket of buckets) {
    console.log(
      `  ${bucket.key.name} × ${bucket.model}: ${bucket.spent}/${cap}` +
        (bucket.exhausted ? "  (quota already spent today)" : ""),
    );
  }

  if (left.length) {
    console.log(
      `\nThe day's allowance is gone with ${left.length} line(s) to go. Nothing is ` +
        "lost — Gemini's daily quota rolls over at midnight Pacific, and re-running " +
        "this then picks up exactly where it stopped.",
    );
  }

  await pool?.end();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
