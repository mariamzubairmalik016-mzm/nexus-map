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

export const llmAvailable = () => !!process.env.GEMINI_API_KEY;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Ask the Gemini model natively.
 */
export const chatComplete = async (
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[llm] GEMINI_API_KEY is missing.");
    return null;
  }

  // Convert messages to Gemini format
  let systemInstruction: any = undefined;
  const contents: any[] = [];
  
  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      });
    }
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: options.maxTokens ?? 800,
          temperature: options.temperature ?? 0.7,
        }
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[llm] Gemini API error:", response.status, errText);
      return null;
    }

    const payload = await response.json();
    const reply = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (typeof reply === "string" && reply.trim()) {
      return reply.trim();
    }
  } catch (error) {
    console.error("[llm] Gemini request failed:", error);
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
