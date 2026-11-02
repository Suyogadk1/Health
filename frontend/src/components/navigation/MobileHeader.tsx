"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Lock } from "lucide-react";
import { BackButton } from "./BackButton";
import { useAuth } from "@/hooks/useAuth";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/chat": "Mindful Chat",
  "/voice": "Voice Space",
  "/history": "History",
  "/profile": "Your Profile",
  "/settings": "Settings",
  "/safety": "Safety & Crisis",
  "/about": "About MindCare",
  "/privacy": "Privacy Policy",
};

export function MobileHeader({ title: customTitle }: { title?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isGuest = Boolean(user && (user as any).is_guest);

  const matchedKey = Object.keys(PAGE_TITLES).find(
    (key) => pathname === key || pathname.startsWith(`${key}/`)
  );
  const title = customTitle || (matchedKey ? PAGE_TITLES[matchedKey] : "MindCare");
  const isHomeOrDashboard = pathname === "/" || pathname === "/dashboard";

  return (
    <header className="md:hidden sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-charcoal/[0.07] bg-warm-white/90 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        {!isHomeOrDashboard ? (
          <BackButton fallbackHref="/dashboard" label="Back" />
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sage text-warm-white shadow-xs">
              <Leaf size={15} />
            </span>
            <span className="font-serif text-base font-medium text-charcoal">MindCare</span>
          </Link>
        )}
      </div>

      {!isHomeOrDashboard && (
        <h1 className="font-serif text-sm font-medium text-charcoal truncate max-w-[160px]">
          {title}
        </h1>
      )}

      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-sage/20 text-deep-sage text-xs font-medium overflow-hidden border border-charcoal/10"
          title="Profile"
        >
          {(user as any)?.user_metadata?.avatar_url ? (
            <img
              src={(user as any).user_metadata.avatar_url}
              alt="Profile"
              className="h-full w-full object-cover"
            />
          ) : (
            ((((user as any)?.user_metadata?.name || user?.email || "F"))[0]).toUpperCase()
          )}
        </Link>
      </div>
    </header>
  );
}
