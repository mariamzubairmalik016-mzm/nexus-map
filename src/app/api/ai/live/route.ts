import { NextRequest, NextResponse } from "next/server";
import { chatCompleteJson, ChatMessage } from "../../../../services/llm";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are "Nexus Map Assistant", an advanced voice-activated travel assistant for the Nexus Map application.
If anyone asks who made or created you, you MUST reply exactly: "Nexus Map ne".
You speak directly to the user. Your tone should be helpful, conversational, and natural (as it will be spoken out loud).
You can speak in multiple languages (Urdu, English, etc.) based on the user's language.

IMPORTANT: You can control the website by returning actions!
If the user asks you to set a destination, navigate somewhere, or use the AI planner, you MUST return an action.

Available actions:
1. NAVIGATE: { "type": "NAVIGATE", "url": "/map?place=Islamabad" } (Use this to set a destination on the map or go to any page like /ai-planner, /settings, /offline-maps, etc.)
2. NONE: null (Use this when no navigation is required)

You MUST ALWAYS respond in this exact JSON schema:
{
  "spokenResponse": "Okay, navigating you to the map and setting your destination to Islamabad.",
  "action": {
    "type": "NAVIGATE",
    "url": "/map?place=Islamabad"
  } | null
}

Do not include markdown code fences in your raw response, just the JSON object. Keep your spoken response brief and natural.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history: { role: string; content: string }[] = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ success: false, message: "Message is required." }, { status: 400 });
    }

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map(t => ({ role: (t.role === "user" ? "user" : "assistant") as "user" | "assistant", content: t.content })),
      { role: "user", content: message },
    ];

    const response = await chatCompleteJson<{ spokenResponse: string; action: { type: string; url: string } | null }>(
      messages,
      { maxTokens: 800, temperature: 0.7 }
    );

    if (!response) {
      return NextResponse.json({ 
        success: true, 
        data: { spokenResponse: "I'm having trouble processing that right now. Could you please repeat?", action: null } 
      });
    }

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
