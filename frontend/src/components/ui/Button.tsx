"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

// Framer Motion's HTMLMotionProps redefines onDrag/onDragStart/onDragEnd/
// onAnimation* with its own (gesture-aware) signatures, which collide with
// React's native DOM event types of the same name. Omit them from what we
// accept here since this Button doesn't use drag or CSS-animation events.
type NativeConflicts =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, NativeConflicts> {
  variant?: "primary" | "secondary" | "ghost" | "accent";
}

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fern disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "bg-charcoal text-warm-white hover:bg-deep-sage",
        variant === "secondary" && "bg-warm-white text-charcoal border border-charcoal/10 hover:border-fern/40 hover:text-deep-sage",
        variant === "ghost" && "bg-transparent text-charcoal hover:bg-fern/10 hover:text-deep-sage",
        variant === "accent" && "bg-fern text-warm-white shadow-[0_4px_20px_-4px_rgba(63,178,115,0.5)] hover:bg-[#379d63]",
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
