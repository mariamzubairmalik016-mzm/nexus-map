"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, X, LoaderCircle, AudioLines, Map as MapIcon, Route } from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import {
  executeVoiceAction,
  needsConfirmation,
  sameAction,
  type VoiceAction,
} from "../../services/voiceActions";
// Shared with scripts/warm-voice-cache.mjs, which pre-renders these lines. The
// text must match that file exactly or the pre-rendered audio is never found.
import voicePhrases from "../../services/voicePhrases.json";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * The Web Speech API needs its language *before* it hears anything, so it
 * cannot detect one on its own — set it to English and Urdu speech comes back
 * as nonsense. The model, which does know, reports the language of every turn,
 * and the recogniser is retuned for the next one.
 *
 * That leaves the very first sentence of a session, which is heard in whatever
 * language was last used on this device (or the browser's own). Remembering it
 * means a user who speaks Urdu is understood from their first word on every
 * visit after the first.
 */
const LANGUAGE_KEY = "nexus.voice.lang";

const rememberLanguage = (language: string) => {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    /* private browsing — the session still works, it just will not be remembered */
  }
};

const recalledLanguage = (): string => {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (saved) return saved;
  } catch {
    /* unavailable */
  }
  return navigator.language || "en-US";
};

/**
 * Phones need the recogniser driven differently from desktops.
 *
 * On Android Chrome and iOS Safari `continuous = true` is unreliable: the
 * engine stops after the first utterance anyway, and on some builds asking for
 * continuous capture makes it refuse to start at all — which is what "the mic
 * gets blocked on phones" looks like from the outside. One utterance at a time,
 * restarted deliberately, is what actually works.
 */
const isMobile = () =>
  typeof navigator !== "undefined" &&
  (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, but a Mac has no touch screen.
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

/**
 * How long to wait before restarting the recogniser after it stops.
 *
 * Restarting instantly on a phone races the audio session teardown and throws;
 * a beat of breathing room makes it reliable.
 */
const RESTART_DELAY_MS = 500;
const RESTART_DELAY_MOBILE_MS = 900;

/** Give up relaunching the mic after this many consecutive failures. */
const MAX_RESTART_FAILURES = 4;

const GREETING = voicePhrases.greeting;

/** Kept identical to the entries in voicePhrases.json so they play from cache. */
const COULD_NOT_CLICK = "I couldn't find that button on this screen.";
const NO_SERVER = "I can't reach the server right now.";
const SAY_AGAIN = "Sorry, I didn't catch that. Could you say that again?";

const LiveAIVoice = () => {
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  /** Shown when the mic will not open, so the panel explains itself rather than sitting silent. */
  const [micBlocked, setMicBlocked] = useState(false);

  const mobileRef = useRef(false);
  const restartFailuresRef = useRef(0);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const langRef = useRef("en-US");
  /**
   * Identifies this conversation to the speech endpoint, which pins one model
   * per session. Without it a daily quota resetting mid-chat would switch the
   * assistant to a different model and its voice would audibly change between
   * one sentence and the next.
   */
  const sessionRef = useRef<string>("");
  /**
   * The consequential action offered on the previous turn.
   *
   * Submitting only ever happens when the model repeats an action it already
   * offered, so a single misheard sentence can never publish a road alert or
   * raise an SOS on its own. This is enforced here rather than left to the
   * prompt: the model deciding to skip its own confirmation step must not be
   * enough to send something to other people.
   */
  const pendingRef = useRef<VoiceAction | null>(null);

  // State the recogniser callbacks need to read. They are registered once and
  // would otherwise close over the values from first render forever.
  const openRef = useRef(false);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const processingRef = useRef(false);
  const historyRef = useRef<ChatTurn[]>([]);
  const pathnameRef = useRef(pathname);
  const handleRef = useRef<(text: string) => void>(() => {});

  pathnameRef.current = pathname;
  historyRef.current = history;

  const setOpenState = (value: boolean) => {
    openRef.current = value;
    setOpen(value);
  };
  const setListeningState = (value: boolean) => {
    listeningRef.current = value;
    setListening(value);
  };
  const setSpeakingState = (value: boolean) => {
    speakingRef.current = value;
    setSpeaking(value);
  };
  const setProcessingState = (value: boolean) => {
    processingRef.current = value;
    setProcessing(value);
  };

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    // Never listen while the assistant is talking: without echo cancellation
    // the mic hears the speaker and the assistant answers itself in a loop.
    if (listeningRef.current || speakingRef.current || processingRef.current) return;
    if (!openRef.current) return;

    try {
      recognition.lang = langRef.current;
      recognition.start();
      setListeningState(true);
      restartFailuresRef.current = 0;
    } catch (error: any) {
      // "already started" is benign — the recogniser is in the state we wanted.
      if (error?.name === "InvalidStateError") {
        setListeningState(true);
        return;
      }

      if (error?.name === "NotAllowedError" || error?.message?.includes("not allowed")) {
        toast.error("Microphone access blocked. Allow mic access in your browser settings.");
        setMicBlocked(true);
        return;
      }

      // Phones throw here when the audio session has not finished tearing down
      // from the reply that just played. Backing off and trying again is the
      // difference between a working mic and one that never comes back.
      restartFailuresRef.current += 1;
      if (restartFailuresRef.current <= MAX_RESTART_FAILURES) {
        setTimeout(() => startListening(), 400 * restartFailuresRef.current);
      } else {
        setMicBlocked(true);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    setListeningState(false);
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  /**
   * Speak a line, then hand the mic back.
   *
   * Gemini's voice is the whole point, so the browser's SpeechSynthesis is only
   * a last resort — it is the flat robotic voice, and reaching it means the
   * `/api/ai/tts` chain ran out of every model.
   */
  const speakResponse = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Flag first, then stop: `recognition.onend` restarts the mic unless it
      // can see that the assistant is about to talk.
      setSpeakingState(true);
      stopListening();

      const audio = audioRef.current;
      if (audio) audio.pause();
      synthRef.current?.cancel();

      const done = () => {
        setSpeakingState(false);
        // Gap so the tail of the reply does not land in the next capture, and
        // so a phone has time to release the audio session before the mic
        // claims it.
        setTimeout(
          () => startListening(),
          mobileRef.current ? RESTART_DELAY_MOBILE_MS : 350,
        );
      };

      try {
        const response = await fetch("/api/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, session: sessionRef.current }),
        });

        if (!response.ok) throw new Error(`TTS ${response.status}`);

        const blob = await response.blob();
        if (!blob.size) throw new Error("empty audio");

        const url = URL.createObjectURL(blob);
        if (!audio) throw new Error("no audio element");

        audio.src = url;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          done();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          done();
        };

        await audio.play();
      } catch (error) {
        console.warn("[voice] Gemini TTS unavailable, using browser voice:", error);

        const synth = synthRef.current;
        if (!synth) {
          done();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langRef.current;
        utterance.rate = 0.98;
        utterance.pitch = 0.85; // Drop it toward a male range.

        // Getting the language right matters more than getting a male voice:
        // an English voice reading Urdu is unintelligible, whereas a female
        // voice reading Urdu is merely not what was asked for. So filter by
        // language first, and only then prefer a male speaker within it.
        const voices = synth.getVoices();
        const base = langRef.current.split("-")[0];
        const sameLanguage = voices.filter((voice) => voice.lang.split("-")[0] === base);
        const pool = sameLanguage.length ? sameLanguage : voices;

        const chosen =
          pool.find((voice) => /daniel|alex|rishi|google uk english male/i.test(voice.name)) ??
          pool.find((voice) => /male/i.test(voice.name)) ??
          pool[0];
        if (chosen) utterance.voice = chosen;

        utterance.onend = done;
        utterance.onerror = done;
        synth.speak(utterance);
      }
    },
    [startListening, stopListening],
  );

  /**
   * Sends a confirmed action to the API it belongs to.
   *
   * Runs in the browser rather than in `/api/ai/live` because these endpoints
   * act as the signed-in user, and it is the browser that holds that session.
   * Returns what to say about the outcome, so a failure is spoken rather than
   * swallowed — believing a hazard warning went out when it did not is worse
   * than being told it failed.
   */
  const submitAction = useCallback(async (action: VoiceAction): Promise<string | null> => {
    const position = locationRef.current;
    if (!position) return "I couldn't get your location, so I haven't sent anything.";

    try {
      if (action.type === "REPORT_ALERT") {
        const response = await fetch("/api/road-alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: action.alertType,
            severity: action.severity,
            description: action.description,
            latitude: position.latitude,
            longitude: position.longitude,
          }),
        });
        if (response.status === 401) return "You'll need to sign in before you can report a hazard.";
        if (!response.ok) return "That didn't go through. Want me to try again?";
        return null;
      }

      if (action.type === "SOS") {
        const response = await fetch("/api/sos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: position.latitude,
            longitude: position.longitude,
            message: action.message,
          }),
        });
        if (response.status === 401) return "You'll need to sign in before you can raise an SOS.";
        if (!response.ok) return "The SOS didn't go through. Try the SOS button on the safety page.";
        return null;
      }
    } catch {
      return "I couldn't reach the server, so nothing was sent.";
    }

    return null;
  }, []);

  const handleVoiceCommand = useCallback(
    async (text: string) => {
      const spoken = text.trim();
      if (!spoken || processingRef.current) return;

      setProcessingState(true);
      stopListening();
      setTranscript(spoken);

      const priorHistory = historyRef.current;
      setHistory([...priorHistory, { role: "user", content: spoken }]);

      try {
        const response = await fetch("/api/ai/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: spoken,
            history: priorHistory.slice(-8),
            location: locationRef.current,
            page: pathnameRef.current,
            pending: pendingRef.current,
          }),
        });

        const payload = await response.json();
        const data = payload?.data as
          | {
              spokenResponse: string;
              language: string | null;
              action: VoiceAction | null;
              submit?: boolean;
            }
          | undefined;

        if (!payload?.success || !data?.spokenResponse) {
          setProcessingState(false);
          await speakResponse(SAY_AGAIN);
          return;
        }

        setHistory((current) => [...current, { role: "assistant", content: data.spokenResponse }]);

        if (data.language && data.language !== langRef.current) {
          langRef.current = data.language;
          rememberLanguage(data.language);
        }

        const action = data.action ?? null;
        let failure: string | null = null;

        if (needsConfirmation(action)) {
          // `submit` comes from the server, which knows what was offered last
          // turn. `sameAction` is checked again here so a stray flag cannot
          // send something other than what this browser actually offered.
          if (data.submit && sameAction(pendingRef.current, action)) {
            pendingRef.current = null;
            failure = await submitAction(action!);
          } else {
            pendingRef.current = action;
          }
        } else {
          // Anything else means the moment has passed — an offer the user
          // ignored or declined must not stay armed.
          pendingRef.current = null;
          const performed = executeVoiceAction(action, router);
          if (action?.type === "CLICK" && !performed) failure = COULD_NOT_CLICK;
        }

        setProcessingState(false);

        // Speak the failure instead of the model's line: it said the hazard was
        // reported, and the user has no other way to find out it was not.
        await speakResponse(failure ?? data.spokenResponse);
      } catch (error) {
        console.error("[voice]", error);
        setProcessingState(false);
        await speakResponse(NO_SERVER);
      } finally {
        setTranscript("");
      }
    },
    [router, speakResponse, stopListening, submitAction],
  );

  handleRef.current = handleVoiceCommand;

  useEffect(() => {
    if (typeof window === "undefined") return;

    mobileRef.current = isMobile();

    const audio = new Audio();
    // Without this iOS takes the audio full-screen, throwing the user out of
    // the map they are being navigated around.
    audio.setAttribute("playsinline", "true");
    audio.preload = "auto";
    audioRef.current = audio;

    synthRef.current = window.speechSynthesis;
    langRef.current = recalledLanguage();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    // See `isMobile` — continuous capture is what jams the mic on phones.
    recognition.continuous = !mobileRef.current;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = langRef.current;

    recognition.onresult = (event: any) => {
      let text = "";
      let final = false;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        text += event.results[index][0].transcript;
        if (event.results[index].isFinal) final = true;
      }

      setTranscript(text);
      if (final) handleRef.current(text);
    };

    recognition.onerror = (event: any) => {
      // "no-speech" and "aborted" fire constantly in a hands-free session and
      // mean nothing — only stop for errors that actually end the session.
      if (event.error === "no-speech" || event.error === "aborted") return;

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("Microphone access blocked. Allow mic access in your browser settings.");
        setMicBlocked(true);
        setListeningState(false);
        return;
      }

      // Mobile networks drop the recogniser's own connection regularly. It is
      // transient, and closing the assistant over it would be maddening — let
      // `onend` bring the mic back.
      if (event.error === "network") {
        setListeningState(false);
        return;
      }

      setListeningState(false);
    };

    // Recognition ends on its own after a stretch of silence — always on
    // mobile, and on desktop Chrome too despite `continuous`. Restarting is
    // what makes the session hands-free.
    recognition.onend = () => {
      setListeningState(false);
      if (openRef.current && !speakingRef.current && !processingRef.current) {
        setTimeout(
          () => startListening(),
          mobileRef.current ? RESTART_DELAY_MOBILE_MS : RESTART_DELAY_MS,
        );
      }
    };

    recognitionRef.current = recognition;

    return () => {
      openRef.current = false;
      try {
        recognition.abort();
      } catch {
        /* not running */
      }
      audioRef.current?.pause();
      synthRef.current?.cancel();
    };
  }, [startListening]);

  /** Position, so "nearest petrol pump" resolves near the user rather than a default. */
  useEffect(() => {
    if (!open || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        locationRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }, [open]);

  const closeAssistant = () => {
    setOpenState(false);
    stopListening();
    audioRef.current?.pause();
    synthRef.current?.cancel();
    setSpeakingState(false);
    setProcessingState(false);
    setTranscript("");
  };

  const toggleLiveAI = () => {
    if (open) {
      closeAssistant();
      return;
    }

    if (!user) {
      toast.error("Please sign in to use Live AI.");
      return;
    }

    if (!recognitionRef.current) {
      toast.error("Voice input isn't supported in this browser. Try Chrome or Safari.");
      return;
    }

    // iOS Safari only allows audio that starts inside a user gesture, so both
    // engines are unlocked here, on the tap that opens the assistant.
    if (synthRef.current) {
      const silent = new SpeechSynthesisUtterance(" ");
      silent.volume = 0;
      synthRef.current.speak(silent);
    }
    void audioRef.current?.play().catch(() => {});

    sessionRef.current = crypto.randomUUID();
    restartFailuresRef.current = 0;
    setMicBlocked(false);
    setOpenState(true);
    setHistory([]);
    // Greet first; the mic opens when the greeting finishes.
    void speakResponse(GREETING);
  };

  const status = micBlocked
    ? "The mic didn't open. Tap it to try again."
    : processing
      ? "Thinking…"
      : speaking
        ? "Speaking…"
        : transcript || (listening ? "Listening…" : "Tap the mic to talk");

  /** Tapping the mic is a user gesture, which is what a phone wants to grant it. */
  const retryMic = () => {
    restartFailuresRef.current = 0;
    setMicBlocked(false);
    startListening();
  };

  return (
    <>
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

      {/*
        A phone gets a bottom sheet across the full width; anything larger keeps
        the floating card. The safe-area padding keeps the controls clear of the
        home indicator, which otherwise sits directly on top of the mic button.
      */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[80] rounded-t-3xl border-t border-white/10 bg-black/70 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur-2xl shadow-2xl flex flex-col items-center gap-5 animate-in slide-in-from-bottom-5 fade-in-0 sm:inset-x-auto sm:bottom-24 sm:right-5 sm:w-[min(360px,calc(100vw-32px))] sm:rounded-3xl sm:border sm:p-6 sm:pb-6 sm:gap-6 sm:zoom-in-95">
          <div className="flex w-full justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold tracking-wide text-white uppercase">Live AI</span>
            </div>
            <button
              onClick={closeAssistant}
              aria-label="Close Live AI"
              className="rounded-full bg-white/10 p-2 text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 py-4 w-full">
            <div className="relative flex items-center justify-center">
              {speaking ? (
                <div className="absolute inset-0 rounded-full bg-pink-500/30 blur-2xl animate-pulse" />
              ) : listening ? (
                <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-xl animate-pulse" />
              ) : null}

              <button
                onClick={micBlocked ? retryMic : listening ? stopListening : startListening}
                aria-label={listening ? "Stop listening" : "Start listening"}
                className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-4 shadow-xl transition-all duration-300 active:scale-95 sm:hover:scale-105 ${
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
              {status}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full text-xs font-medium text-slate-400">
            <button
              type="button"
              className="flex flex-col gap-2 rounded-xl bg-white/5 p-3 text-left hover:bg-white/10 transition-colors"
              onClick={() => void handleVoiceCommand("Open the map")}
            >
              <MapIcon size={16} className="text-cyan-400" />
              View Map
            </button>
            <button
              type="button"
              className="flex flex-col gap-2 rounded-xl bg-white/5 p-3 text-left hover:bg-white/10 transition-colors"
              onClick={() => void handleVoiceCommand("Make me a trip plan")}
            >
              <Route size={16} className="text-purple-400" />
              AI Planner
            </button>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={toggleLiveAI}
          aria-label="Open Live AI assistant"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-[80] flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-[0_8px_32px_rgba(236,72,153,0.3)] transition-all duration-300 active:scale-95 sm:hover:scale-105 sm:hover:shadow-[0_12px_40px_rgba(236,72,153,0.4)]"
        >
          <AudioLines size={28} />
        </button>
      )}
    </>
  );
};

export default LiveAIVoice;
