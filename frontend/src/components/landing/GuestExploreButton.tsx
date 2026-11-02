"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import { setGuestSession } from "@/lib/supabase/client";

interface GuestExploreButtonProps {
  className?: string;
  variant?: "header" | "hero";
}

export function GuestExploreButton({ className = "", variant = "hero" }: GuestExploreButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleExplore() {
    setLoading(true);
    try {
      // 1. Instantly set client-side cookie (0ms)
      setGuestSession();
      // 2. Sync server cookie in background
      fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "guest@mindcare.app", is_guest: true }),
      }).catch(() => {});
      // 3. Navigate immediately
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  }

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={handleExplore}
        disabled={loading}
        className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border border-charcoal/15 bg-warm-white/70 px-4 py-2 text-xs font-medium text-charcoal transition-colors hover:bg-warm-white hover:border-charcoal/30 cursor-pointer ${className}`}
      >
        <Compass size={14} className="text-deep-sage" />
        <span>{loading ? "Entering…" : "Explore as Guest"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleExplore}
      disabled={loading}
      className={`flex w-full items-center justify-center gap-2 rounded-full border border-charcoal/15 bg-warm-white/80 px-6 py-3.5 text-sm font-medium text-charcoal backdrop-blur-xs transition-all duration-200 hover:border-charcoal/30 hover:bg-warm-white sm:w-auto cursor-pointer ${className}`}
    >
      <Compass size={16} className="text-deep-sage" />
      <span>{loading ? "Opening sanctuary…" : "Explore as a Guest"}</span>
    </button>
  );
}
