import { api } from "./api";

export type ChatTurn = { role: "user" | "assistant"; content: string };

// Chat is proxied through the Express backend — the OpenAI key never reaches
// the browser.
export const sendChatMessage = (message: string, history: ChatTurn[]) =>
  api.post<{ reply: string }>("/ai/chat", { message, history });
