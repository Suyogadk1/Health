"use client";

import { useState } from "react";
import Link from "next/link";
import { Smile, Meh, Frown, Sparkles, AlertCircle, ArrowRight } from "lucide-react";

type MoodKey = "great" | "good" | "okay" | "low" | "stressed";

interface MoodItem {
  key: MoodKey;
  label: string;
  emoji: string;
  icon: typeof Smile;
  color: string;
  reflection: string;
  prompt: string;
}

const MOODS: MoodItem[] = [
  {
    key: "great",
    label: "Great",
    emoji: "🌿",
    icon: Sparkles,
    color: "bg-sage/20 text-deep-sage border-sage/40",
    reflection: "Energy and clarity are present with you today.",
    prompt: "Take a moment to notice what is nourishing you. Savoring small good moments anchors them in memory.",
  },
  {
    key: "good",
    label: "Good",
    emoji: "☀️",
    icon: Smile,
    color: "bg-[#EDF1EA] text-deep-sage border-[#C8DAC3]",
    reflection: "A steady, calm rhythm feels accessible.",
    prompt: "No need to strive or over-optimize. Let today simply be an unhurried, grounded day.",
  },
  {
    key: "okay",
    label: "Okay",
    emoji: "⛅",
    icon: Meh,
    color: "bg-cream text-charcoal border-charcoal/10",
    reflection: "Neutral ground is completely fine.",
    prompt: "You don't have to perform positivity. Normal, quiet days are just as valuable as breakthrough days.",
  },
  {
    key: "low",
    label: "Low",
    emoji: "🌧️",
    icon: Frown,
    color: "bg-lavender/25 text-[#544875] border-lavender/40",
    reflection: "Carrying a heavier weight or depleted reserves.",
    prompt: "Give yourself permission to lower the bar today. One glass of water and five quiet minutes is enough.",
  },
  {
    key: "stressed",
    label: "Stressed",
    emoji: "🌪️",
    icon: AlertCircle,
    color: "bg-[#FBEFE9] text-[#A65B35] border-[#F2CEBD]",
    reflection: "Racing thoughts, tension, or urgency.",
    prompt: "Drop your shoulders away from your ears. Unclench your jaw. Exhale slowly. The urgency can pause for two minutes.",
  },
];

export function InteractiveCheckinPreview() {
  const [selectedMood, setSelectedMood] = useState<MoodKey>("okay");

  const current = MOODS.find((m) => m.key === selectedMood) || MOODS[2];

  return (
    <div className="mx-auto w-full max-w-2xl rounded-3xl border border-charcoal/[0.08] bg-warm-white p-6 shadow-sm sm:p-8">
      <div className="text-center">
        <span className="inline-block rounded-full bg-sage/15 px-3 py-1 text-xs font-medium text-deep-sage">
          Live Interactive Preview
        </span>
        <h3 className="mt-3 font-serif text-2xl text-charcoal">
          How is your mind feeling right now?
        </h3>
        <p className="mt-1 text-sm text-soft-gray">
          Click an emotional state below to see how MindCare meets you with non-judgmental presence.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2.5 sm:gap-3">
        {MOODS.map((m) => {
          const isSelected = selectedMood === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setSelectedMood(m.key)}
              className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm transition-all sm:px-4 sm:py-3 ${
                isSelected
                  ? `${m.color} scale-105 font-medium shadow-xs ring-2 ring-sage/30`
                  : "border-charcoal/[0.08] bg-warm-white text-soft-gray hover:border-charcoal/20 hover:text-charcoal"
              }`}
            >
              <span className="text-base">{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-charcoal/[0.06] bg-cream/70 p-5 transition-all">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep-sage">
          <span>{current.emoji}</span>
          <span>{current.reflection}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/90">
          "{current.prompt}"
        </p>
        <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-charcoal/[0.06] pt-3 sm:flex-row sm:items-center">
          <span className="text-xs text-soft-gray">
            Your daily check-ins stay completely private and encrypted.
          </span>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-charcoal hover:text-deep-sage"
          >
            Explore daily reflections in the app <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
