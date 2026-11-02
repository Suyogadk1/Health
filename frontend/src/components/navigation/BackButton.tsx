"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  fallbackHref?: string;
  label?: string;
  className?: string;
}

export function BackButton({
  fallbackHref = "/dashboard",
  label = "Back",
  className = "",
}: BackButtonProps) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    // Check if there is genuine browsing history in the current session
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-xl py-2 px-2.5 text-xs font-medium text-soft-gray transition-all hover:bg-cream hover:text-charcoal active:scale-95 cursor-pointer touch-manipulation min-h-[36px] ${className}`}
      aria-label={label}
    >
      <ArrowLeft size={16} className="shrink-0" />
      <span>{label}</span>
    </button>
  );
}
