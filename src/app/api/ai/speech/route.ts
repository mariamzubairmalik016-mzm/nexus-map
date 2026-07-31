import { NextRequest } from "next/server";

import { buildBrain } from "../../../../services/liveBrain";

/**
 * Speech to speech, one turn at a time.
 *
 * The old path was three hops: the browser transcribed, `/api/ai/live` thought,
 * and `/api/ai/tts` spoke. The last hop is what broke — Gemini's speech models
 * allow ten requests per day per model per project, so the assistant fell back
 * to the browser's robotic voice for the rest of the day once those were gone,
 * which is what "it isn't speaking" actually was.
 *
 * The native-audio models take audio in and give audio out, and are metered
 * separately from the TTS models. One model both thinks and speaks, so there is
 * no second hop to run out of, and no transcription step to mangle a place name
 * before the model ever sees it.
 *
 * WHY A SERVER PROXY AND NOT A DIRECT BROWSER SOCKET
 * The Live API is a WebSocket, and the browser is the natural place to hold it
 * — that is what ephemeral tokens exist for. They mint on this project (the
 * field is `bidiGenerateContentSetup`, not the documented
 * `liveConnectConstraints`) but the socket rejects them: close 1007, "API key
 * not valid", on both v1beta and v1alpha. So the key has to stay here.
 *
 * That rules out holding a socket open for a whole conversation, because only
 * the Next app is deployed — `backend/server.mjs` is a dev-only Express process
 * — and a serverless function cannot hold one. So this takes a single turn,
 * opens a socket for it, and streams the reply back as it arrives. The user
 * hears the first syllable while the rest is still being generated, which is
 * the part of a live session that actually matters; what is lost is talking
 * over the assistant mid-sentence.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A turn measured at 6.5s end to end; the ceiling is for a long answer. */
export const maxDuration = 60;

/** Speech in is 16 kHz mono PCM; speech out is 24 kHz. Both are fixed by the API. */
const INPUT_RATE = 16000;
export const OUTPUT_RATE = 24000;

const MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-latest";
const VOICE = process.env.GEMINI_TTS_VOICE || "Charon";

const WS_URL = (key: string) =>
  "wss://generativelanguage.googleapis.com/ws/" +
  "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent" +
  `?key=${key}`;

/**
 * The one tool the model gets.
 *
 * It deliberately does not mirror the twelve-member `VoiceAction` union. The
 * app already has a component that turns a sentence into a resolved, geocoded
 * action — `/api/ai/live` — and duplicating that switch here would mean two
 * copies of the confirmation rules for hazard reports and SOS, which are the
 * two things that must never fire by accident. So the model hands over a
 * sentence and the existing brain resolves it, exactly as it does for typed
 * input.
 */
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "runAppCommand",
        description:
          "Make the Nexus Map app do something: draw or start a route, search for a place, " +
          "find tourist places, plan a trip, open a page, scroll, press a button, report a " +
          "road hazard, or raise an SOS. Pass the user's request in their own words.",
        parameters: {
          type: "OBJECT",
          properties: {
            command: {
              type: "STRING",
              description:
                "What the user asked, in their own words and their own language. " +
                'For example: "Lahore se Islamabad ka route banao".',
            },
          },
          required: ["command"],
        },
      },
    ],
  },
];

/**
 * `heard` and `said` are separate events, not one "text".
 *
 * They were emitted under a single type at first, which concatenated the user's
 * words and the assistant's into one string — unusable for either purpose. The
 * browser needs them apart: `heard` is what goes into the history and, when the
 * model declines to call the tool, what gets handed to the action resolver;
 * `said` is the caption under the assistant.
 */
type Event =
  | { type: "audio"; data: string }
  | { type: "heard"; text: string }
  | { type: "said"; text: string }
  | { type: "command"; command: string; id: string }
  | { type: "error"; message: string }
  | { type: "done" };

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_LIVE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response("Gemini API key not configured", { status: 500 });
  }

  /**
   * Said plainly rather than thrown.
   *
   * `WebSocket` is a global only from Node 22. On anything older this route
   * fails with a bare ReferenceError from inside a stream, which reaches the
   * browser as a dead connection and reads like a network fault — the build
   * having passed cleanly, since the reference is perfectly valid TypeScript.
   * `engines` in package.json pins the runtime; this is what explains it if
   * that is ever overridden in project settings.
   */
  if (typeof WebSocket === "undefined") {
    return new Response(
      "This runtime has no WebSocket global — the speech route needs Node 22 or newer.",
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);

  /**
   * A turn is either speech or text.
   *
   * Speech is the point, but text costs nothing to support and is what makes
   * this testable without a microphone — and what the assistant falls back to
   * if `getUserMedia` is refused.
   */
  const audioBase64 = typeof body?.audio === "string" ? body.audio : null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  /**
   * Read this line out, and nothing else.
   *
   * This is the mode that actually fixes the assistant, and it does so by
   * asking the native-audio model for less rather than more.
   *
   * Letting it run the conversation was the obvious design and it does work —
   * it hears, thinks, answers and calls tools. But it called the tool on only
   * about half the action requests: it would say "لاہور سے اسلام آباد کا روٹ بنا
   * رہا ہوں" and leave the app sitting there, which is a worse failure than a
   * robotic voice, because it sounds like success.
   *
   * The app already has a component that turns a sentence into a resolved
   * action reliably, and it was never the broken part. So the split is by
   * competence: `/api/ai/live` keeps deciding and doing, and this model is
   * asked only to speak — a job with no tool call in it to miss. What it
   * replaces is `/api/ai/tts`, whose ten-a-day cap is the whole reason the
   * assistant fell silent.
   */
  const speak = typeof body?.speak === "string" ? body.speak.trim() : "";

  /**
   * Prior turns, replayed so the session has a memory.
   *
   * Each request opens a fresh socket, so nothing carries over on its own — the
   * assistant would forget the destination between "Skardu" and "five days".
   * Text, not audio: the transcripts are what the model needs, and re-uploading
   * the audio of every previous turn would grow each request without bound.
   */
  const history = Array.isArray(body?.history)
    ? body.history
        .filter(
          (turn: unknown): turn is { role: string; text: string } =>
            !!turn &&
            typeof (turn as { text?: unknown }).text === "string" &&
            ((turn as { role?: unknown }).role === "user" ||
              (turn as { role?: unknown }).role === "model"),
        )
        .slice(-12)
        .map((turn: { role: string; text: string }) => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        }))
    : [];

  /**
   * The result of an action the browser already carried out.
   *
   * A turn that ends in a tool call cannot be finished in the same request:
   * only the browser can route, scroll or press a button. So it runs the
   * action, then calls back with what happened, and the model speaks the
   * confirmation on this second pass.
   *
   * Reported as text, not as a `toolResponse`. A response only means anything
   * to the session that made the call, and this is a new socket with no memory
   * of it — answering a call it never made produced exactly nothing: a turn
   * that closed in 15ms having said not one word. So the outcome is narrated
   * into the fresh session instead, which it can act on because it is simply
   * part of the conversation.
   */
  const toolResult =
    body?.toolResult && typeof body.toolResult.result === "string"
      ? String(body.toolResult.result)
      : null;

  /**
   * Three shapes of turn, not two. Reporting an action back is a turn in its
   * own right and carries neither audio nor text — requiring one of those
   * rejected every follow-up with a 400, so the assistant announced what it was
   * about to do and then never confirmed it had.
   */
  if (!audioBase64 && !text && !toolResult && !speak) {
    return new Response("One of speak, audio, text or toolResult is required", { status: 400 });
  }

  /**
   * A reader gets no brain and no tools.
   *
   * The catalogue and the acting rules are there to help it decide, and it has
   * nothing to decide — that already happened. Handing it the full instruction
   * only invites it to improvise on a line that was chosen deliberately, and
   * the tools invite a call that would fire an action twice.
   */
  const brain = speak
    ? "You are a voice actor. Read the user's line aloud exactly as written, in " +
      "the language and script it is written in, the way a real man speaks to a " +
      "friend — warm, relaxed, natural pace. Do not translate it, answer it, " +
      "add to it, or comment on it. Say only that line."
    : await buildBrain();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      /** Newline-delimited JSON: the browser can act on each event as it lands. */
      const emit = (event: Event) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const finish = (note?: string) => {
        if (closed) return;
        if (note) emit({ type: "error", message: note });
        emit({ type: "done" });
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by an abort — nothing to do.
        }
      };

      /** Pending close after a completed turn — see the turnComplete handler. */
      let settling: ReturnType<typeof setTimeout> | null = null;

      let socket: WebSocket;
      try {
        socket = new WebSocket(WS_URL(apiKey));
      } catch (error) {
        finish(`Could not open the speech session: ${(error as Error).message}`);
        return;
      }

      /**
       * A hung socket must not hold the function open to `maxDuration`.
       * Whatever audio has arrived by then has already been sent and played.
       */
      const guard = setTimeout(() => {
        try {
          socket.close();
        } catch {
          /* already gone */
        }
        finish("The assistant took too long to answer.");
      }, 45_000);

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            setup: {
              model: `models/${MODEL}`,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
                },
              },
              systemInstruction: { parts: [{ text: brain }] },
              ...(speak ? {} : { tools: TOOLS }),
              /**
               * Transcripts of both sides.
               *
               * The browser needs the user's words to keep a history across
               * requests, and the assistant's own words to show captions — and
               * neither is otherwise recoverable, since the payload is audio.
               */
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          }),
        );
      };

      socket.onmessage = async (event) => {
        let message: Record<string, any>;
        try {
          const raw =
            typeof event.data === "string" ? event.data : await (event.data as Blob).text();
          message = JSON.parse(raw);
        } catch {
          return;
        }

        if (message.setupComplete) {
          if (speak) {
            socket.send(
              JSON.stringify({
                clientContent: {
                  turns: [{ role: "user", parts: [{ text: speak }] }],
                  turnComplete: true,
                },
              }),
            );
            return;
          }

          if (toolResult) {
            socket.send(
              JSON.stringify({
                clientContent: {
                  turns: [
                    ...history,
                    {
                      role: "user",
                      parts: [
                        {
                          text:
                            `[The app has just carried out the request. Result: ${toolResult}] ` +
                            "Tell me what happened in one short sentence, in the language I " +
                            "was speaking. Do not call any tool.",
                        },
                      ],
                    },
                  ],
                  turnComplete: true,
                },
              }),
            );
            return;
          }

          if (history.length) {
            socket.send(JSON.stringify({ clientContent: { turns: history, turnComplete: false } }));
          }

          if (audioBase64) {
            socket.send(
              JSON.stringify({
                realtimeInput: {
                  audio: { mimeType: `audio/pcm;rate=${INPUT_RATE}`, data: audioBase64 },
                },
              }),
            );
            // Without this the model waits for more speech that is never coming.
            socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
          } else {
            socket.send(
              JSON.stringify({
                clientContent: {
                  turns: [{ role: "user", parts: [{ text }] }],
                  turnComplete: true,
                },
              }),
            );
          }
          return;
        }

        if (message.toolCall) {
          for (const call of message.toolCall.functionCalls ?? []) {
            if (call.name !== "runAppCommand") continue;
            emit({
              type: "command",
              command: String(call.args?.command ?? ""),
              id: String(call.id ?? ""),
            });
          }
          // The browser has to run it; this turn ends here and the answer
          // arrives on the follow-up request carrying `toolResult`.
          if (settling) clearTimeout(settling);
          clearTimeout(guard);
          try {
            socket.close();
          } catch {
            /* already gone */
          }
          finish();
          return;
        }

        const content = message.serverContent;
        if (!content) return;

        for (const part of content.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) emit({ type: "audio", data: part.inlineData.data });
        }

        const spoken = content.outputTranscription?.text;
        if (spoken) emit({ type: "said", text: spoken });

        const heard = content.inputTranscription?.text;
        if (heard) emit({ type: "heard", text: heard });

        /**
         * A finished turn is not necessarily a finished exchange.
         *
         * The model speaks first and calls the tool afterwards, so `toolCall`
         * regularly arrives after `turnComplete`. Closing on `turnComplete`
         * therefore dropped the call perhaps half the time — the assistant said
         * "Karachi se Lahore ka route bana raha hoon" and the app did nothing,
         * which looks exactly like a model that failed to call the tool and is
         * really a socket hung up too early.
         *
         * So a completed turn starts a short wait rather than ending things.
         * A call that lands inside it is handled and closes the turn at once;
         * silence closes it a moment later.
         */
        if (content.turnComplete || content.generationComplete) {
          if (settling) return;
          settling = setTimeout(() => {
            clearTimeout(guard);
            try {
              socket.close();
            } catch {
              /* already gone */
            }
            finish();
          }, 1200);
        }
      };

      socket.onerror = () => {
        clearTimeout(guard);
        finish("The speech session failed.");
      };

      socket.onclose = (event) => {
        clearTimeout(guard);
        if (settling) clearTimeout(settling);
        if (closed || event.code === 1000) {
          finish();
          return;
        }
        /**
         * 1011 is Google's own internal error, and it is not rare: about one
         * turn in five closed this way mid-test, having said nothing at all.
         * It is transient — the identical request succeeds moments later — so
         * it is reported as retryable rather than as a failure, and the browser
         * asks again instead of dropping to the robotic fallback voice for
         * something that was never the user's fault.
         */
        emit({
          type: "error",
          message:
            event.code === 1011
              ? "retryable: the speech service faulted mid-turn"
              : `Session closed (${event.code}).`,
        });
        finish();
      };

      req.signal.addEventListener("abort", () => {
        clearTimeout(guard);
        try {
          socket.close();
        } catch {
          /* already gone */
        }
        closed = true;
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Nexus-Live-Model": MODEL,
      "X-Nexus-Audio-Rate": String(OUTPUT_RATE),
    },
  });
}
