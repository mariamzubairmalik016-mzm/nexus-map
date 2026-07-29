/**
 * Chat-completion provider — Gemini, called natively.
 *
 * OpenRouter was dropped because its free tier is rate-limited *upstream*: a
 * model answers, then returns 429 "temporarily rate-limited upstream" from
 * Google AI Studio minutes later. Talking to Google directly removes that
 * middle layer.
 *
 * A single hardcoded model is still not enough — the free tier caps requests
 * per model per day, so one model running dry must not take the assistant
 * down with it. Each model in `MODELS` is tried in turn and the first that
 * answers wins.
 */

export const llmAvailable = () => !!process.env.GEMINI_API_KEY;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Tried in order. 3.1-flash-lite leads: it is the fastest model that still
 * follows a strict JSON contract, which matters when every reply has to be
 * spoken back within a second or two. The rest are same-shape stand-ins for
 * when its daily quota is gone.
 */
const MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

type Options = {
  maxTokens?: number;
  temperature?: number;
  /** Ask Gemini for structured JSON instead of scraping it out of prose. */
  json?: boolean;
};

/** One attempt against one model. Returns null so the caller can try the next. */
const ask = async (
  model: string,
  contents: unknown[],
  systemInstruction: unknown,
  options: Options,
  apiKey: string,
): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            maxOutputTokens: options.maxTokens ?? 800,
            temperature: options.temperature ?? 0.7,
            ...(options.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: AbortSignal.timeout(25_000),
      },
    );

    if (!response.ok) {
      console.warn(`[llm] ${model} → ${response.status}: ${(await response.text()).slice(0, 200)}`);
      return null;
    }

    const payload = await response.json();
    const parts = payload?.candidates?.[0]?.content?.parts;
    // Reasoning models emit thought parts alongside the answer; join the text
    // ones rather than assuming the answer is at index 0.
    const reply = Array.isArray(parts)
      ? parts.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("")
      : "";

    return reply.trim() || null;
  } catch (error) {
    console.warn(`[llm] ${model} failed:`, (error as Error).message);
    return null;
  }
};

/** Ask Gemini, falling through the model chain until one answers. */
export const chatComplete = async (
  messages: ChatMessage[],
  options: Options = {},
): Promise<string | null> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[llm] GEMINI_API_KEY is missing.");
    return null;
  }

  let systemInstruction: unknown = undefined;
  const contents: unknown[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemInstruction = { parts: [{ text: message.content }] };
    } else {
      contents.push({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      });
    }
  }

  for (const model of MODELS) {
    const reply = await ask(model, contents, systemInstruction, options, apiKey);
    if (reply) return reply;
  }

  return null;
};

/**
 * Ask for JSON and parse it.
 *
 * `responseMimeType: application/json` is requested, but the first balanced
 * object is still extracted from the reply — a fallback model in the chain may
 * ignore the mime type and wrap its answer in ``` fences.
 */
export const chatCompleteJson = async <T>(
  messages: ChatMessage[],
  options: Options = {},
): Promise<T | null> => {
  const raw = await chatComplete(messages, { ...options, json: true });
  if (!raw) return null;

  const unfenced = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    return JSON.parse(unfenced) as T;
  } catch {
    // Not clean JSON — fall back to the first balanced object in the text.
  }

  const match = unfenced.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
};
