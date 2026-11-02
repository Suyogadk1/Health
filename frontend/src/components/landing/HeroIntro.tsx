"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Lock, ShieldCheck, Leaf, Sparkles } from "lucide-react";

// The one deliberate, non-user-triggered motion moment on the landing page:
// a single staggered reveal as the hero loads, badge -> headline -> copy ->
// CTAs -> trust row, each handing off momentum to the next. Everywhere else
// on the page, motion only responds to what the visitor does.
const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 26 },
  },
};

export function HeroIntro() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="text-center lg:text-left"
    >
      <motion.span
        variants={item}
        className="inline-flex items-center gap-1.5 rounded-full bg-fern/15 px-3.5 py-1 text-xs font-medium text-deep-sage"
      >
        <Sparkles size={13} className="text-ember" />
        A calm, judgment-free space
      </motion.span>

      <motion.h1
        variants={item}
        className="mt-6 font-serif text-4xl leading-[1.15] text-charcoal sm:text-5xl lg:text-6xl"
      >
        A calmer space to talk, reflect, and feel heard.
      </motion.h1>

      <motion.p
        variants={item}
        className="mt-5 max-w-xl text-base leading-relaxed text-soft-gray sm:text-lg lg:mx-0"
        style={{ marginInline: "auto" }}
      >
        Designed with intentional pacing, quiet space, and compassionate boundaries.
        MindCare helps you explore swirling thoughts, manage everyday stress, and
        cultivate emotional resilience at your own pace.
      </motion.p>

      <motion.div
        variants={item}
        className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row lg:justify-start"
      >
        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 24 }}>
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-fern px-7 py-3.5 text-sm font-medium text-warm-white shadow-[0_8px_24px_-6px_rgba(63,178,115,0.55)] transition-colors duration-200 hover:bg-[#379d63] sm:w-auto"
          >
            Enter Sanctuary <ArrowRight size={16} />
          </Link>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 24 }}>
          <Link
            href="/chat"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-charcoal/15 bg-warm-white px-6 py-3.5 text-sm font-medium text-charcoal shadow-xs transition-colors duration-200 hover:border-ember/50 hover:text-deep-sage sm:w-auto"
          >
            Start Talking
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        variants={item}
        className="mt-10 grid grid-cols-3 gap-3 border-t border-charcoal/[0.08] pt-6 text-left"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal">
            <Lock size={13} className="text-fern" /> Private
          </div>
          <p className="text-[11px] text-soft-gray">
            Per-user encrypted data via Row-Level Security
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal">
            <ShieldCheck size={13} className="text-ember" /> Safe
          </div>
          <p className="text-[11px] text-soft-gray">
            Active crisis detection and emergency hotlines
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal">
            <Leaf size={13} className="text-fern" /> Grounded
          </div>
          <p className="text-[11px] text-soft-gray">
            Non-clinical, gentle supportive presence
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
