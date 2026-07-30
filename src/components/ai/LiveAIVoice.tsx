"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, AudioLines } from "lucide-react";
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
const RESTART_DELAY_MS = 250;
const RESTART_DELAY_MOBILE_MS = 700;

/** Give up relaunching the mic after this many consecutive failures. */
const MAX_RESTART_FAILURES = 4;

/**
 * Deadlines for the two network round trips in a turn.
 *
 * Neither had one. A slow or hung upstream left the assistant silent with the
 * mic shut and no way back except closing it, which is what "sometimes it
 * works, sometimes it doesn't" actually was. Both now fail over to something
 * that answers immediately.
 */
const LIVE_TIMEOUT_MS = 25_000;
/**
 * The speech request is now a cache lookup, not a generation — the server
 * answers 204 straight away when a line has not been rendered yet. A couple of
 * seconds is therefore a generous allowance for a round trip, and keeping it
 * tight means even a stalled network costs a moment rather than the nine
 * seconds this used to allow.
 */
const TTS_TIMEOUT_MS = 2_500;

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
  /**
   * The one pending mic restart.
   *
   * Three separate paths scheduled a restart — `recognition.onend`, the gap
   * after a reply finishes speaking, and the failure backoff — with no shared
   * handle, so they stacked. Several timers would fire within a few hundred
   * milliseconds, each calling `start()` on a recogniser the previous one had
   * already started; the resulting InvalidStateError churn is what made the
   * mic come back sometimes and not others. One timer, always cleared first.
   */
  const restartTimerRef = useRef<number | null>(null);
  /**
   * The browser voice, chosen once.
   *
   * `speechSynthesis.getVoices()` returns an empty array on the first call in
   * Chrome — the list loads asynchronously — so the old code's `pool[0]` was
   * frequently `undefined` and the utterance fell back to whatever the browser
   * felt like. That is the voice changing between sentences. Resolved once per
   * session and reused.
   */
  const fallbackVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  /**
   * Once the assistant has had to fall back to the browser voice, it stays
   * there for the rest of the session. Switching back to Gemini mid-chat is
   * exactly the audible change of speaker the user is complaining about.
   */
  const usingBrowserVoiceRef = useRef(false);

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
  const startListenRef = useRef<() => void>(() => {});

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

  /** Replace any pending restart with this one. Never stack. */
  const scheduleRestart = useCallback((delay: number) => {
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      startListenRef.current();
    }, delay);
  }, []);

  const cancelRestart = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

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
        scheduleRestart(400 * restartFailuresRef.current);
      } else {
        setMicBlocked(true);
      }
    }
  }, [scheduleRestart]);

  // `scheduleRestart` is defined above `startListening` so both can reference
  // each other; this ref is what closes the loop without a circular useCallback.
  startListenRef.current = startListening;

  /**
   * Resolve the browser voice, waiting for the list if it is not ready.
   *
   * Chrome populates `getVoices()` asynchronously and fires `voiceschanged`
   * when it is done; calling it cold returns `[]`. Picking a voice is done
   * once and pinned, so the assistant cannot change speaker mid-conversation.
   */
  const resolveFallbackVoice = useCallback(async (): Promise<SpeechSynthesisVoice | null> => {
    if (fallbackVoiceRef.current) return fallbackVoiceRef.current;
    const synth = synthRef.current;
    if (!synth) return null;

    let voices = synth.getVoices();
    if (voices.length === 0) {
      voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
        const timer = window.setTimeout(() => resolve(synth.getVoices()), 1200);
        synth.addEventListener(
          "voiceschanged",
          () => {
            window.clearTimeout(timer);
            resolve(synth.getVoices());
          },
          { once: true },
        );
      });
    }
    if (voices.length === 0) return null;

    // Language first, gender second: an English voice reading Urdu is
    // unintelligible, whereas a female voice reading Urdu is merely not what
    // was asked for.
    const base = langRef.current.split("-")[0];
    const sameLanguage = voices.filter((voice) => voice.lang.split("-")[0] === base);
    const pool = sameLanguage.length ? sameLanguage : voices;

    fallbackVoiceRef.current =
      pool.find((voice) => /daniel|alex|rishi|google uk english male/i.test(voice.name)) ??
      pool.find((voice) => /male/i.test(voice.name)) ??
      pool[0] ??
      null;

    return fallbackVoiceRef.current;
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    cancelRestart();
    setListeningState(false);
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    }
  }, [cancelRestart]);

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

      // Distinguishes "not cached yet" from a real TTS failure below.
      let notCached = false;

      const done = () => {
        setSpeakingState(false);
        // Gap so the tail of the reply does not land in the next capture, and
        // so a phone has time to release the audio session before the mic
        // claims it.
        scheduleRestart(mobileRef.current ? RESTART_DELAY_MOBILE_MS : RESTART_DELAY_MS);
      };

      try {
        // Once this session has fallen back, stay fallen back — see
        // `usingBrowserVoiceRef`. Skipping the request also removes the wait.
        if (usingBrowserVoiceRef.current) throw new Error("session pinned to browser voice");

        const response = await fetch("/api/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // `cachedOnly` is the whole latency fix. Measured on production:
          // generating a novel line took 4.4s, and after the free tier's
          // ten-per-day cap every attempt failed several seconds later. Asking
          // only for audio that already exists means a reply is either
          // instant Gemini audio or an instant browser voice — never a wait.
          // The server still renders the line in the background, so repeated
          // sentences upgrade themselves.
          body: JSON.stringify({ text, session: sessionRef.current, cachedOnly: true }),
          signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
        });

        // 204 = not cached yet. Speak it ourselves rather than wait. This is
        // an ordinary outcome, not a failure, so it must NOT pin the session
        // to the browser voice — the next line may well be a cached one, and
        // pinning would waste the warmed audio for the rest of the session.
        if (response.status === 204) {
          notCached = true;
          throw new Error("not cached");
        }
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
        // Only a genuine failure disables Gemini for the session. A cache miss
        // is the normal path now and leaves it enabled.
        if (!notCached) {
          console.warn("[voice] Gemini TTS unavailable, using browser voice:", error);
          usingBrowserVoiceRef.current = true;
        }

        const synth = synthRef.current;
        if (!synth) {
          done();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langRef.current;
        utterance.rate = 0.98;
        utterance.pitch = 0.85; // Drop it toward a male range.

        const chosen = await resolveFallbackVoice();
        if (chosen) utterance.voice = chosen;

        // Safari fires neither onend nor onerror if the utterance is cut off,
        // which would strand the session with the mic shut. Roughly 90ms per
        // character is a generous read; whichever lands first wins.
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          done();
        };
        const guard = window.setTimeout(finish, 3_000 + text.length * 90);

        utterance.onend = () => {
          window.clearTimeout(guard);
          finish();
        };
        utterance.onerror = () => {
          window.clearTimeout(guard);
          finish();
        };
        synth.speak(utterance);
      }
    },
    [resolveFallbackVoice, scheduleRestart, stopListening],
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
          // This had no deadline at all. When the model chain was slow or an
          // upstream hung, the assistant stayed on "Thinking…" with the mic
          // closed indefinitely and the only way out was to close it — which
          // is the "sometimes it just stops working" report. The server tries
          // several models with its own 10s budget each, so this is set past
          // that: reaching it means the request is genuinely stuck.
          signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
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
        scheduleRestart(mobileRef.current ? RESTART_DELAY_MOBILE_MS : RESTART_DELAY_MS);
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
  }, [startListening, scheduleRestart]);

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

  const closeAssistant = useCallback(() => {
    setOpenState(false);
    cancelRestart();
    stopListening();
    audioRef.current?.pause();
    synthRef.current?.cancel();
    setSpeakingState(false);
    setProcessingState(false);
    setTranscript("");
    pendingRef.current = null;
  }, [cancelRestart, stopListening]);

  /**
   * The orb is a single toggle, the way Siri is: tap to start, tap again to
   * stop. It replaces a modal that had its own close button, its own mic
   * button and two shortcut tiles — four controls for what is one decision.
   */
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
      // Warming the voice list during the gesture means the first fallback
      // line already has a speaker chosen instead of waiting for one.
      void resolveFallbackVoice();
    }
    void audioRef.current?.play().catch(() => {});

    sessionRef.current = crypto.randomUUID();
    restartFailuresRef.current = 0;
    usingBrowserVoiceRef.current = false;
    fallbackVoiceRef.current = null;
    setMicBlocked(false);
    setOpenState(true);
    setHistory([]);
    // Greet first; the mic opens when the greeting finishes.
    void speakResponse(GREETING);
  };

  // Escape closes it, like any other overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAssistant();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeAssistant]);

  /** Drives both the glow and the caption, so they can never disagree. */
  const state: "listening" | "thinking" | "speaking" | "blocked" = micBlocked
    ? "blocked"
    : processing
      ? "thinking"
      : speaking
        ? "speaking"
        : "listening";

  const caption = micBlocked
    ? "Mic blocked — allow access, then tap again"
    : processing
      ? "Thinking…"
      : speaking
        ? "Speaking…"
        : transcript || "Listening…";

  return (
    <>
      {/*
        iOS 26 Siri does not open a window. It lights the edge of the display
        and leaves the app underneath usable — which matters here, because the
        thing being talked about is the map behind it. The panel this replaces
        covered the bottom of the screen with a mic button, a close button and
        two shortcut tiles, none of which the voice session needs.
      */}
      <div className="nexus-siri" data-active={open} data-state={state} aria-hidden>
        <div className="nexus-siri-frame">
          <div className="nexus-siri-ring" />
        </div>
      </div>

      {open && (
        <p className="nexus-siri-caption" role="status" aria-live="polite">
          {caption}
        </p>
      )}

      <button
        onClick={toggleLiveAI}
        aria-label={open ? "Stop Live AI assistant" : "Open Live AI assistant"}
        aria-pressed={open}
        className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-[92] flex h-16 w-16 items-center justify-center rounded-full text-white transition-all duration-300 active:scale-95 sm:hover:scale-105 ${
          open
            ? "bg-gradient-to-b from-[#ff6a60] to-[#ff453a] shadow-[0_10px_30px_rgba(255,69,58,0.45),inset_0_1px_0_rgba(255,255,255,0.3)]"
            : "bg-gradient-to-b from-[#c86bf5] to-[#af52de] shadow-[0_10px_30px_rgba(175,82,222,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] sm:hover:shadow-[0_14px_40px_rgba(175,82,222,0.55),inset_0_1px_0_rgba(255,255,255,0.36)]"
        }`}
      >
        {open ? <X size={26} /> : <AudioLines size={28} />}
      </button>
    </>
  );
};

export default LiveAIVoice;
