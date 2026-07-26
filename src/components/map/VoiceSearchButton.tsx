import { Mic, MicOff } from "lucide-react";
import { useState } from "react";

type Props = {
  onResult: (text: string) => void;
};

const VoiceSearchButton = ({ onResult }: Props) => {
  const [listening, setListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-PK";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setListening(true);

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={startListening}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
    >
      {listening ? <MicOff size={17} /> : <Mic size={17} />}
      {listening ? "Listening..." : "Voice Search"}
    </button>
  );
};

export default VoiceSearchButton;
