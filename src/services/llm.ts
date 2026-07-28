/**
 * Chat-completion provider.
 *
 * Both OpenAI and OpenRouter speak the same request shape, so one client
 * covers either. Whichever key is present wins; OpenRouter is preferred when
 * both exist, because the OpenAI account this project was given has no quota
 * (every completion returns 429 "exceeded your current quota").
 *
 * Two things make a single hardcoded model call unreliable here:
 *
 *   1. OpenRouter's free tier is rate-limited *upstream*. `gemma-4-31b-it:free`
 *      answers, then returns 429 "temporarily rate-limited upstream" from
 *      Google AI Studio minutes later.
 *   2. Free models frequently reject `response_format: json_object` with
 *      "Provider returned error", so JSON cannot be requested structurally.
 *
 * So: try each model in turn, and extract JSON from the text rather than
 * relying on the provider to enforce it. Callers get null when everything
 * fails and fall back to their own deterministic output.
 */

type Provider = { url: string; key: string; models: string[]; headers: Record<string, string> };

/** Free OpenRouter models, best-behaved first. */
const OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  // Reasoning-style models are last: they tend to narrate their thinking into
  // the response, which is wrong for user-facing copy.
  "nvidia/nemotron-3-super-120b-a12b:free",
];

const resolveProvider = (): Provider | null => {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    const configured = process.env.OPENROUTER_MODEL;
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: openRouterKey,
      models: configured ? [configured, ...OPENROUTER_MODELS] : OPENROUTER_MODELS,
      // OpenRouter asks for these to attribute traffic; harmless if unset.
      headers: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "Nexus Map",
      },
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      key: openAiKey,
      models: [process.env.OPENAI_MODEL || "gpt-4o-mini"],
      headers: {},
    };
  }

  return null;
};

export const llmAvailable = () => resolveProvider() !== null;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Ask the model. Returns the reply text, or null if no provider is configured
 * and/or every model failed.
 */
export const chatComplete = async (
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> => {
  const provider = resolveProvider();
  if (!provider) return null;

  for (const model of provider.models) {
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.key}`,
          "Content-Type": "application/json",
          ...provider.headers,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options.maxTokens ?? 500,
          temperature: options.temperature ?? 0.6,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        // 429 on a free model means "try the next one", not "give up".
        console.warn(`[llm] ${model} -> ${response.status}; trying next model.`);
        continue;
      }

      const payload = await response.json();
      // OpenRouter reports upstream provider failures in the body with a 200.
      if (payload?.error) {
        console.warn(`[llm] ${model} -> ${String(payload.error?.message).slice(0, 80)}; trying next model.`);
        continue;
      }

      const reply = payload?.choices?.[0]?.message?.content;
      if (typeof reply === "string" && reply.trim()) return reply.trim();
    } catch (error) {
      console.warn(`[llm] ${model} request failed; trying next model.`, error);
    }
  }

  return null;
};

/**
 * Ask for JSON and parse it.
 *
 * `response_format` is deliberately not sent — free models reject it outright.
 * The prompt asks for JSON and the first balanced object is extracted from the
 * reply, which also survives a model that wraps output in ``` fences.
 */
export const chatCompleteJson = async <T>(
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<T | null> => {
  const raw = await chatComplete(messages, options);
  if (!raw) return null;

  const fenced = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const match = fenced.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
};
