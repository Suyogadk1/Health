"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { Sparkles, MessageCircle, Mic, Waves } from "lucide-react";
import type { VoiceState } from "@/types";

const AICompanion = dynamic(
  () => import("@/components/3d/AICompanion").then((m) => m.AICompanion),
  { ssr: false }
);

interface StateOption {
  state: VoiceState;
  label: string;
  sublabel: string;
  accent: string;
  icon: typeof Sparkles;
}

const STATES: StateOption[] = [
  {
    state: "idle",
    label: "Resting",
    sublabel: "Calm, gentle breathing",
    accent: "bg-sage/15 text-deep-sage border-sage/30",
    icon: Sparkles,
  },
  {
    state: "listening",
    label: "Listening",
    sublabel: "Lavender attunement",
    accent: "bg-lavender/25 text-[#5D5280] border-lavender/40",
    icon: Mic,
  },
  {
    state: "thinking",
    label: "Reflecting",
    sublabel: "Warm contemplation",
    accent: "bg-[#F4EEE3] text-[#8A7B54] border-[#D8C8AD]/50",
    icon: MessageCircle,
  },
  {
    state: "speaking",
    label: "Responding",
    sublabel: "Soft rhythmic wave",
    accent: "bg-sage/20 text-deep-sage border-sage/40",
    icon: Waves,
  },
];

export function HeroCompanion() {
  const [activeState, setActiveState] = useState<VoiceState>("idle");
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative mx-auto w-full max-w-lg rounded-3xl border border-charcoal/[0.08] bg-warm-white/90 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md sm:p-6">
      <div className="flex items-center justify-between border-b border-charcoal/[0.06] pb-3 text-xs text-soft-gray">
        <span className="inline-flex items-center gap-1.5 font-medium text-charcoal">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-deep-sage"></span>
          </span>
          Interactive Companion Preview
        </span>
        <span className="hidden text-[11px] sm:inline">No cameras · No avatars · Pure presence</span>
      </div>

      <div
        className="relative my-2 flex h-60 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-sage/10 via-cream to-lavender/10 sm:h-72"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Canvas camera={{ position: [0, 0, 4.8], fov: 45 }} dpr={[1, 1.5]}>
          <AICompanion state={activeState} />
        </Canvas>

        {isHovered && (
          <div className="pointer-events-none absolute bottom-3 rounded-full bg-charcoal/80 px-3 py-1 text-[11px] text-warm-white backdrop-blur-sm transition-opacity">
            Click a state below to see how it responds
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-center text-xs font-medium text-soft-gray">
          Experience how the companion communicates without synthetic faces:
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATES.map((opt) => {
            const Icon = opt.icon;
            const isSelected = activeState === opt.state;
            return (
              <button
                key={opt.state}
                onClick={() => setActiveState(opt.state)}
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                  isSelected
                    ? `${opt.accent} font-medium ring-2 ring-sage/30`
                    : "border-charcoal/[0.06] bg-cream/60 text-soft-gray hover:bg-cream hover:text-charcoal"
                }`}
              >
                <span className="mb-1 flex h-6 w-6 items-center justify-center rounded-lg bg-warm-white/80 shadow-xs">
                  <Icon size={13} />
                </span>
                <span className="text-xs">{opt.label}</span>
                <span className="text-[10px] text-soft-gray/80 line-clamp-1">{opt.sublabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-soft-gray">
        Designed intentionally without human-like faces to avoid uncanny valley pressure and foster genuine calm.
      </p>
    </div>
  );
}
