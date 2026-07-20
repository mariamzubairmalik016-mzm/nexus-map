import { useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";

const AIChatbot = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="fixed bottom-5 right-5 z-[80]">
      {open && (
        <div className="mb-4 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-400/10 p-2 text-purple-300"><Bot size={20} /></div>
              <div><p className="font-semibold">Nexus AI</p><p className="text-xs text-slate-500">Travel assistant</p></div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400"><X size={19} /></button>
          </div>
          <div className="min-h-64 p-4">
            <div className="rounded-2xl bg-white/5 p-4 text-sm leading-6 text-slate-300">
              Assalam-o-Alaikum! Ask me about destinations, routes, hotels, hospitals or offline maps.
            </div>
          </div>
          <div className="flex gap-2 border-t border-white/10 p-3">
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask Nexus AI..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
            <button onClick={() => setMessage("")} className="rounded-xl bg-purple-500 p-3"><Send size={19} /></button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((value) => !value)} className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-500/25">
        <MessageCircle size={29} />
      </button>
    </div>
  );
};

export default AIChatbot;
