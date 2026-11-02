"use client";

import { cn } from "@/lib/utils/cn";
import {
  AlertTriangle,
  Sparkles,
  Phone,
  ShieldAlert,
  HeartHandshake,
  ShieldCheck,
  ArrowRightLeft,
  Volume2,
  Square,
} from "lucide-react";
import type { Message } from "@/types";
import { useAIVoice } from "@/hooks/useAIVoice";

function isDangerousOutput(content: string, risk?: string, isDangerous?: boolean): boolean {
  if (isDangerous === true || risk === "high") return true;
  if (!content) return false;

  const lower = content.toLowerCase();
  if (
    lower.includes("emergency service") ||
    lower.includes("crisis line") ||
    lower.includes("hurt yourself") ||
    lower.includes("emergency department") ||
    lower.includes("call 988") ||
    lower.includes("harm yourself") ||
    lower.includes("suicide prevention") ||
    lower.includes("kill yourself") ||
    lower.includes("end your life")
  ) {
    return true;
  }

  return false;
}

function getProviderLabel(provider?: string): string {
  if (!provider) return "";
  if (provider.includes("Gemini 1")) return "Gemini 1";
  if (provider.includes("Gemini 2")) return "Gemini 2";
  if (provider.includes("Gemini")) return "Gemini";
  if (provider.includes("Grok") || provider.includes("Groq")) return "Grok";
  if (provider.includes("Nemotron")) return "Nemotron";
  if (provider.includes("Mindful Local")) return "Mindful Local";
  if (provider.includes("Safety")) return "Safety Guardrail";
  return provider.replace(/\s*\(.*?\)/g, "").trim();
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const dangerous = isDangerousOutput(message.content, (message as any).risk, (message as any).isDangerous);
  const providerLabel = getProviderLabel(message.provider);
  const attempts = message.attempts || [];

  const { isSpeaking, activeId, toggle, isSupported: voiceSupported } = useAIVoice();
  const isVoiceActive = isSpeaking && activeId === message.id;

  // Primary chat tier is Gemini 1 (or Gemini).
  // A failover occurred if multiple attempts were made (runtime failover),
  // OR if the provider that answered is a secondary/failover/fallback tier (config-time failover, e.g. primary key disabled).
  const isPrimary = (providerLabel === "Gemini 1" || providerLabel === "Gemini") && attempts.length <= 1;
  const isFailover = !isPrimary && Boolean(providerLabel) && providerLabel !== "Safety Guardrail";

  // 1. User Message (Right-aligned bubble)
  if (isUser) {
    return (
      <div className="flex justify-end my-1.5">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-charcoal text-warm-white dark:bg-warm-white dark:text-charcoal dark:border dark:border-charcoal/15 rounded-br-sm shadow-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.createdAt && (
            <p className="mt-1 text-right text-[10px] text-warm-white/60 dark:text-charcoal/50 font-sans">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 2. Dangerous Output -> Crisis Support Box + understated element below
  if (dangerous) {
    return (
      <div className="flex flex-col items-start my-2 max-w-[92%] sm:max-w-[85%]">
        <div
          data-testid="dangerous-output-box"
          className="relative w-full rounded-2xl p-4 sm:p-5 text-sm leading-relaxed bg-red-50/95 border-2 border-red-500/80 text-red-950 rounded-bl-sm shadow-md transition-all animate-in fade-in duration-200"
        >
          {/* Red Alert Header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-red-200 text-xs font-semibold text-red-700">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white animate-pulse">
                <AlertTriangle size={12} />
              </span>
              <span>Safety & Crisis Support — Immediate Care</span>
            </div>

            {voiceSupported && (
              <button
                type="button"
                onClick={() => toggle(message.content, message.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer select-none",
                  isVoiceActive
                    ? "bg-red-700 text-white shadow-xs"
                    : "bg-red-100 hover:bg-red-200 text-red-800"
                )}
                title={isVoiceActive ? "Stop speech narration" : "Listen to this crisis guidance"}
                aria-label={isVoiceActive ? "Stop voice narration" : "Listen to voice narration"}
              >
                {isVoiceActive ? (
                  <>
                    <span className="flex items-end gap-0.5 h-3 w-2.5">
                      <span className="w-0.5 bg-white rounded-full animate-bounce h-2" style={{ animationDelay: "0ms" }} />
                      <span className="w-0.5 bg-white rounded-full animate-bounce h-3" style={{ animationDelay: "150ms" }} />
                      <span className="w-0.5 bg-white rounded-full animate-bounce h-1.5" style={{ animationDelay: "300ms" }} />
                    </span>
                    <span className="text-[10px]">Speaking…</span>
                    <Square size={9} fill="currentColor" />
                  </>
                ) : (
                  <>
                    <Volume2 size={12} className="shrink-0 text-red-700" />
                    <span className="text-[10px]">Listen</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Body */}
          <p className="whitespace-pre-wrap text-red-950 font-medium leading-relaxed">
            {message.content}
          </p>

          {/* Quick Helplines / Resources */}
          <div className="mt-3.5 pt-2.5 border-t border-red-200/90 flex flex-wrap items-center gap-2 text-[11px]">
            <a
              href="tel:988"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 transition-all shadow-sm active:scale-95"
            >
              <Phone size={13} />
              Call or Text 988 (Lifeline)
            </a>
            <a
              href="tel:911"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-red-300 px-2.5 py-1.5 font-medium text-red-800 hover:bg-red-100 transition-colors shadow-xs"
            >
              <ShieldAlert size={13} />
              Emergency: 911 / 112
            </a>
            <a
              href="sms:741741"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-red-300 px-2.5 py-1.5 font-medium text-red-800 hover:bg-red-100 transition-colors shadow-xs"
            >
              <HeartHandshake size={13} />
              Text HOME to 741741
            </a>
          </div>
        </div>

        {/* Small, understated UI element below assistant message */}
        <div
          data-testid="assistant-meta"
          className="mt-1.5 px-1 flex items-center gap-2 flex-wrap text-[11px]"
        >
          {providerLabel && (
            isFailover ? (
              <span
                data-testid="provider-failover-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-900 border border-red-300 shadow-xs"
                title={attempts.length > 1 ? `Failover sequence: ${attempts.join(" → ")}` : `Failover tier active: ${providerLabel}`}
              >
                <ArrowRightLeft size={11} className="text-red-700 shrink-0" />
                <span>via {providerLabel} (failover)</span>
              </span>
            ) : (
              <span
                data-testid="provider-badge"
                className="text-[11px] text-red-800/60 font-sans tracking-wide"
              >
                via {providerLabel}
              </span>
            )
          )}

          {message.overridden && (
            <span
              data-testid="safety-reviewed-badge"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-200 text-red-950 border border-red-400 shadow-xs"
              title="Safety reviewer verified and finalized this response"
            >
              <ShieldCheck size={11.5} className="text-red-800 shrink-0" />
              <span>safety reviewed</span>
            </span>
          )}

          {message.createdAt && (
            <span className="text-[10px] text-red-600/70 font-sans ml-0.5">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 3. Normal Output -> Companion Box + understated element below
  return (
    <div className="flex flex-col items-start my-2 max-w-[90%] sm:max-w-[80%]">
      <div
        data-testid="normal-output-box"
        className="relative w-full rounded-2xl p-4 sm:p-4.5 text-sm leading-relaxed bg-emerald-50/90 border border-emerald-300/80 text-emerald-950 dark:bg-emerald-950/35 dark:border-emerald-700/60 dark:text-emerald-100 rounded-bl-sm shadow-xs transition-all"
      >
        {/* Green Companion Header */}
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-emerald-200/70 dark:border-emerald-800/60 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Mindful Companion</span>
          </div>

          {voiceSupported && (
            <button
              type="button"
              onClick={() => toggle(message.content, message.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer select-none",
                isVoiceActive
                  ? "bg-emerald-700 text-warm-white shadow-xs ring-1 ring-emerald-500"
                  : "bg-emerald-100/90 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 dark:hover:bg-emerald-800/80"
              )}
              title={isVoiceActive ? "Stop speech narration" : "Listen to this response with AI voice"}
              aria-label={isVoiceActive ? "Stop voice narration" : "Listen to voice narration"}
            >
              {isVoiceActive ? (
                <>
                  <span className="flex items-end gap-0.5 h-3 w-2.5">
                    <span className="w-0.5 bg-warm-white rounded-full animate-bounce h-2" style={{ animationDelay: "0ms" }} />
                    <span className="w-0.5 bg-warm-white rounded-full animate-bounce h-3" style={{ animationDelay: "150ms" }} />
                    <span className="w-0.5 bg-warm-white rounded-full animate-bounce h-1.5" style={{ animationDelay: "300ms" }} />
                  </span>
                  <span className="text-[10px] font-semibold">Narrating…</span>
                  <Square size={9} fill="currentColor" className="ml-0.5" />
                </>
              ) : (
                <>
                  <Volume2 size={12} className="shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <span className="text-[10px]">Listen</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Body */}
        <p className="whitespace-pre-wrap text-emerald-950 dark:text-emerald-100 leading-relaxed">
          {message.content}
        </p>
      </div>

      {/* Small, understated UI element below assistant message */}
      <div
        data-testid="assistant-meta"
        className="mt-1.5 px-1 flex items-center gap-2 flex-wrap text-[11px]"
      >
        {providerLabel && (
          isFailover ? (
            <span
              data-testid="provider-failover-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700/70 shadow-xs transition-all"
              title={attempts.length > 1 ? `Failover sequence: ${attempts.join(" → ")}` : `Failover tier active: ${providerLabel}`}
            >
              <ArrowRightLeft size={11} className="text-amber-700 dark:text-amber-400 shrink-0" />
              <span>via {providerLabel} (failover)</span>
            </span>
          ) : (
            <span
              data-testid="provider-badge"
              className="text-[11px] text-charcoal/45 dark:text-charcoal/60 font-sans tracking-wide"
            >
              via {providerLabel}
            </span>
          )
        )}

        {message.overridden && (
          <span
            data-testid="safety-reviewed-badge"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-950 border border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-700/70 shadow-xs transition-all"
            title={`Safety reviewer (Agent B) verified and finalized response${message.agentBLevel ? ` (Risk: ${message.agentBLevel})` : ""}`}
          >
            <ShieldCheck size={11.5} className="text-indigo-700 dark:text-indigo-400 shrink-0" />
            <span>safety reviewed</span>
          </span>
        )}

        {message.createdAt && (
          <span className="text-[10px] text-charcoal/40 dark:text-charcoal/50 font-sans ml-0.5">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
