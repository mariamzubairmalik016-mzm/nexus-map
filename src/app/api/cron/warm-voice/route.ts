import { NextRequest, NextResponse } from "next/server";

import voicePhrases from "../../../../services/voicePhrases.json";

export const dynamic = "force-dynamic";
// Rendering a handful of lines takes a few seconds each.
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
 * here rather than beside the entry because Vercel rejects any property it
 * does not recognise, including a `//` comment key.
 *
 * Vercel calls this on a schedule shortly after midnight Pacific. It walks the
 * phrase list, asks the speech route for each line *without* `cachedOnly`, and
 * stops at the first quota refusal — the route itself stores whatever it
 * renders in the database, so anything completed is permanent and the next run
 * resumes from where this one stopped.
 */
export async function GET(req: NextRequest) {
  /**
   * Vercel signs its cron calls with CRON_SECRET when the variable is set.
   * Checked when present so the endpoint cannot be used by anyone else to burn
   * the day's quota; left open when it is not, since the job is idempotent and
   * only ever renders a fixed list of phrases.
   */
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const lines = [voicePhrases.greeting, ...voicePhrases.phrases].filter(Boolean);
  const origin = new URL(req.url).origin;

  const rendered: string[] = [];
  const alreadyCached: string[] = [];
  let stoppedOnQuota = false;

  for (const line of lines) {
    // Ask cache-only first: an already-warm line must not cost a request.
    const probe = await fetch(`${origin}/api/ai/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: line, cachedOnly: true }),
    }).catch(() => null);

    if (probe?.status === 200) {
      alreadyCached.push(line);
      continue;
    }

    const full = await fetch(`${origin}/api/ai/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: line }),
    }).catch(() => null);

    if (full?.ok) {
      rendered.push(line);
      continue;
    }

    // 503 means every model refused, which on this tier means the day's quota
    // is gone. Carrying on would just burn time for nothing.
    stoppedOnQuota = true;
    break;
  }

  return NextResponse.json({
    success: true,
    data: {
      rendered: rendered.length,
      alreadyCached: alreadyCached.length,
      remaining: lines.length - rendered.length - alreadyCached.length,
      stoppedOnQuota,
    },
  });
}
