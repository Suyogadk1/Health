"use client";

import { aiVoiceService } from "./aiVoiceService";
import { RecordedVoiceInput } from "./recordedVoiceInput";

export interface VoiceServiceCallbacks {
  onTranscript: (text: string) => void;
  onSpeakingStart: () => void;
  onSpeakingEnd: () => void;
  onError: (message: string) => void;
  onSilence?: () => void;
  onListeningStart?: () => void;
  onRecovering?: (message: string) => void;
}

export class VoiceService {
  private recognition: any = null;
  private listening = false;
  private language = "en-US";
  private silenceTimer?: ReturnType<typeof setTimeout>;
  private turnTimer?: ReturnType<typeof setTimeout>;
  private restartTimer?: ReturnType<typeof setTimeout>;
  private silencePrompted = false;
  private finalText = "";
  private speechVersion = 0;
  private unsubscribe?: () => void;
  private retryCount = 0;
  private recording?: RecordedVoiceInput;
  private muted = false;
  private playing = false;
  setMuted(value: boolean) {
    this.muted = value;
    if (value) this.stopListening();
    else if (this.playing) this.monitorPlayback();
  }
  private monitorPlayback() {
    if (this.muted || !RecordedVoiceInput.supported()) return;
    void this.recording?.start(this.language, {
      playback: true,
      onSpeechStart: () => {
        if (!this.playing || this.muted) return;
        this.cancelSpeaking();
        // Keep this same recording, including its pre-roll, so the opening words survive.
        this.callbacks.onListeningStart?.();
      },
    });
  }

  constructor(private callbacks: VoiceServiceCallbacks) {
    this.recording = new RecordedVoiceInput({
      onReady: () => { if (!this.playing) this.callbacks.onListeningStart?.(); },
      onSilence: () => this.callbacks.onSilence?.(),
      onTranscript: text => this.callbacks.onTranscript(text),
      onRecovering: message => this.callbacks.onRecovering?.(message),
      onTranscribing: () => this.callbacks.onRecovering?.("Understanding your voice…"),
      onError: message => this.callbacks.onError(message),
    });
  }
  resetSession() {
    this.stopListening();
    this.cancelSpeaking();
    this.silencePrompted = false;
    this.retryCount = 0;
    this.recording?.reset();
  }
  setLanguage(language: string) { this.language = language; }
  isSupported() {
    return RecordedVoiceInput.supported() || (typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }
  private armSilence() {
    clearTimeout(this.silenceTimer);
    if (!this.listening || this.silencePrompted) return;
    this.silenceTimer = setTimeout(() => {
      if (!this.listening) return;
      if (this.finalText.trim()) { this.finishTurn(); return; }
      this.silencePrompted = true;
      this.stopListening();
      this.callbacks.onSilence?.();
    }, 5000);
  }
  private finishTurn() {
    const text = this.finalText.trim();
    if (!this.listening || !text) return;
    this.stopListening();
    this.silencePrompted = false;
    this.callbacks.onTranscript(text);
  }
  startListening() {
    if (this.muted || this.recording?.isRunning()) return;
    if (RecordedVoiceInput.supported()) {
      void this.recording?.start(this.language);
      return;
    }
    if (this.listening) return;
    if (!this.isSupported()) {
      this.callbacks.onError("Voice input is unavailable. Please try Chrome or Edge.");
      return;
    }
    this.listening = true;
    this.finalText = "";
    this.openRecognition();
  }
  private openRecognition() {
    if (!this.listening) return;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new Recognition();
    this.recognition = recognition;
    recognition.lang = this.language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let sessionFinal = "";
    const prefix = this.finalText;
    const current = () => this.listening && this.recognition === recognition;
    recognition.onstart = () => {
      if (!current()) return;
      this.callbacks.onListeningStart?.();
      // Recognition may restart on browser timeouts; keep the original silence deadline.
      if (!this.silenceTimer) this.armSilence();
    };
    recognition.onspeechstart = () => {
      if (!current()) return;
      clearTimeout(this.turnTimer);
      clearTimeout(this.silenceTimer);
      this.silenceTimer = undefined;
    };
    recognition.onresult = (event: any) => {
      if (!current()) return;
      clearTimeout(this.turnTimer);
      sessionFinal = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) sessionFinal += " " + event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      this.retryCount = 0;
      this.finalText = [prefix, sessionFinal.trim()].filter(Boolean).join(" ");
      this.armSilence();
      if (!interim.trim() && this.finalText.trim()) {
        // A short pause groups sentence fragments without waiting for the silence prompt.
        this.turnTimer = setTimeout(() => this.finishTurn(), 700);
      }
    };
    recognition.onspeechend = () => { if (current()) this.armSilence(); };
    recognition.onerror = (event: any) => {
      if (!current() || event.error === "aborted" || event.error === "no-speech") return;
      const code = String(event.error || "unknown");
      console.warn("[Voice recognition]", code);
      if (code === "network" && this.retryCount < 2) {
        this.retryCount++;
        clearTimeout(this.turnTimer);
        clearTimeout(this.silenceTimer);
        clearTimeout(this.restartTimer);
        this.silenceTimer = undefined;
        this.recognition = null;
        recognition.abort();
        this.callbacks.onRecovering?.(`Speech connection interrupted. Reconnecting (${this.retryCount}/2)…`);
        this.restartTimer = setTimeout(() => this.openRecognition(), this.retryCount * 1000);
        return;
      }
      this.stopListening();
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access was blocked. Allow the microphone for this site, then start the call again.",
        "service-not-allowed": "This browser does not allow its speech recognition service. Open this same address in Google Chrome or Microsoft Edge to use voice calls.",
        "audio-capture": "No working microphone was found. Connect or enable a microphone and check that another app is not using it.",
        "network": "The browser could not connect to its speech recognition service after two retries. Check your internet connection. If you are using the in-app preview, open this same address in Google Chrome or Microsoft Edge.",
        "language-not-supported": "The speech service does not support the selected language on this device. Choose another language or try Chrome or Edge.",
      };
      this.callbacks.onError(`${messages[code] || "The browser could not start speech recognition. Try Chrome or Edge."} (${code})`);
    };
    recognition.onend = () => {
      if (!current()) return;
      this.restartTimer = setTimeout(() => this.openRecognition(), 250);
    };
    try { recognition.start(); }
    catch {
      this.stopListening();
      this.callbacks.onError("Could not start the microphone. Please try again.");
    }
  }
  stopListening() {
    this.recording?.stop();
    this.listening = false;
    clearTimeout(this.silenceTimer);
    clearTimeout(this.turnTimer);
    clearTimeout(this.restartTimer);
    this.silenceTimer = undefined;
    const recognition = this.recognition;
    this.recognition = null;
    recognition?.abort();
    this.finalText = "";
  }
  speak(text: string) {
    this.stopListening();
    this.cancelSpeaking();
    this.playing = true;
    this.monitorPlayback();
    const version = this.speechVersion;
    if (typeof window === "undefined" || !window.speechSynthesis) {
      this.callbacks.onError("Speech playback is unavailable in this browser.");
      return;
    }
    this.callbacks.onSpeakingStart();
    let started = false;
    this.unsubscribe = aiVoiceService.subscribe(evt => {
      if (version !== this.speechVersion) return;
      if (evt.state === "speaking" && evt.activeId === "voice-client-call") started = true;
      if (evt.state === "idle" && (started || evt.error)) {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.playing = false;
        this.recording?.setPlayback(false);
        if (evt.error) this.callbacks.onError(evt.error);
        else this.callbacks.onSpeakingEnd();
      }
    });
    aiVoiceService.speak(text, "voice-client-call");
  }
  cancelSpeaking() {
    this.playing = false;
    this.recording?.setPlayback(false);
    this.speechVersion++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    aiVoiceService.stop();
  }
}
