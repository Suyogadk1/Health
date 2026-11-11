"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { Send, Mic, MicOff, Volume2, VolumeX, Sparkles, AlertCircle } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

export function ChatInput({
  language = "en-US",
  onVoiceStart,
  onSend,
  disabled,
  autoSpeak,
  onToggleAutoSpeak,
}: {
  language?: string;
  onVoiceStart?: () => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  autoSpeak?: boolean;
  onToggleAutoSpeak?: () => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const baseTextRef = useRef<string>("");

  const {
    isSupported: speechSupported,
    isListening,
    isTranscribing,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    language,
    onTranscriptChange: (text) => {
      const prefix = baseTextRef.current;
      setValue(prefix ? `${prefix} ${text}` : text);
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const prefill = sessionStorage.getItem("mindcare_prefill_chat");
      if (prefill) {
        setValue(prefill);
        sessionStorage.removeItem("mindcare_prefill_chat");
        textareaRef.current?.focus();
      }
    }
  }, []);

  function submit() {
    if (isTranscribing) return;
    if (isListening) {
      stopListening();
    }
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    baseTextRef.current = "";
    resetTranscript();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function toggleMic() {
    if (isTranscribing) return;
    if (isListening) {
      stopListening();
    } else {
      onVoiceStart?.();
      baseTextRef.current = value.trim();
      startListening();
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      {isTranscribing && <p role="status" className="text-xs">Transcribing your recording…</p>}
      {/* Active Speech Recognition Banner when Microphone is Listening */}
      {isListening && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-900 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <span className="font-medium">Listening to your voice…</span>
            <span className="text-[11px] text-rose-700/80 hidden sm:inline">
              Speak at your own pace, then tap Stop to transcribe.
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Equalizer animation */}
            <span className="flex items-end gap-0.5 h-3 w-4">
              <span className="w-0.5 bg-rose-600 rounded-full animate-bounce h-2" style={{ animationDelay: "0ms" }} />
              <span className="w-0.5 bg-rose-600 rounded-full animate-bounce h-3" style={{ animationDelay: "150ms" }} />
              <span className="w-0.5 bg-rose-600 rounded-full animate-bounce h-1.5" style={{ animationDelay: "300ms" }} />
              <span className="w-0.5 bg-rose-600 rounded-full animate-bounce h-2.5" style={{ animationDelay: "100ms" }} />
            </span>
            <button
              type="button"
              onClick={stopListening}
              className="text-[11px] font-semibold text-rose-800 underline hover:text-rose-950 ml-1 cursor-pointer"
            >
              Done speaking
            </button>
          </div>
        </div>
      )}

      {speechError && (
        <div className="flex items-center gap-1.5 text-[11px] text-rose-700 px-2 py-0.5">
          <AlertCircle size={12} className="shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {!speechSupported && <p className="text-xs text-soft-gray">Voice input is unavailable in this browser. You can still type here.</p>}
      {/* Main Input Bar */}
      <div
        className={`flex items-end gap-2 rounded-2xl border bg-warm-white p-2 shadow-2xs transition-all ${
          isListening
            ? "border-rose-400 ring-2 ring-rose-200 shadow-md"
            : "border-charcoal/10 hover:border-charcoal/20 focus-within:border-deep-sage focus-within:ring-1 focus-within:ring-deep-sage"
        }`}
      >
        <textarea
          ref={textareaRef}
          disabled={disabled || isListening}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening... your words will appear here" : "What's on your mind today? (Type or speak)"}
          rows={1}
          aria-label="Message"
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-charcoal outline-none placeholder:text-soft-gray min-h-[38px] max-h-32"
        />

        <div className="flex items-center gap-1 shrink-0 pb-0.5">
          {/* AI Voice Narration Auto-Read Toggle (if handler provided) */}
          {onToggleAutoSpeak !== undefined && (
            <button
              type="button"
              onClick={onToggleAutoSpeak}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all cursor-pointer ${
                autoSpeak
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
                  : "text-soft-gray hover:bg-cream hover:text-charcoal"
              }`}
              title={
                autoSpeak
                  ? "Voice Narration is ON (AI replies will be spoken aloud)"
                  : "Turn on Voice Narration (AI replies will be spoken aloud)"
              }
              aria-label={autoSpeak ? "Turn off voice narration" : "Turn on voice narration"}
            >
              {autoSpeak ? <Volume2 size={17} className="text-emerald-700" /> : <VolumeX size={17} />}
            </button>
          )}

          {/* Microphone Speech Recognition Button */}
          {speechSupported && (
            <button
              type="button"
              disabled={disabled}
              onClick={toggleMic}
              className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all cursor-pointer ${
                isListening
                  ? "bg-rose-600 text-white shadow-md animate-pulse ring-2 ring-rose-300"
                  : "text-soft-gray hover:bg-cream hover:text-charcoal"
              }`}
              title={isListening ? "Stop listening" : "Speak message with your voice (Speech-to-Text)"}
              aria-label={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
          )}

          {/* Send Button */}
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-warm-white dark:bg-warm-white dark:text-charcoal dark:border dark:border-charcoal/15 disabled:opacity-40 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed shadow-xs"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
