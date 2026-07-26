"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, X } from "lucide-react";

import { useSession } from "next-auth/react";
import { sendChatMessage, type ChatTurn } from "../../services/aiService";

const AIChatbot = () => {
  const { data: session } = useSession();
  const user = session?.user;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  const send = async () => {
    const text = message.trim();
    if (!text || sending) return;

    if (!user) {
      setTurns((current) => [
        ...current,
        { role: "user", content: text },
        { role: "assistant", content: "Please sign in to chat with Nexus AI." },
      ]);
      setMessage("");
      return;
    }

    const history = turns.slice(-8);
    setTurns((current) => [...current, { role: "user", content: text }]);
    setMessage("");
    setSending(true);
    try {
      const { reply } = await sendChatMessage(text, history);
      setTurns((current) => [...current, { role: "assistant", content: reply }]);
    } catch (error) {
      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Sorry, I couldn't respond right now.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[80]">
      {open && (
        <div className="nexus-card-elevated mb-4 w-[min(360px,calc(100vw-32px))] overflow-hidden p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-purple-400/15 to-pink-600/10 p-2 text-purple-300">
                <Bot size={20} />
              </div>
              <div>
                <p className="font-semibold text-white">Nexus AI</p>
                <p className="text-xs text-slate-500">Travel assistant</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 transition-all duration-200 hover:bg-white/[0.05] hover:text-white"
            >
              <X size={19} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="max-h-80 min-h-64 space-y-3 overflow-y-auto p-4"
          >
            {turns.length === 0 && (
              <div className="rounded-2xl bg-white/[0.04] p-4 text-sm leading-6 text-slate-300 border border-white/[0.04]">
                Assalam-o-Alaikum! Ask me about destinations, routes, hotels, hospitals or offline maps.
              </div>
            )}
            {turns.map((turn, index) => (
              <div
                key={index}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  turn.role === "user"
                    ? "ml-auto bg-cyan-500/15 text-cyan-50"
                    : "bg-white/[0.04] text-slate-300 border border-white/[0.04]"
                }`}
              >
                {turn.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-slate-400 border border-white/[0.04]">
                <LoaderCircle size={16} className="animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2 border-t border-white/[0.06] p-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder="Ask Nexus AI..."
              className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 outline-none transition-all duration-200 focus:border-cyan-400/30 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.05)]"
            />
            <button
              onClick={() => void send()}
              disabled={sending}
              className="rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 p-3 text-white shadow-[0_4px_16px_rgba(168,85,247,0.15)] transition-all duration-200 hover:shadow-[0_6px_24px_rgba(168,85,247,0.2)] disabled:opacity-60"
            >
              <Send size={19} />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-500/25 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/30 hover:scale-105"
      >
        <MessageCircle size={29} />
      </button>
    </div>
  );
};

export default AIChatbot;
