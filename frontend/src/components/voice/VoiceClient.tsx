"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, AlertTriangle, Phone } from "lucide-react";
import { CHAT_LANGUAGES } from "@/lib/voice/languages";
import { useAIVoice } from "@/hooks/useAIVoice";
import { VoiceAvatar } from "./VoiceAvatar";
import { VoiceControls } from "./VoiceControls";
import { AudioVisualizer } from "./AudioVisualizer";
import { VoiceService } from "@/lib/voice/voiceService";
import { BackButton } from "@/components/navigation/BackButton";
import { createClient } from "@/lib/supabase/client";
import type { VoiceState } from "@/types";

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Tap to begin speaking",
  connecting: "Connecting…",
  listening: "Listening to you…",
  thinking: "Reflecting…",
  speaking: "Speaking with you…",
  ended: "Call ended",
};

const SAMPLE_PROMPTS = [
  "I'm feeling a little overwhelmed today.",
  "Can you guide me through a mindful breath?",
  "My thoughts won't slow down enough to sleep.",
];

export function VoiceClient({ isGuest = false }: { isGuest?: boolean }) {
  const { settings, updateSettings } = useAIVoice();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const callActive = useRef(false);
  const mutedRef = useRef(false);
  const conversationRef = useRef<string | null>(null);
  const [state, setState] = useState<VoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const promptedForSilence = useRef(false);
  const serviceRef = useRef<VoiceService | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const requestRef = useRef<AbortController | null>(null);
  const callVersion = useRef(0);
  const busy = useRef(false);
  const phaseRef = useRef<VoiceState>("idle");
  const supabase = createClient();

  function transition(next: VoiceState) {
    phaseRef.current = next;
    setState(next);
  }
  function resumeListening() {
    if (!callActive.current) return;
    transition("listening");
    if (!mutedRef.current) serviceRef.current?.startListening();
  }
  function handleSilence() {
    if (!callActive.current || busy.current || mutedRef.current) return;
    if (promptedForSilence.current) {
      resumeListening();
      return;
    }
    promptedForSilence.current = true;
    const language = settingsRef.current.language || "en-US";
    const prompts: Record<string, string> = {
      "en-US": "I'm here with you. What's on your mind today?",
      "hi-IN": "मैं आपके साथ हूँ। आज आपके मन में क्या चल रहा है?",
      "ta-IN": "நான் உங்களுடன் இருக்கிறேன். இன்று உங்கள் மனதில் என்ன இருக்கிறது?",
      "te-IN": "నేను మీతోనే ఉన్నాను. ఈ రోజు మీ మనసులో ఏముంది?",
      "ne-NP": "म तपाईंको साथमा छु। आज तपाईंको मनमा के चलिरहेको छ?",
    };
    const prompt = prompts[language] || prompts["en-US"];
    serviceRef.current?.speak(prompt);
  }

  useEffect(() => {
    const service = new VoiceService({
      onTranscript: handleTranscript,
      onSilence: handleSilence,
      onListeningStart: () => { if (callActive.current && !busy.current) { transition("listening"); } },
      onRecovering: message => { if (callActive.current) { setError(message); transition("connecting"); } },
      onSpeakingStart: () => { if (callActive.current) transition("speaking"); },
      onSpeakingEnd: resumeListening,
      onError: message => {
        if (!callActive.current) return;
        setError(message);
        endCall();
      },
    });
    serviceRef.current = service;
    return () => {
      callActive.current = false;
      callVersion.current++;
      requestRef.current?.abort();
      service.stopListening();
      service.cancelSpeaking();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // Call callbacks use refs so they always observe the current call and settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTranscript(text: string) {
    text = text.trim();
    if (!callActive.current || busy.current || !text) return;
    busy.current = true;
    const version = callVersion.current;
    serviceRef.current?.stopListening();
    transition("thinking");
    setError(null);
    setLastTranscript(text);
    setLastReply(null);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!callActive.current || version !== callVersion.current) return;
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || "demo-token"}`,
        },
        body: JSON.stringify({ conversationId: conversationRef.current, message: text, language: settingsRef.current.language || "en-US", voiceCall: true }),
      });
      if (!res.ok) throw new Error("Connection failed");
      const data = await res.json();
      if (!callActive.current || version !== callVersion.current) return;
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Empty reply");
      busy.current = false;
      setLastReply(data.reply);
      serviceRef.current?.speak(data.reply);
    } catch {
      if (!callActive.current || version !== callVersion.current) return;
      busy.current = false;
      setError("The connection was interrupted. I'm listening again; please try once more.");
      resumeListening();
    } finally {
      if (version === callVersion.current) { busy.current = false; requestRef.current = null; }
    }
  }

  function startCall(sample?: string) {
    if (callActive.current) return;
    if (!serviceRef.current?.isSupported() && !sample) {
      setError("Voice input is unavailable. Please use Chrome or Edge.");
      return;
    }
    setError(null);
    callActive.current = true;
    callVersion.current++;
    busy.current = false;
    conversationRef.current = crypto.randomUUID();
    promptedForSilence.current = false;
    setLastTranscript("");
    setLastReply(null);
    mutedRef.current = false;
    serviceRef.current?.setMuted(false);
    setMuted(false);
    serviceRef.current?.resetSession();
    serviceRef.current?.setLanguage(settingsRef.current.language || "en-US");
    transition("connecting");
    setSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    if (sample) void handleTranscript(sample);
    else serviceRef.current?.startListening();
  }
  function endCall() {
    callActive.current = false;
    callVersion.current++;
    busy.current = false;
    requestRef.current?.abort();
    requestRef.current = null;
    serviceRef.current?.stopListening();
    serviceRef.current?.cancelSpeaking();
    if (timerRef.current) clearInterval(timerRef.current);
    transition("ended");
  }
  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    serviceRef.current?.setMuted(next);
    if (next) serviceRef.current?.stopListening();
    else if (phaseRef.current === "listening" || phaseRef.current === "connecting") resumeListening();
  }

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <main className="flex flex-1 flex-col items-center justify-between gap-5 px-4 py-4 sm:px-6 sm:py-8 pb-28 md:pb-8 w-full max-w-2xl mx-auto">
      <div className="w-full flex items-center justify-between">
        <BackButton fallbackHref="/dashboard" label="Dashboard" />
      </div>

      <div className="flex flex-col items-center justify-center gap-5 my-auto w-full">
        <label className="text-sm">Conversation language <select aria-label="Conversation language" disabled={state !== "idle" && state !== "ended"} value={settings.language || "en-US"} onChange={e => updateSettings({ language: e.target.value, voiceURI: undefined })} className="rounded-lg border p-2">{CHAT_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
        <VoiceAvatar state={state} muted={muted} />
        <p className="text-xs text-soft-gray text-center">Clear female voice · Speak anytime to interrupt</p>

        <div className="text-center max-w-md">
          <p className="font-serif text-lg text-charcoal">
            {state === "listening" && muted ? "Microphone muted" : STATE_LABEL[state]}
          </p>
          {(state === "listening" || state === "speaking" || state === "thinking") && (
            <p className="mt-1 text-xs text-soft-gray">
              {minutes}:{secs}
            </p>
          )}
        </div>

        {(state === "listening" || state === "speaking") && (
          <AudioVisualizer active={state === "listening" || state === "speaking"} />
        )}

        {lastTranscript && <p className="max-w-md text-sm text-charcoal" aria-live="polite">You: {lastTranscript}</p>}
        {lastReply && (() => {
          const isDangerous =
            lastReply.toLowerCase().includes("emergency service") ||
            lastReply.toLowerCase().includes("crisis line") ||
            lastReply.toLowerCase().includes("hurt yourself") ||
            lastReply.toLowerCase().includes("emergency department") ||
            lastReply.toLowerCase().includes("call 988");

          if (isDangerous) {
            return (
              <div className="max-w-md rounded-2xl border-2 border-red-500/80 bg-red-50/95 p-4 text-center text-sm shadow-md text-red-950">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-700 mb-1.5">
                  <AlertTriangle size={14} className="text-red-600 animate-pulse" />
                  <span>Safety & Crisis Support</span>
                </div>
                <p className="leading-relaxed font-medium">"{lastReply}"</p>
                <div className="mt-3 flex justify-center gap-2 text-xs">
                  <a href="tel:988" className="rounded-lg bg-red-600 px-2.5 py-1 text-white font-medium hover:bg-red-700">
                    Call 988
                  </a>
                  <a href="tel:911" className="rounded-lg bg-white border border-red-300 px-2.5 py-1 text-red-800 font-medium hover:bg-red-100">
                    Emergency: 911
                  </a>
                </div>
              </div>
            );
          }

          return (
            <div className="max-w-md rounded-2xl border-2 border-emerald-400/80 bg-emerald-50/90 p-4 text-center text-sm shadow-sm text-emerald-950">
              <div className="flex items-center justify-center gap-1 text-xs font-medium text-emerald-800 mb-1">
                <Sparkles size={13} className="text-emerald-600" />
                <span>Mindful Companion</span>
              </div>
              <p className="leading-relaxed">"{lastReply}"</p>
            </div>
          );
        })()}

        {error && <div role="alert" className="text-sm text-dusty-rose text-center max-w-md space-y-2"><p>{error}</p><a href="/chat" className="underline">Continue in text chat</a></div>}
      </div>

      {state === "idle" || state === "ended" ? (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => startCall()}
            className="rounded-full bg-charcoal px-7 py-3 text-sm font-medium text-warm-white shadow-sm transition-all hover:bg-charcoal/85"
          >
            Start voice conversation
          </button>

          <div className="mt-2 flex flex-col items-center gap-1.5">
            <span className="text-[11px] text-soft-gray">or test with a prompt:</span>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
              {SAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    startCall(prompt);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-charcoal/10 bg-warm-white px-3 py-1 text-xs text-charcoal transition-all hover:bg-cream hover:border-charcoal/20"
                >
                  <Sparkles size={11} className="text-deep-sage" />
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <VoiceControls muted={muted} onToggleMute={toggleMute} onEnd={endCall} />
      )}

      <p className="max-w-sm text-center text-[11px] text-soft-gray leading-relaxed">
        AI-generated support, not a substitute for professional care. Voice input uses your
        microphone recorder. Speech audio is sent to Groq or Gemini for transcription. Reply text is sent to Microsoft Edge’s speech service for a female voice. Keep talking for as long as you like, and end the call when you're ready.
      </p>
    </main>
  );
}
