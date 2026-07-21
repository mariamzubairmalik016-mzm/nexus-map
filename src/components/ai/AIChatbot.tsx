import { useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, X } from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import { sendChatMessage, type ChatTurn } from "../../services/aiService";

const AIChatbot = () => {
  const { user } = useAuth();
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
        <div className="mb-4 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-400/10 p-2 text-purple-300"><Bot size={20} /></div>
              <div>
                <p className="font-semibold">Nexus AI</p>
                <p className="text-xs text-slate-500">Travel assistant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400"><X size={19} /></button>
          </div>

          <div ref={scrollRef} className="max-h-80 min-h-64 space-y-3 overflow-y-auto p-4">
            {turns.length === 0 && (
              <div className="rounded-2xl bg-white/5 p-4 text-sm leading-6 text-slate-300">
                Assalam-o-Alaikum! Ask me about destinations, routes, hotels, hospitals or offline maps.
              </div>
            )}
            {turns.map((turn, index) => (
              <div
                key={index}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  turn.role === "user"
                    ? "ml-auto bg-cyan-500/15 text-cyan-50"
                    : "bg-white/5 text-slate-300"
                }`}
              >
                {turn.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-400">
                <LoaderCircle size={16} className="animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-white/10 p-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder="Ask Nexus AI..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
            />
            <button onClick={() => void send()} disabled={sending} className="rounded-xl bg-purple-500 p-3 disabled:opacity-60">
              <Send size={19} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-500/25"
      >
        <MessageCircle size={29} />
      </button>
    </div>
  );
};

export default AIChatbot;
