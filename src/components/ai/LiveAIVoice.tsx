"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, X, LoaderCircle, AudioLines, MapPin, Map as MapIcon, Route } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Extend window for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type ChatTurn = { role: "user" | "assistant"; content: string };

const LiveAIVoice = () => {
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio();
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = "";
          let isFinal = false;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript;
              isFinal = true;
            } else {
              currentTranscript += event.results[i][0].transcript;
            }
          }
          
          setTranscript(currentTranscript);

          if (isFinal) {
            handleVoiceCommand(currentTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setListening(false);
        };

        recognitionRef.current.onend = () => {
          setListening(false);
        };
      }
    }
    
    return () => {
      stopVoice();
    };
  }, []);

  const handleVoiceCommand = async (text: string) => {
    if (!text.trim() || processing) return;
    
    stopListening();
    setProcessing(true);
    
    const newHistory = [...history.slice(-6), { role: "user" as const, content: text }];
    setHistory(newHistory);
    
    try {
      const response = await fetch("/api/ai/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      
      const { success, data } = await response.json();
      
      if (success && data) {
        setHistory(curr => [...curr, { role: "assistant", content: data.spokenResponse }]);
        
        // Execute Action
        if (data.action?.type === "NAVIGATE" && data.action.url) {
          router.push(data.action.url);
        }
        
        // Speak
        speakResponse(data.spokenResponse);
      } else {
        speakResponse("I'm sorry, something went wrong. Can you repeat that?");
      }
    } catch (e) {
      console.error(e);
      speakResponse("Sorry, I could not connect right now.");
    } finally {
      setProcessing(false);
      setTranscript("");
    }
  };

  const speakResponse = async (text: string) => {
    if (!audioRef.current) return;
    
    // Stop any existing speech
    audioRef.current.pause();
    setSpeaking(true);
    
    try {
      const response = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) throw new Error("TTS failed");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      audioRef.current.src = url;
      audioRef.current.onended = () => {
        setSpeaking(false);
        // Wait half a second before listening again to avoid echoing itself
        setTimeout(() => startListening(), 500);
      };
      
      await audioRef.current.play();
    } catch (err) {
      console.error(err);
      setSpeaking(false);
      startListening();
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !listening && !speaking) {
      try {
        if (audioRef.current) audioRef.current.pause();
        setSpeaking(false);
        recognitionRef.current.start();
        setListening(true);
      } catch (e) {
        console.error("Could not start listening", e);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  const stopVoice = () => {
    stopListening();
    if (audioRef.current) audioRef.current.pause();
    setSpeaking(false);
  };

  const toggleLiveAI = () => {
    if (open) {
      setOpen(false);
      stopVoice();
    } else {
      if (!user) {
        alert("Please sign in to use Live AI.");
        return;
      }
      setOpen(true);
      setHistory([]);
      startListening();
      speakResponse("Hi! I am Nexus Map Assistant. How can I help you today?");
    }
  };

  return (
    <>
      {/* Glow Overlay when open */}
      {open && (
        <div className="pointer-events-none fixed inset-0 z-[70] transition-opacity duration-700">
          <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(34,211,238,0.15)] ring-4 ring-cyan-500/20" />
          {(listening || speaking) && (
            <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(168,85,247,0.2)] animate-pulse ring-4 ring-purple-500/30" />
          )}
          {speaking && (
            <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(236,72,153,0.3)] ring-4 ring-pink-500/40 transition-all duration-300" />
          )}
        </div>
      )}

      {/* Main UI */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[80] w-[min(360px,calc(100vw-32px))] rounded-3xl bg-black/60 p-6 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-6 animate-in slide-in-from-bottom-5 fade-in-0 zoom-in-95">
          <div className="flex w-full justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold tracking-wide text-white uppercase">Live AI</span>
            </div>
            <button
              onClick={toggleLiveAI}
              className="rounded-full bg-white/10 p-2 text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="flex flex-col items-center gap-4 py-4 w-full">
            {/* Visualizer Circle */}
            <div className="relative flex items-center justify-center">
              {speaking ? (
                <div className="absolute inset-0 rounded-full bg-pink-500/30 blur-2xl animate-pulse" />
              ) : listening ? (
                <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-xl animate-pulse" />
              ) : null}
              
              <button 
                onClick={listening ? stopListening : startListening}
                className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-4 shadow-xl transition-all duration-300 hover:scale-105 ${
                  speaking 
                    ? "border-pink-500/50 bg-gradient-to-br from-pink-500/20 to-purple-600/20 shadow-pink-500/20" 
                    : listening
                    ? "border-cyan-500/50 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 shadow-cyan-500/20"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {processing ? (
                  <LoaderCircle className="animate-spin text-cyan-400" size={32} />
                ) : speaking ? (
                  <AudioLines className="text-pink-400 animate-bounce" size={36} />
                ) : listening ? (
                  <Mic className="text-cyan-400 animate-pulse" size={36} />
                ) : (
                  <Mic className="text-slate-400" size={36} />
                )}
              </button>
            </div>
            
            <p className="text-center text-sm font-medium text-slate-300 min-h-10 px-2 line-clamp-2">
              {processing ? "Thinking..." : speaking ? "Nexus Map Assistant is speaking..." : transcript || "Listening... say 'Set destination to Lahore'"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full text-xs font-medium text-slate-400">
            <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => handleVoiceCommand("Take me to the map")}>
              <MapIcon size={16} className="text-cyan-400" />
              View Map
            </div>
            <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => handleVoiceCommand("Make an AI travel plan")}>
              <Route size={16} className="text-purple-400" />
              AI Planner
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      {!open && (
        <button
          onClick={toggleLiveAI}
          className="fixed bottom-5 right-5 z-[80] flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-[0_8px_32px_rgba(236,72,153,0.3)] transition-all duration-300 hover:scale-105 hover:shadow-[0_12px_40px_rgba(236,72,153,0.4)]"
        >
          <AudioLines size={28} />
        </button>
      )}
    </>
  );
};

export default LiveAIVoice;
