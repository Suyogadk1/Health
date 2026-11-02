"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  History,
  Sparkles,
  Plus,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Search,
  ArrowRight,
  ShieldCheck,
  Volume2,
  VolumeX,
  Square,
  Play,
  Pause,
  RotateCcw,
  Mic,
  Heart,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { CHAT_LANGUAGES } from "@/lib/voice/languages";
import { ChatInput } from "./ChatInput";
import { BackButton } from "@/components/navigation/BackButton";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types";
import { useAIVoice } from "@/hooks/useAIVoice";

export interface CheckinData {
  id?: string;
  mood: string;
  stress_level?: number;
  sleep_quality?: number;
  energy_level?: number;
  clarity_level?: number;
  score?: number;
  insight?: string;
  notes?: string;
  created_at: string;
}

export function getCheckinSuggestions(c?: CheckinData | null): { label: string; prompt: string }[] {
  if (!c) return [];
  const suggestions: { label: string; prompt: string }[] = [];

  // Note/intention suggestion
  if (c.notes && c.notes.trim()) {
    suggestions.push({
      label: `Reflect on: "${c.notes.slice(0, 24)}${c.notes.length > 24 ? "…" : ""}"`,
      prompt: `Earlier today I set this personal intention: "${c.notes}". Can we talk through how to approach it with calm focus?`,
    });
  }

  // Stress-focused
  if ((c.stress_level && c.stress_level <= 2) || c.mood === "stressed") {
    suggestions.push({
      label: "Decompress today's tension",
      prompt: "My stress levels feel high today. Can you help me gently decompress and find perspective?",
    });
    suggestions.push({
      label: "2-min calming breathwork",
      prompt: "Can you guide me through a 2-minute mindful breathing exercise to calm my nervous system?",
    });
  }

  // Energy-focused
  if ((c.energy_level && c.energy_level <= 2) || c.mood === "low") {
    suggestions.push({
      label: "Low-energy pacing plan",
      prompt: "My energy reserves are depleted today. Can we discuss low-pressure pacing so I don't burn out?",
    });
  }

  // Sleep-focused
  if (c.sleep_quality && c.sleep_quality <= 2) {
    suggestions.push({
      label: "Restore after poor sleep",
      prompt: "My sleep was broken last night and my head feels heavy. How can I be kind to myself today?",
    });
  }

  // Clarity-focused
  if (c.clarity_level && c.clarity_level <= 2) {
    suggestions.push({
      label: "Untangle racing thoughts",
      prompt: "My mind feels scattered with competing thoughts. Can you help me untangle what matters right now?",
    });
  }

  // High score / Flourishing
  if ((c.score && c.score >= 75) || c.mood === "great" || c.mood === "good") {
    suggestions.push({
      label: "Anchor positive momentum",
      prompt: `I'm feeling good and balanced today (${c.score ? `${c.score}/100` : c.mood}). How can I anchor this positive momentum?`,
    });
  }

  // Fallback mindful check-in
  if (suggestions.length < 3) {
    suggestions.push({
      label: "Explore today's check-in",
      prompt: `I just checked in feeling ${c.mood}${c.score ? ` with a wellbeing score of ${c.score}/100` : ""}. What mindful reflection do you have for me today?`,
    });
  }

  return suggestions.slice(0, 3);
}

interface InterconnectedChat {
  id: string;
  title: string;
  relativeTime: string;
  userSnippets?: string[];
  assistantSummary?: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
  messages?: { content: string; created_at: string }[];
}

export function ChatWindow({
  conversationId,
  initialMessages,
  isGuest = false,
}: {
  conversationId: string;
  initialMessages: Message[];
  isGuest?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cross-chat interconnection states
  const [interconnectedChats, setInterconnectedChats] = useState<InterconnectedChat[]>([]);
  const [allConversations, setAllConversations] = useState<ConversationSummary[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMemoryDetails, setShowMemoryDetails] = useState(false);

  // AI Voice and Daily Check-in states
  const {
    isSpeaking,
    activeId,
    speak,
    stop,
    autoSpeak,
    toggleAutoSpeak,
    isSupported: voiceSupported,
    settings: voiceSettings,
    updateSettings: updateVoiceSettings,
    voices,
  } = useAIVoice();
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const [latestCheckin, setLatestCheckin] = useState<CheckinData | null>(null);
  const [showCheckinBanner, setShowCheckinBanner] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 || pending) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pending]);

  // Load interconnected previous chats, full conversations, and latest check-in
  useEffect(() => {
    async function fetchChatData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        };

        // 1. Fetch cross-chat context for current conversation
        const ctxRes = await fetch(`/api/conversations/context?conversationId=${conversationId}`, {
          headers,
        });
        if (ctxRes.ok) {
          const ctxData = await ctxRes.json();
          if (ctxData.data && Array.isArray(ctxData.data)) {
            setInterconnectedChats(ctxData.data);
          }
        }

        // 2. Fetch all previous conversations for the drawer
        const convRes = await fetch("/api/conversations", { headers });
        if (convRes.ok) {
          const convData = await convRes.json();
          if (convData.data && Array.isArray(convData.data)) {
            setAllConversations(convData.data);
          }
        }

        // 3. Fetch latest check-in for daily mood context & AI suggestions
        const chkRes = await fetch("/api/checkins?limit=1", { headers });
        if (chkRes.ok) {
          const chkData = await chkRes.json();
          if (chkData.latest || (chkData.data && chkData.data[0])) {
            setLatestCheckin(chkData.latest || chkData.data[0]);
          }
        }
      } catch (err) {
        console.warn("[ChatWindow] Failed to load previous chats context:", err);
      }
    }

    fetchChatData();
  }, [conversationId]);

  // Handle starting a new conversation
  async function handleNewChat() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ title: "New reflection" }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.id) {
          router.push(`/chat/${json.data.id}`);
          setDrawerOpen(false);
          return;
        }
      }
    } catch {}
    router.push(`/chat?t=${Date.now()}`);
    setDrawerOpen(false);
  }

  // Handle deleting a conversation from drawer
  async function handleDeleteConvo(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
      });
      setAllConversations((prev) => prev.filter((c) => c.id !== id));
      setInterconnectedChats((prev) => prev.filter((c) => c.id !== id));
      if (id === conversationId) {
        router.push("/chat");
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  }

  async function handleSend(text: string) {
    setError(null);
    const optimisticUser: Message = {
      id: `local-${Date.now()}`,
      conversationId,
      userId: "",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setPending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || "demo-token"}`,
        },
        body: JSON.stringify({ conversationId, message: text, language: voiceSettings.language || "en-US" }),
      });

      if (!res.ok) throw new Error("request failed");
      const data = await res.json();

      const assistantMsgId = `local-${Date.now()}-assistant`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          conversationId,
          userId: "",
          role: "assistant",
          content: data.reply,
          createdAt: new Date().toISOString(),
          risk: data.risk,
          isDangerous: data.risk === "high",
          provider: data.provider,
          attempts: data.attempts,
          agentALevel: data.agentALevel,
          agentBLevel: data.agentBLevel,
          overridden: data.overridden,
        },
      ]);

      // If Auto-Voice Narration is enabled, immediately narrate reply
      if (autoSpeak && data.reply) {
        speak(data.reply, assistantMsgId);
      }

      // Update interconnected chats if returned by backend
      if (data.interconnectedChats && Array.isArray(data.interconnectedChats)) {
        setInterconnectedChats(data.interconnectedChats);
      }

      // Refresh conversations list in background
      fetch("/api/conversations")
        .then((r) => r.json())
        .then((d) => {
          if (d.data) setAllConversations(d.data);
        })
        .catch(() => {});
    } catch {
      setError("I'm having trouble connecting right now. Please try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  // Filter conversations for drawer
  const filteredConversations = allConversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-sand/30">
      <label className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">Conversation language
        <select aria-label="Conversation language" value={voiceSettings.language || "en-US"} onChange={e => { stop(); updateVoiceSettings({ language: e.target.value, voiceURI: undefined }); }} className="rounded-lg border p-2">
          {CHAT_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <span>Choose a language, tap the microphone, then send. Enable Voice On to hear replies.</span>
        <span>Clear female narration in your selected language.</span>
      </label>
      {/* 1. Header with Interconnection & Previous Chats Button */}
      <div className="flex items-center justify-between border-b border-charcoal/[0.07] bg-white/80 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-3.5 z-10">
        <div className="flex items-center gap-2.5">
          <BackButton fallbackHref="/dashboard" label="Dashboard" />
          <div className="border-l border-charcoal/10 pl-2.5">
            <h1 className="font-serif text-base sm:text-lg text-charcoal flex items-center gap-2">
              Mindful Assistant
              {interconnectedChats.length > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 text-[11px] font-sans font-medium">
                  <Sparkles size={11} className="text-emerald-600" />
                  Interconnected ({interconnectedChats.length})
                </span>
              )}
            </h1>
            <p className="text-[10px] sm:text-xs text-soft-gray">
              Here to listen with continuous memory across chats
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Active Speaking Indicator with 1-tap Stop */}
          {isSpeaking && (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-700 text-warm-white px-2.5 py-1.5 text-xs font-medium shadow-xs hover:bg-emerald-800 transition-all cursor-pointer animate-pulse"
              title="Stop current voice narration"
              aria-label="Stop speech narration"
            >
              <span className="flex items-end gap-0.5 h-3 w-2.5">
                <span className="w-0.5 bg-warm-white rounded-full animate-bounce h-2" style={{ animationDelay: "0ms" }} />
                <span className="w-0.5 bg-warm-white rounded-full animate-bounce h-3" style={{ animationDelay: "150ms" }} />
                <span className="w-0.5 bg-warm-white rounded-full animate-bounce h-1.5" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="text-[11px] font-semibold hidden sm:inline">Speaking</span>
              <Square size={10} fill="currentColor" />
            </button>
          )}

          {/* Auto-Voice Narration Toggle */}
          {voiceSupported && (
            <button
              onClick={toggleAutoSpeak}
              className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                autoSpeak
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500 shadow-xs"
                  : "border-charcoal/10 bg-warm-white text-charcoal/70 hover:bg-cream"
              }`}
              title={autoSpeak ? "Auto-narrate replies is ON (Click to mute)" : "Click to auto-narrate AI replies aloud"}
              aria-label={autoSpeak ? "Auto-narrate replies is ON" : "Turn on auto-narrate replies"}
            >
              {autoSpeak ? (
                <Volume2 size={13} className="text-emerald-700 shrink-0" />
              ) : (
                <VolumeX size={13} className="text-charcoal/50 shrink-0" />
              )}
              <span className="hidden md:inline">{autoSpeak ? "Voice On" : "Voice Off"}</span>
            </button>
          )}

          {/* Voice Settings Popover Trigger */}
          {voiceSupported && (
            <button
              onClick={() => setVoiceSettingsOpen(!voiceSettingsOpen)}
              className="rounded-xl border border-charcoal/10 bg-warm-white hover:bg-cream p-1.5 text-charcoal/70 transition-all cursor-pointer"
              title="Voice narration settings"
              aria-label="Voice settings"
            >
              <Sliders size={14} />
            </button>
          )}

          {/* Previous Chats Drawer Trigger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-charcoal/10 bg-warm-white hover:bg-cream px-3 py-1.5 text-xs font-medium text-charcoal shadow-sm transition-all active:scale-95"
            title="Open previous chats"
          >
            <History size={14} className="text-deep-sage" />
            <span className="hidden sm:inline">Previous chats</span>
            {allConversations.length > 0 && (
              <span className="ml-0.5 rounded-full bg-deep-sage/10 px-1.5 py-0.2 text-[10px] text-deep-sage font-semibold">
                {allConversations.length}
              </span>
            )}
          </button>

          {/* Quick New Chat Button */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 rounded-xl bg-deep-sage px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-deep-sage/90 transition-all active:scale-95"
            title="Start new conversation"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </div>
      </div>

      {/* Voice Settings Dropdown Modal / Popover */}
      {voiceSettingsOpen && voiceSupported && (
        <div className="relative border-b border-charcoal/10 bg-warm-white px-5 py-4 shadow-sm z-20 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-charcoal/[0.06] pb-2.5">
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-deep-sage" />
              <h3 className="font-serif text-sm font-semibold text-charcoal">AI Voice Narration Settings</h3>
            </div>
            <button
              onClick={() => setVoiceSettingsOpen(false)}
              className="rounded-lg p-1 text-soft-gray hover:bg-cream hover:text-charcoal"
            >
              <X size={15} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Preferred Voice Selector */}
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Mindful Voice Voice Profile
              </label>
              <p className="text-xs text-charcoal">A clear female voice is selected automatically for English, Hindi, Tamil, Telugu and Nepali.</p>
            </div>

            {/* Pacing Speed */}
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Narration Pacing
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "Gentle (0.85x)", val: 0.85 },
                  { label: "Calm (0.95x)", val: 0.95 },
                  { label: "Normal (1.05x)", val: 1.05 },
                ].map((speed) => (
                  <button
                    key={speed.val}
                    type="button"
                    onClick={() => updateVoiceSettings({ rate: speed.val })}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all ${
                      voiceSettings.rate === speed.val
                        ? "border-deep-sage bg-sage/20 text-deep-sage font-semibold"
                        : "border-charcoal/10 bg-white hover:bg-cream text-charcoal"
                    }`}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => speak("Hello, this is MindCare. I am here to hold space for your thoughts today.", "sample-test")}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-deep-sage hover:underline"
                >
                  <Volume2 size={12} /> Test voice sample
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Today's Wellbeing Check-in Context & AI Suggestion Chips Banner */}
      {latestCheckin && showCheckinBanner && (
        <div className="border-b border-sage/30 bg-[#F4F6F2] px-4 py-2.5 sm:px-6 transition-all animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage/20 text-sm">
                {latestCheckin.mood === "great"
                  ? "🌿"
                  : latestCheckin.mood === "good"
                  ? "☀️"
                  : latestCheckin.mood === "okay"
                  ? "⛅"
                  : latestCheckin.mood === "low"
                  ? "🌧️"
                  : "🌪️"}
              </span>
              <div>
                <span className="font-semibold text-charcoal">
                  Today's Check-in:{" "}
                  <span className="capitalize">{latestCheckin.mood}</span>
                  {typeof latestCheckin.score === "number" && (
                    <span className="ml-1 rounded-full bg-deep-sage/10 px-2 py-0.5 text-[11px] font-bold text-deep-sage">
                      {latestCheckin.score}/100
                    </span>
                  )}
                </span>
                {latestCheckin.notes && (
                  <span className="ml-1.5 text-soft-gray italic text-[11px] hidden md:inline">
                    — Intention: "{latestCheckin.notes.slice(0, 40)}{latestCheckin.notes.length > 40 ? "…" : ""}"
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-semibold text-deep-sage tracking-wider">
                AI Suggestions:
              </span>
              <button
                onClick={() => setShowCheckinBanner(false)}
                className="rounded-full p-1 text-soft-gray hover:text-charcoal hover:bg-cream"
                title="Dismiss banner"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Interactive Suggestion Chips */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {getCheckinSuggestions(latestCheckin).map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(sug.prompt)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full border border-sage/50 bg-warm-white hover:bg-deep-sage hover:text-warm-white hover:border-deep-sage px-3 py-1 text-xs font-medium text-charcoal transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                title={`Ask: "${sug.prompt}"`}
              >
                <Sparkles size={11} className="text-deep-sage hover:text-warm-white shrink-0" />
                <span>{sug.label}</span>
                <ArrowRight size={10} className="opacity-60" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2b. Cross-Chat Interconnection Banner */}
      {interconnectedChats.length > 0 && (
        <div className="border-b border-emerald-900/10 bg-emerald-50/70 px-4 py-2 sm:px-6 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-emerald-900">
              <Sparkles size={13} className="text-emerald-700 shrink-0" />
              <span className="font-medium">Continuous context active:</span>
              <span className="truncate text-emerald-800">
                Connected with {interconnectedChats.map((c) => `"${c.title}"`).join(", ")}
              </span>
            </div>
            <button
              onClick={() => setShowMemoryDetails(!showMemoryDetails)}
              className="flex items-center gap-1 text-[11px] font-medium text-emerald-800 hover:text-emerald-950 underline underline-offset-2 shrink-0"
            >
              {showMemoryDetails ? "Hide memory" : "How it works"}
              {showMemoryDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {showMemoryDetails && (
            <div className="mt-2.5 pt-2 border-t border-emerald-200/50 text-xs text-emerald-950 space-y-2">
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                MindCare connects themes from your previous conversations so you never have to repeat yourself.
                The assistant holds your past reflections in mind while focusing on what is present today:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {interconnectedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="rounded-lg bg-white/80 border border-emerald-200/60 p-2 text-left"
                  >
                    <div className="flex items-center justify-between text-[11px] font-medium text-charcoal">
                      <span className="truncate">{chat.title}</span>
                      <span className="text-soft-gray text-[10px] shrink-0 ml-1">{chat.relativeTime}</span>
                    </div>
                    {chat.userSnippets && chat.userSnippets.length > 0 && (
                      <p className="mt-1 text-[10px] text-soft-gray line-clamp-2 italic">
                        "{chat.userSnippets[chat.userSnippets.length - 1]}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Messages Stream */}
      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {messages.length === 0 && (
          <div className="mx-auto my-6 max-w-md rounded-2xl border border-charcoal/10 bg-white/80 p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-deep-sage/10 text-deep-sage">
              <Sparkles size={20} />
            </div>
            <h3 className="font-serif text-base text-charcoal font-medium">Quiet Sanctuary</h3>
            <p className="mt-1 text-xs text-soft-gray leading-relaxed">
              What is present for you today? Your reflections are held with gentle care and connected across your journey.
            </p>

            {/* Voice & Speech Integration Highlights */}
            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              <div className="rounded-xl border border-charcoal/5 bg-cream/60 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal">
                  <Mic size={13} className="text-rose-600" />
                  <span>Voice Speech Input</span>
                </div>
                <p className="mt-0.5 text-[11px] text-soft-gray leading-snug">
                  Tap the microphone icon in the chat bar below to dictate your thoughts naturally.
                </p>
              </div>

              <div className="rounded-xl border border-charcoal/5 bg-cream/60 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal">
                  <Volume2 size={13} className="text-emerald-700" />
                  <span>AI Voice Narration</span>
                </div>
                <p className="mt-0.5 text-[11px] text-soft-gray leading-snug">
                  Tap "Listen" on any reply or toggle Voice Auto-Read to hear responses spoken aloud.
                </p>
              </div>
            </div>

            {/* If recent check-in exists, surface quick suggestion starters */}
            {latestCheckin && (
              <div className="mt-4 rounded-xl bg-sage/15 p-3.5 text-left border border-sage/30">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-deep-sage mb-2">
                  <Sparkles size={13} />
                  <span>Suggested reflections from today's check-in:</span>
                </div>
                <div className="space-y-1.5">
                  {getCheckinSuggestions(latestCheckin).map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSend(sug.prompt)}
                      disabled={pending}
                      className="flex w-full items-center justify-between rounded-lg bg-white/90 p-2 text-left text-xs font-medium text-charcoal hover:bg-white hover:text-deep-sage border border-charcoal/5 transition-all shadow-2xs"
                    >
                      <span>{sug.label}</span>
                      <ArrowRight size={11} className="text-soft-gray shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {interconnectedChats.length > 0 && (
              <div className="mt-4 rounded-xl bg-sand/40 p-3 text-left border border-charcoal/5">
                <p className="text-[11px] font-medium text-charcoal flex items-center gap-1.5">
                  <History size={12} className="text-deep-sage" />
                  Recent reflections connected:
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {interconnectedChats.map((c) => (
                    <span
                      key={c.id}
                      className="rounded-lg bg-white/90 px-2 py-1 text-[10px] text-charcoal font-medium border border-charcoal/5"
                    >
                      {c.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pending && <TypingIndicator />}
        {error && <p className="text-sm text-dusty-rose text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* 4. Chat Input Area with Live Voice Narration Dock */}
      <div className="shrink-0 px-4 pb-3 md:pb-4 sm:px-6 bg-white/80 backdrop-blur-xs border-t border-charcoal/[0.06] pt-3 z-10">
        {/* Floating Active Voice Narration Dock */}
        {(isSpeaking || voiceSettingsOpen) && (
          <div className="mb-2.5 flex items-center justify-between gap-3 rounded-2xl bg-emerald-950 text-white px-3.5 py-2 shadow-lg border border-emerald-700/60 animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Animated wave bars */}
              <span className="flex items-end gap-0.5 h-3.5 w-3.5 shrink-0">
                <span
                  className={`w-0.5 bg-emerald-400 rounded-full h-2 ${isSpeaking ? "animate-bounce" : ""}`}
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className={`w-0.5 bg-emerald-400 rounded-full h-3.5 ${isSpeaking ? "animate-bounce" : ""}`}
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className={`w-0.5 bg-emerald-400 rounded-full h-1.5 ${isSpeaking ? "animate-bounce" : ""}`}
                  style={{ animationDelay: "300ms" }}
                />
                <span
                  className={`w-0.5 bg-emerald-400 rounded-full h-3 ${isSpeaking ? "animate-bounce" : ""}`}
                  style={{ animationDelay: "100ms" }}
                />
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
                  <span>{isSpeaking ? "Narrating AI Response" : "AI Voice Narration Ready"}</span>
                  {autoSpeak && (
                    <span className="rounded-full bg-emerald-800/80 px-1.5 py-0.2 text-[9px] text-emerald-300 font-sans">
                      Auto-Read ON
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-emerald-300/70 truncate">
                  {isSpeaking ? "MindCare speech synthesis playing..." : "Pacing: " + voiceSettings.rate + "x"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Stop button */}
              {isSpeaking && (
                <button
                  type="button"
                  onClick={stop}
                  className="flex h-7 px-2.5 items-center gap-1 rounded-full bg-rose-700/90 text-white hover:bg-rose-600 transition-colors text-[11px] font-medium cursor-pointer shadow-xs"
                  title="Stop voice narration"
                >
                  <Square size={10} fill="currentColor" />
                  <span>Stop</span>
                </button>
              )}

              {/* Replay last message */}
              {messages.filter((m) => m.role === "assistant").length > 0 && !isSpeaking && (
                <button
                  type="button"
                  onClick={() => {
                    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
                    if (lastAssistant) speak(lastAssistant.content, lastAssistant.id);
                  }}
                  className="flex h-7 px-2.5 items-center gap-1 rounded-full bg-emerald-800 text-white hover:bg-emerald-700 transition-colors text-[11px] font-medium cursor-pointer"
                  title="Replay latest response"
                >
                  <RotateCcw size={11} />
                  <span>Re-read</span>
                </button>
              )}
            </div>
          </div>
        )}

        <ChatInput
          key={voiceSettings.language || "en-US"}
          language={voiceSettings.language || "en-US"}
          onVoiceStart={stop}
          onSend={handleSend}
          disabled={pending}
          autoSpeak={autoSpeak}
          onToggleAutoSpeak={toggleAutoSpeak}
        />
        <p className="mt-2 text-center text-[11px] text-soft-gray">
          AI companion support with voice dictation & speech narration. Not a medical diagnostic tool or substitute for professional care.
        </p>
      </div>

      {/* 5. Slide-over Drawer for Previous Chats */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-charcoal/30 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-md bg-warm-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-charcoal/[0.08] px-5 py-4">
              <div>
                <h2 className="font-serif text-lg font-medium text-charcoal flex items-center gap-2">
                  <History size={18} className="text-deep-sage" />
                  Previous Chats
                </h2>
                <p className="text-xs text-soft-gray mt-0.5">
                  All your past check-ins and reflections
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-1 rounded-xl bg-deep-sage px-3 py-1.5 text-xs font-medium text-white hover:bg-deep-sage/90"
                >
                  <Plus size={14} />
                  New
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-charcoal/60 hover:bg-cream hover:text-charcoal transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search filter */}
            <div className="p-4 border-b border-charcoal/[0.06]">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft-gray" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search previous chats..."
                  className="w-full rounded-xl border border-charcoal/10 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-deep-sage/30"
                />
              </div>
            </div>

            {/* Conversation Cards List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-soft-gray">No conversations found.</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isCurrent = conv.id === conversationId;
                  const lastMessage =
                    conv.messages && conv.messages.length > 0
                      ? conv.messages[conv.messages.length - 1].content
                      : "Start a conversation";

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        router.push(`/chat/${conv.id}`);
                        setDrawerOpen(false);
                      }}
                      className={`group relative flex flex-col rounded-xl border p-3.5 text-left cursor-pointer transition-all ${
                        isCurrent
                          ? "bg-deep-sage/5 border-deep-sage/30 shadow-sm"
                          : "bg-white border-charcoal/[0.08] hover:border-deep-sage/30 hover:bg-cream/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm text-charcoal truncate flex items-center gap-1.5">
                          {conv.title}
                          {isCurrent && (
                            <span className="text-[10px] bg-deep-sage text-white font-sans px-1.5 py-0.2 rounded-md font-medium">
                              Active
                            </span>
                          )}
                        </span>
                        <button
                          onClick={(e) => handleDeleteConvo(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-soft-gray hover:text-dusty-rose transition-opacity"
                          title="Delete chat"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <p className="mt-1 text-xs text-soft-gray line-clamp-2">
                        {lastMessage}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-soft-gray">
                        <span>{new Date(conv.updated_at).toLocaleDateString()}</span>
                        <span className="flex items-center gap-0.5 text-deep-sage font-medium group-hover:translate-x-0.5 transition-transform">
                          {isCurrent ? "Currently viewing" : "Open reflection"}
                          <ArrowRight size={11} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer info */}
            <div className="border-t border-charcoal/[0.08] p-4 bg-cream/30 text-center text-[11px] text-soft-gray flex items-center justify-center gap-1.5">
              <ShieldCheck size={13} className="text-deep-sage" />
              <span>All previous reflections safely encrypted and interconnected.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

