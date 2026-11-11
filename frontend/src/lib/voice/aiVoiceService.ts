"use client";

export interface VoiceProfile {
  id: string;
  name: string;
  gender?: "female" | "male" | "neutral";
  lang: string;
  voiceURI: string;
  isPreferred?: boolean;
}

export interface VoiceSettings {
  language?: string;
  enabled: boolean;
  autoSpeak: boolean;
  rate: number;      // 0.7 to 1.3 (default 0.95 for calm, mindful pacing)
  pitch: number;     // 0.8 to 1.2 (default 1.0)
  volume: number;    // 0.0 to 1.0 (default 1.0)
  voiceURI?: string; // Specific chosen voice URI
}

export type VoiceState = "idle" | "speaking" | "paused";

export interface VoiceStateEvent {
  state: VoiceState;
  activeId: string | null;
  textSnippet?: string;
  error?: string;
}

const SETTINGS_STORAGE_KEY = "mindcare_voice_settings";

/**
 * Strips markdown, emojis, asterisks, URLs, and code blocks
 * so the Web Speech synthesizer narrates clean, natural speech
 * without pronouncing syntax.
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return "";

  return raw
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown headers #, ##, ###
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold and italics **text**, *text*, __text__, _text_
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Read the localized brand name once when its English spelling follows it.
    .replace(/(^|[^\p{L}\p{M}\p{N}])(माइन्डकेयर|माइंडकेयर|माइन्ड केयर|माइंड केयर)\s*[（(]\s*Mind\s*Care\s*[）)]/giu, "$1$2")
    // Keep meaningful asides, removing only a repeated spelling.
    .replace(/(^|[^\p{L}\p{M}\p{N}])([\p{L}\p{M}\p{N}]+)\s*[（(]\s*\2\s*[）)]/giu, "$1$2")
    // Remove bullet points and numbered lists
    .replace(/^(\s*[-*+]|\s*\d+\.)\s+/gm, "")
    // Remove blockquotes >
    .replace(/^>\s+/gm, "")
    // Remove URLs
    .replace(/https?:\/\/\S+/g, "")
    // Remove multiple hyphens/dividers ---
    .replace(/^-{3,}$/gm, "")
    // Normalize dashes and pauses
    .replace(/—/g, ", ")
    .replace(/–/g, ", ")
    // Remove emojis so browser doesn't verbalize symbol codepoints
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, "")
    // Remove multiple spaces and newlines with single space/pause
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    // Remove orphan punctuation
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

/**
 * Splits text into natural sentence-length chunks.
 * Crucial for Web Speech API to prevent browser stalling / clipping on long text.
 */
export function chunkTextIntoSentences(text: string, maxChunkLen = 160): string[] {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return [];

  // Match sentences ending with . ! ? or ;
  const rawSentences = cleaned.match(/[^.!?;।\n]+(?:[.!?;।\n]+|$)/g) || [cleaned];
  const chunks: string[] = [];

  let current = "";
  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if (!current) {
      current = trimmed;
    } else if (current.length + trimmed.length + 1 <= maxChunkLen) {
      current += " " + trimmed;
    } else {
      chunks.push(current);
      current = trimmed;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [cleaned];
}

class AIVoiceService {
  private callAudio: HTMLAudioElement | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private speechRequest: AbortController | null = null;
  private speechVersion = 0;
  private state: VoiceState = "idle";
  private activeId: string | null = null;
  private currentChunks: string[] = [];
  private currentChunkIndex = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners: Set<(event: VoiceStateEvent) => void> = new Set();
  private availableVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  private settings: VoiceSettings = {
    enabled: true,
    autoSpeak: false,
    rate: 0.95,
    pitch: 1.0,
    volume: 1.0,
  };

  constructor() {
    this.initSettings();
    if (typeof window !== "undefined") {
      this.initVoices();
    }
  }

  private initSettings() {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch {}
  }

  public saveSettings(updates: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...updates };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
      } catch {}
    }
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  private initVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        this.availableVoices = voices;
        this.voicesLoaded = true;
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  public isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.availableVoices.length === 0 && typeof window !== "undefined" && "speechSynthesis" in window) {
      this.availableVoices = window.speechSynthesis.getVoices();
    }
    return this.availableVoices;
  }

  /**
   * Discovers the most soothing, natural voice available.
   * Prioritizes natural/warm English voices.
   */
  public getBestVoice(): SpeechSynthesisVoice | null {
    const language = this.settings.language || "en-US";
    const voices = this.getVoices().filter(v => v.lang.split("-")[0] === language.split("-")[0]);
    if (voices.length === 0) return null;

    const names = ["jenny", "aria", "samantha", "zira", "susan", "swara", "pallavi", "shruti", "hemkala", "heera", "kalpana", "female"];
    return voices.find(v => names.some(name => v.name.toLowerCase().includes(name))) || null;
  }

  public subscribe(listener: (event: VoiceStateEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: VoiceStateEvent) {
    this.state = event.state;
    this.activeId = event.activeId;
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        console.warn("[AIVoiceService] Listener error:", err);
      }
    });
  }

  public getState(): VoiceState {
    return this.state;
  }

  public getActiveId(): string | null {
    return this.activeId;
  }

  public isSpeaking(id?: string): boolean {
    if (!id) return this.state === "speaking";
    return this.state === "speaking" && this.activeId === id;
  }

  /**
   * Speaks the text aloud, chunked cleanly across sentences.
   * If already speaking this item, it will stop/toggle.
   */
  public prepareCallPlayback() {
    // Safari and other browsers may require the same element to be started by a tap.
    const audio = this.callAudio ?? new Audio();
    this.callAudio = audio;
    const silence = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";
    audio.src = silence;
    void audio.play().catch(() => {});
  }

  public async speak(text: string, id: string = "default"): Promise<void> {
    if (!this.isSupported()) {
      this.emit({ state: "idle", activeId: null, error: "Speech synthesis not supported in this browser." });
      return;
    }

    // If currently speaking the exact same message, stop it (toggle behavior)
    if (this.state === "speaking" && this.activeId === id) {
      this.stop();
      return;
    }

    // Cancel any ongoing speech
    this.stop();

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;
    const version = this.speechVersion;
    this.speechRequest = new AbortController();
    this.emit({ state: "speaking", activeId: id, textSnippet: cleaned.slice(0, 50) });
    try {
      const response = await fetch("/api/speak", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned.slice(0, 6000), language: this.settings.language || "en-US" }),
        signal: this.speechRequest.signal,
      });
      if (!response.ok) throw new Error("Female voice service unavailable");
      const blob = await response.blob();
      if (version !== this.speechVersion) return;
      this.audioUrl = URL.createObjectURL(blob);
      const audio = id === "voice-client-call" && this.callAudio ? this.callAudio : new Audio();
      audio.src = this.audioUrl;
      this.audio = audio;
      audio.volume = this.settings.volume ?? 1;
      audio.onended = () => { if (version === this.speechVersion) this.stop(); };
      audio.onerror = () => {
        if (version !== this.speechVersion) return;
        this.stop(false);
        this.emit({ state: "idle", activeId: null, error: "Female voice playback failed. Please try again." });
      };
      await audio.play();
    } catch {
      if (version !== this.speechVersion) return;
      // Only fall back to a known female voice in the selected language.
      if (this.getBestVoice()) {
        this.currentChunks = chunkTextIntoSentences(cleaned);
        this.currentChunkIndex = 0;
        this.playNextChunk();
      } else {
        this.stop(false);
        this.emit({ state: "idle", activeId: null, error: "Female voice is temporarily unavailable for this language. Please try again." });
      }
    }
  }

  private playNextChunk() {
    if (
      this.state !== "speaking" ||
      !this.activeId ||
      this.currentChunkIndex >= this.currentChunks.length
    ) {
      this.state = "idle";
      this.activeId = null;
      this.emit({ state: "idle", activeId: null });
      return;
    }

    const chunkText = this.currentChunks[this.currentChunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunkText);
    this.currentUtterance = utterance; // Prevent Chromium garbage-collection audio cutoff

    const voice = this.getBestVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "en-US";
    } else {
      utterance.lang = this.settings.language || "en-US";
    }

    utterance.rate = this.settings.rate || 0.95;
    utterance.pitch = this.settings.pitch || 1.0;
    utterance.volume = this.settings.volume ?? 1.0;

    utterance.onend = () => {
      this.currentUtterance = null;
      this.currentChunkIndex++;
      this.playNextChunk();
    };

    utterance.onerror = (ev) => {
      this.currentUtterance = null;
      // "interrupted" or "canceled" are standard when stop() is called
      if (ev.error !== "interrupted" && ev.error !== "canceled") {
        console.warn("[AIVoiceService] Utterance error:", ev.error);
      }
      this.currentChunkIndex++;
      this.playNextChunk();
    };

    try {
      if (typeof window !== "undefined" && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[AIVoiceService] speak failed:", err);
      this.stop();
    }
  }

  public pause() {
    if (this.audio) this.audio.pause();
    if (!this.isSupported()) return;
    if (this.state === "speaking") {
      window.speechSynthesis.pause();
      this.state = "paused";
      this.emit({ state: "paused", activeId: this.activeId });
    }
  }

  public resume() {
    if (this.audio) void this.audio.play();
    if (!this.isSupported()) return;
    if (this.state === "paused") {
      window.speechSynthesis.resume();
      this.state = "speaking";
      this.emit({ state: "speaking", activeId: this.activeId });
    }
  }

  public stop(emitIdle = true) {
    this.speechVersion++;
    this.speechRequest?.abort();
    this.speechRequest = null;
    if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); this.audio.src = ""; this.audio = null; }
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = null;
    if (!this.isSupported()) return;
    try {
      if (this.currentUtterance) {
        this.currentUtterance.onend = null;
        this.currentUtterance.onerror = null;
        this.currentUtterance = null;
      }
      window.speechSynthesis.cancel();
    } catch {}
    this.currentChunks = [];
    this.currentChunkIndex = 0;
    const prevId = this.activeId;
    this.state = "idle";
    this.activeId = null;
    if (emitIdle) this.emit({ state: "idle", activeId: null });
  }
}

export const aiVoiceService = new AIVoiceService();
