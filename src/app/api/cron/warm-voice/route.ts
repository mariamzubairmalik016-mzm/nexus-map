import { NextRequest, NextResponse } from "next/server";

import voicePhrases from "../../../../services/voicePhrases.json";
import {
  TTS_MODELS,
  DEFAULT_VOICE,
  isAvailable,
  fileFor,
  readFromDisk,
  readFromDb,
  writeToDb,
  writeToDisk,
  synthesise,
} from "../../../../services/voiceCacheCore";

export const dynamic = "force-dynamic";
// Each line takes a few seconds to render.
export const maxDuration = 300;

/**
 * Refill the speech cache once the daily quota rolls over.
 *
 * The assistant never waits for audio to be generated — an uncached line is
 * spoken by the browser instead — so a line only ever gains its real voice by
 * being rendered ahead of time. That used to mean running a script by hand at
 * the right moment, and it routinely did not happen: three Urdu lines sat
 * unrendered for exactly that reason, because the day's quota was spent before
 * anyone got to them.
 *
 * The schedule lives in `vercel.json` as `30 8 * * *`. Gemini's daily quota
 * rolls over at midnight Pacific — 07:00 UTC under PDT, 08:00 under PST — so
 * 08:30 clears both, with margin for the scheduler running late. That note is
 * here rather than beside the entry because Vercel rejects any property in a
 * cron entry it does not recognise, including a `//` comment key.
 *
 * This calls the renderer directly. The first version asked `/api/ai/tts` over
 * HTTP and derived the URL from the incoming request; inside a Vercel function
 * that origin is not dependably reachable, the fetch failed, and the job read
 * the failure as a quota refusal and gave up on the very first line — it
 * reported nothing cached when six lines plainly were.
 */
export async function GET(req: NextRequest) {
  /**
   * Vercel signs its cron calls with CRON_SECRET when the variable is set.
   * Checked when present so nobody else can spend the day's quota; left open
   * when it is not, since the job only ever renders a fixed list of phrases.
   */
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.GEMINI_TTS_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "No Gemini API key configured." },
      { status: 500 },
    );
  }

  const voice = process.env.GEMINI_TTS_VOICE || DEFAULT_VOICE;
  const lines: string[] = [voicePhrases.greeting, ...voicePhrases.phrases].filter(Boolean);

  const rendered: string[] = [];
  let alreadyCached = 0;
  let stoppedOnQuota = false;

  for (const line of lines) {
    // Already stored anywhere? Then it costs nothing and must not be redone.
    const models = TTS_MODELS.filter(isAvailable);
    let found = false;
    for (const model of TTS_MODELS) {
      const name = fileFor(model, voice, line);
      if ((await readFromDisk(name)) || (await readFromDb(name))) {
        found = true;
        break;
      }
    }
    if (found) {
      alreadyCached += 1;
      continue;
    }

    // Render with the first model that will answer, then store it permanently.
    let stored = false;
    for (const model of models.length ? models : TTS_MODELS) {
      const audio = await synthesise(model, line, voice, apiKey);
      if (!audio) continue;

      const name = fileFor(model, voice, line);
      await Promise.all([
        writeToDb(name, model, voice, line, audio),
        writeToDisk(name, audio),
      ]);
      rendered.push(line);
      stored = true;
      break;
    }

    if (!stored) {
      // Every model refused, which on this tier means the day's allowance is
      // gone. Whatever was rendered is already saved; tomorrow resumes here.
      stoppedOnQuota = true;
      break;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      total: lines.length,
      rendered: rendered.length,
      alreadyCached,
      remaining: lines.length - rendered.length - alreadyCached,
      stoppedOnQuota,
      voice,
    },
  });
}
