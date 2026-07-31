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
 * Long enough for a hit, short enough that a miss gets out of the way.
 *
 * A hit is served from memory or disk and measured at 6–8ms. A miss is not
 * quick at all — it walks memory, then disk, then a Postgres row, and clocked
 * 2.9s — but its answer is worth nothing, because the line still has to be
 * spoken by the model afterwards. Waiting the full lookup only delays the
 * voice, so this is set far above a hit and well below a miss: the cache gets
 * its chance, and a line nobody has said before stops paying for the search.
 */
const TTS_TIMEOUT_MS = 1_200;

/**
 * The native-audio fallback does generate, so it gets a real budget.
 *
 * Measured against the live API: first audio arrived between 2.7s and 8.1s
 * depending on the length of the line and whether the session had warmed up.
 * Twelve seconds covers the slow end without leaving anyone listening to
 * silence if the socket faults — Google closes about one turn in five with an
 * internal 1011, and the browser voice needs to take over promptly when it does.
 */
const NATIVE_TIMEOUT_MS = 12_000;

/**
 * How long playback has to actually begin before the audio is abandoned.
 *
 * `audio.play()` can hang forever — verified in the browser against a valid
 * WAV the server had served correctly. Past this the browser voice takes the
 * line instead, so a stalled decoder cannot strand the session.
 */
const AUDIO_START_TIMEOUT_MS = 1_500;

/**
 * A single silent 8kHz sample, used only to unlock the audio element inside
 * the tap that opens the assistant. Browsers only grant playback permission
 * to a real source, so `play()` on an empty element unlocks nothing.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const GREETING = voicePhrases.greeting;

/** Native-audio speech comes back as raw 24 kHz mono PCM, as the API defines it. */
const NATIVE_RATE = 24000;

/** Wraps PCM so the existing <audio> element can play it unchanged. */
const pcmToWavBlob = (pcm: Uint8Array): Blob => {
  const header = new DataView(new ArrayBuffer(44));
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) header.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  header.setUint32(4, 36 + pcm.length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, NATIVE_RATE, true);
  header.setUint32(28, NATIVE_RATE * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  ascii(36, "data");
  header.setUint32(40, pcm.length, true);
  return new Blob([header.buffer, pcm], { type: "audio/wav" });
};

/**
 * The line, spoken by the native-audio model.
 *
 * This is what a cache miss falls to now, and it is the reason the assistant
 * stopped sounding like a robot for most of every day. `/api/ai/tts` is capped
 * at ten requests per model per day on the free tier — spent by mid-morning,
 * after which every uncached sentence went to the browser voice. The
 * native-audio model is metered separately and has no such cap.
 *
 * It costs about four seconds, which is why it sits behind the cache rather
 * than in front of it: warmed lines still play instantly, and only a sentence
 * nobody has said before waits. Returns null so the caller can drop to the
 * browser voice exactly as it did before.
 */
const speakNatively = async (text: string, signal: AbortSignal): Promise<Blob | null> => {
  try {
    const response = await fetch("/api/ai/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speak: text }),
      signal,
    });
    if (!response.ok || !response.body) return null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let buffered = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: { type?: string; data?: string };
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.type !== "audio" || !event.data) continue;
        const binary = atob(event.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        chunks.push(bytes);
        total += bytes.length;
      }
    }

    if (!total) return null;
    const pcm = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      pcm.set(chunk, offset);
      offset += chunk.length;
    }
    return pcmToWavBlob(pcm);
  } catch {
    return null;
  }
};

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
  /**
   * The line currently being spoken, shown in the caption.
   *
   * Most machines have no voice installed for some languages — this one has
   * 87 voices and not one Urdu — so a reply in such a language cannot be
   * spoken at all. Showing the words means the answer still lands instead of
   * the assistant appearing to talk to itself in silence.
   */
  const [spokenLine, setSpokenLine] = useState("");
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
  const fallbackVoiceRef = useRef<Map<string, SpeechSynthesisVoice | null>>(new Map());
  /**
   * Once the assistant has had to fall back to the browser voice, it stays
   * there for the rest of the session. Switching back to Gemini mid-chat is
   * exactly the audible change of speaker the user is complaining about.
   */
  const usingBrowserVoiceRef = useRef(false);
  /** Set when the server said "not cached" — an ordinary miss, not a failure. */
  const notCachedRef = useRef(false);

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
  const resolveFallbackVoice = useCallback(
    async (language: string): Promise<SpeechSynthesisVoice | null> => {
      const base = language.split("-")[0].toLowerCase();
      const cached = fallbackVoiceRef.current;
      // Cached per language, not once per session. Pinning one voice for the
      // whole conversation is what left an English speaker (Daniel, en-GB)
      // trying to read Urdu after the user switched language — which produces
      // no audible speech at all. Pinning still prevents the voice wobbling
      // *within* a language, which is what it was for.
      if (cached.has(base)) return cached.get(base) ?? null;

      const synth = synthRef.current;
      if (!synth) return null;

      let voices = synth.getVoices();
      if (voices.length === 0) {
        // Chrome populates the list asynchronously and fires `voiceschanged`
        // when it is ready; calling it cold returns [].
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

      const sameLanguage = voices.filter((voice) => voice.lang.split("-")[0].toLowerCase() === base);

      /**
       * No voice for this language means no voice, not "use any voice".
       *
       * Most machines ship no Urdu voice at all — verified on this one: 87
       * voices installed, zero `ur-*`. Handing the line to an English speaker
       * anyway is what produced silence. Returning null leaves `utterance.lang`
       * to the engine, which at worst does the same thing but never picks a
       * confidently wrong speaker.
       */
      const chosen =
        sameLanguage.find((voice) => /daniel|alex|rishi|google uk english male/i.test(voice.name)) ??
        sameLanguage.find((voice) => /male/i.test(voice.name)) ??
        sameLanguage[0] ??
        null;

      cached.set(base, chosen);
      return chosen;
    },
    [],
  );

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
      setSpokenLine(text);
      stopListening();

      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        // Drop any handlers from the previous line; a stale `onended` firing
        // late would hand the mic back in the middle of this one.
        audio.onended = null;
        audio.onerror = null;
      }
      synthRef.current?.cancel();

      /**
       * Exactly one path may finish the turn.
       *
       * Several things can end a spoken line — playback finishing, a watchdog
       * firing, an error — and more than one of them routinely happens for the
       * same line. Without this the mic would be handed back twice.
       */
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        setSpeakingState(false);
        // Gap so the tail of the reply does not land in the next capture, and
        // so a phone has time to release the audio session before the mic
        // claims it.
        scheduleRestart(mobileRef.current ? RESTART_DELAY_MOBILE_MS : RESTART_DELAY_MS);
      };

      /** The browser's own voice. Always available, always instant. */
      const speakWithBrowser = async () => {
        const synth = synthRef.current;
        if (!synth) {
          done();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langRef.current;
        utterance.rate = 0.98;
        utterance.pitch = 0.85; // Drop it toward a male range.

        const chosen = await resolveFallbackVoice(langRef.current);
        if (chosen) utterance.voice = chosen;

        /**
         * Two long-standing Chrome bugs make `speak()` silently do nothing:
         * an utterance queued too soon after `cancel()` is dropped, and one
         * queued while the engine thinks it is paused never starts. Verified
         * in-page: `speak()` was accepted and `speaking` went true, but no
         * `start` event ever arrived. So: let the cancel settle, then speak,
         * then nudge the engine out of a paused state.
         */
        await new Promise((resolve) => window.setTimeout(resolve, 120));

        // Safari fires neither onend nor onerror if the utterance is cut off,
        // which would strand the session with the mic shut. Roughly 90ms per
        // character is a generous read; whichever lands first wins.
        const guard = window.setTimeout(done, 3_000 + text.length * 90);
        utterance.onend = () => {
          window.clearTimeout(guard);
          done();
        };
        utterance.onerror = () => {
          window.clearTimeout(guard);
          done();
        };
        synth.speak(utterance);
        // Chrome also stops long utterances after ~15s unless poked, so the
        // nudge repeats until the line is done.
        const nudge = window.setInterval(() => {
          if (synth.speaking && synth.paused) synth.resume();
        }, 200);
        const stopNudge = () => window.clearInterval(nudge);
        utterance.addEventListener("end", stopNudge);
        utterance.addEventListener("error", stopNudge);
        window.setTimeout(stopNudge, 3_000 + text.length * 90 + 1_000);
      };

      /**
       * The cache, and nothing more.
       *
       * Its own try/catch, because a failure here is not a failure of Gemini —
       * and treating it as one is what silenced the assistant. The lookup takes
       * about 2.9s on a miss (it checks memory, then disk, then a Postgres row),
       * the request was cut off at 2.5s, and the abort landed in the outer catch
       * before `notCachedRef` had been set. That pinned the session to the
       * browser voice permanently: every later line hit the pin and skipped
       * Gemini entirely. A cache that answered a little too slowly once cost the
       * real voice for the rest of the conversation.
       *
       * Returns null for every miss — 204, timeout, error alike. All three mean
       * the same thing to the caller: nothing cached, ask the model to speak it.
       */
      const fromCache = async (): Promise<Blob | null> => {
        try {
          const response = await fetch("/api/ai/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, session: sessionRef.current, cachedOnly: true }),
            signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
          });
          if (response.status !== 200) return null;
          const blob = await response.blob();
          return blob.size ? blob : null;
        } catch {
          return null;
        }
      };

      try {
        // Once this session has fallen back, stay fallen back — see
        // `usingBrowserVoiceRef`. Skipping the request also removes the wait.
        if (usingBrowserVoiceRef.current) throw new Error("session pinned to browser voice");

        /**
         * Cached audio if there is any, otherwise the model speaks it.
         *
         * Only the second of these failing means Gemini is genuinely unavailable
         * and the browser voice should take over for the session — which is why
         * `notCachedRef` is set from the cache result rather than from an
         * exception that could have come from either.
         */
        let blob = await fromCache();
        notCachedRef.current = !blob;

        if (!blob) {
          blob = await speakNatively(text, AbortSignal.timeout(NATIVE_TIMEOUT_MS));
        }

        if (!blob || !blob.size) throw new Error("no audio from cache or the speech model");
        if (!audio) throw new Error("no audio element");

        const url = URL.createObjectURL(blob);
        const release = () => URL.revokeObjectURL(url);

        audio.src = url;
        audio.onended = () => {
          release();
          done();
        };
        audio.onerror = () => {
          release();
          void speakWithBrowser();
        };

        /**
         * `audio.play()` can hang indefinitely.
         *
         * Verified in the browser against a valid 24kHz mono WAV that the
         * server had served correctly: the element sat at readyState 0 with
         * `waiting` and `stalled` fired, no error, and the promise neither
         * resolved nor rejected. Nothing downstream could recover, so the
         * assistant stayed on "Speaking…" with the mic shut — exactly the
         * symptom reported. A device with no audio output, a blocked autoplay
         * policy or a decoder that never starts all land here.
         *
         * So playback is given a deadline to actually begin. If it has not,
         * the audio is abandoned and the browser voice speaks the line, which
         * needs no decoding and cannot stall.
         */
        const startedPlaying = await Promise.race([
          audio
            .play()
            .then(() => true)
            .catch(() => false),
          new Promise<boolean>((resolve) =>
            window.setTimeout(() => resolve(false), AUDIO_START_TIMEOUT_MS),
          ),
        ]);

        if (!startedPlaying) {
          audio.onended = null;
          audio.onerror = null;
          audio.pause();
          release();
          console.warn("[voice] audio would not start, using browser voice");
          await speakWithBrowser();
          return;
        }

        // Belt and braces: even when playback starts, `onended` is not
        // guaranteed to arrive. Cap the turn at the clip's own length plus a
        // margin so the mic always comes back.
        const cap = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
        window.setTimeout(() => {
          if (settled) return;
          release();
          done();
        }, cap * 1000 + 2_000);
      } catch (error) {
        /**
         * Pin only when cached audio existed and still would not play — a fault
         * in this browser's audio, which the next line will hit too.
         *
         * A miss that the model then failed to speak is left unpinned on
         * purpose: Google closes roughly one turn in five with an internal
         * 1011, and pinning on that would trade one unlucky sentence for a
         * robotic voice for the rest of the conversation.
         */
        if (!notCachedRef.current) {
          console.warn("[voice] cached audio would not play, using browser voice:", error);
          usingBrowserVoiceRef.current = true;
        }
        notCachedRef.current = false;
        await speakWithBrowser();
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

    /**
     * Unlock both audio engines on the tap, which is the only moment a browser
     * will grant it.
     *
     * The element is unlocked by actually playing something. It used to be
     * given a bare `play()` with no `src`, which rejects immediately and
     * unlocks nothing — so the first real reply was the first time the element
     * had ever been asked to play, outside any gesture. A one-sample silent
     * WAV is a real source, so this genuinely counts.
     */
    const audio = audioRef.current;
    if (audio) {
      audio.src = SILENT_WAV;
      audio.muted = true;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
    }

    // Warming the voice list during the gesture means the first fallback line
    // already has a speaker chosen instead of waiting for one.
    void resolveFallbackVoice(langRef.current);

    sessionRef.current = crypto.randomUUID();
    restartFailuresRef.current = 0;
    usingBrowserVoiceRef.current = false;
    fallbackVoiceRef.current.clear();
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
        ? // The words, not just "Speaking…". A reply in a language this device
          // has no voice for cannot be spoken at all, and showing it means the
          // answer still reaches the user instead of being lost to silence.
          spokenLine || "Speaking…"
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
        className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-[96] lg:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] flex h-16 w-16 items-center justify-center rounded-full text-white transition-all duration-300 active:scale-95 sm:hover:scale-105 ${
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
