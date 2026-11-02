"use client";

import { useState, useEffect, useCallback } from "react";
import { aiVoiceService, VoiceState, VoiceSettings } from "@/lib/voice/aiVoiceService";

export function useAIVoice() {
  // The server and first browser render must use identical values.
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>({ enabled: true, autoSpeak: false, rate: 0.95, pitch: 1, volume: 1 });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("speechSynthesis" in window);
    // Initial sync
    setVoiceState(aiVoiceService.getState());
    setActiveId(aiVoiceService.getActiveId());
    setSettings(aiVoiceService.getSettings());

    const updateVoices = () => {
      setVoices(aiVoiceService.getVoices());
    };
    updateVoices();

    const unsubscribe = aiVoiceService.subscribe((evt) => {
      setVoiceState(evt.state);
      setActiveId(evt.activeId);
    });

    if (typeof window !== "undefined" && window.speechSynthesis) {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const speak = useCallback((text: string, id: string = "default") => {
    return aiVoiceService.speak(text, id);
  }, []);

  const stop = useCallback(() => {
    aiVoiceService.stop();
  }, []);

  const pause = useCallback(() => {
    aiVoiceService.pause();
  }, []);

  const resume = useCallback(() => {
    aiVoiceService.resume();
  }, []);

  const toggle = useCallback((text: string, id: string = "default") => {
    if (aiVoiceService.isSpeaking(id)) {
      aiVoiceService.stop();
    } else {
      aiVoiceService.speak(text, id);
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    aiVoiceService.saveSettings(newSettings);
    setSettings(aiVoiceService.getSettings());
  }, []);

  const toggleAutoSpeak = useCallback(() => {
    const nextVal = !settings.autoSpeak;
    if (!nextVal) aiVoiceService.stop();
    aiVoiceService.saveSettings({ autoSpeak: nextVal });
    setSettings((prev) => ({ ...prev, autoSpeak: nextVal }));
  }, [settings.autoSpeak]);

  return {
    isSupported,
    state: voiceState,
    isSpeaking: voiceState === "speaking",
    isPaused: voiceState === "paused",
    activeId,
    settings,
    autoSpeak: settings.autoSpeak,
    voices,
    speak,
    stop,
    pause,
    resume,
    toggle,
    updateSettings,
    toggleAutoSpeak,
  };
}
