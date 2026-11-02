"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { InPageAuthModal } from "@/components/auth/InPageAuthModal";

export function HistoryGuestCard() {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <>
      <div className="mt-8 max-w-md rounded-3xl border border-sage/40 bg-warm-white p-7 text-center shadow-xs">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-sage/20 text-deep-sage">
          <Lock size={18} />
        </span>
        <h2 className="font-serif text-lg text-charcoal">Save your conversation history</h2>
        <p className="mt-2 text-xs text-soft-gray leading-relaxed">
          In Guest Mode, conversations are not stored permanently. Log in or create an account to start private, encrypted threads that you can revisit anytime.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="rounded-full bg-charcoal px-5 py-2 text-xs font-medium text-warm-white transition-all hover:bg-charcoal/85 shadow-xs"
          >
            Log in / Sign in
          </button>
          <Link
            href="/register?next=/history"
            className="rounded-full border border-charcoal/15 bg-cream/70 px-5 py-2 text-xs font-medium text-charcoal transition-all hover:bg-cream"
          >
            Create account
          </Link>
        </div>
      </div>

      <InPageAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        featureName="Conversation History"
      />
    </>
  );
}
