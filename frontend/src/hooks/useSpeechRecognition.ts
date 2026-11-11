"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RecordedVoiceInput } from "@/lib/voice/recordedVoiceInput";

export interface SpeechRecognitionHook {
  isSupported: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  micSignal: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition({
  language = "en-US",
  onTranscriptChange,
  onFinalTranscript,
}: {
  language?: string;
  onTranscriptChange?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
} = {}): SpeechRecognitionHook {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micSignal, setMicSignal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const recordedRef = useRef<RecordedVoiceInput | null>(null);
  const callbacksRef = useRef({ onTranscriptChange, onFinalTranscript });
  callbacksRef.current = { onTranscriptChange, onFinalTranscript };
  const [isSupported, setIsSupported] = useState(false);
  useEffect(() => {
    setIsSupported(RecordedVoiceInput.supported() || Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    recordedRef.current = new RecordedVoiceInput({
      onReady: () => setMicSignal(false),
      onSignal: setMicSignal,
      onSilence: () => {
        setIsListening(false);
        setError("No audio was captured. Tap the microphone and try again.");
      },
      onTranscribing: () => {
        setIsListening(false);
        setIsTranscribing(true);
      },
      onTranscript: text => {
        setIsTranscribing(false);
        setTranscript(text);
        setIsListening(false);
        callbacksRef.current.onTranscriptChange?.(text);
        callbacksRef.current.onFinalTranscript?.(text);
      },
      onError: message => { setIsTranscribing(false); setIsListening(false); setError(message); },
    });
    return () => recordedRef.current?.stop();
  }, []);

  const stopListening = useCallback(() => {
    if (RecordedVoiceInput.supported()) recordedRef.current?.finish();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    setMicSignal(false);
    if (RecordedVoiceInput.supported()) {
      setError(null);
      setIsListening(true);
      void recordedRef.current?.start(language, { dictation: true });
      return;
    }
    if (!isSupported) {
      setError("Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.");
      return;
    }

    // Stop existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let currentFinal = "";
      let currentInterim = "";

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          currentFinal += item[0].transcript;
        } else {
          currentInterim += item[0].transcript;
        }
      }

      const finalTrimmed = currentFinal.trim();
      const interimTrimmed = currentInterim.trim();
      setTranscript(finalTrimmed);
      setInterimTranscript(interimTrimmed);

      const combined = [finalTrimmed, interimTrimmed].filter(Boolean).join(" ");
      onTranscriptChange?.(combined);
      if (finalTrimmed) {
        onFinalTranscript?.(finalTrimmed);
      }
    };

    recognition.onerror = (event: any) => {
      // Ignore normal abort / no-speech harmless events
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("[SpeechRecognition] error:", event.error);
        setError(event.error === "not-allowed" ? "Microphone access denied. Please check permissions." : "Microphone error.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    try {
      recognition.start();
    } catch (err: any) {
      console.warn("[SpeechRecognition] start error:", err);
      setIsListening(false);
    }
  }, [isSupported, language, onTranscriptChange, onFinalTranscript]);

  const resetTranscript = useCallback(() => {
    recordedRef.current?.reset();
    setIsTranscribing(false);
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.abort();
    }
    setIsListening(false);
    setTranscript("");
    setInterimTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    isTranscribing,
    micSignal,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
