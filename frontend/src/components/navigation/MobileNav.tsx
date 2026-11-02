"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  MessageCircle,
  Mic,
  History,
  MoreHorizontal,
  X,
  User,
  Settings,
  ShieldCheck,
  Info,
  Lock,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/theme/ThemeProvider";

const MAIN_TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/voice", label: "Voice", icon: Mic },
  { href: "/history", label: "History", icon: History },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, supabase } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isGuest = Boolean(user && (user as any).is_guest);

  async function handleLogout() {
    setDrawerOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Bottom Floating Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-charcoal/[0.08] bg-warm-white/95 px-2 pt-2 pb-safe backdrop-blur-lg shadow-lg"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {MAIN_TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl min-w-[56px] min-h-[48px] transition-all touch-manipulation active:scale-95 ${
                  active
                    ? "text-deep-sage font-medium bg-sage/15"
                    : "text-soft-gray hover:text-charcoal"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
                <span className="text-[10px] tracking-tight">{label}</span>
              </Link>
            );
          })}

          {/* More / Menu Button */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl min-w-[56px] min-h-[48px] transition-all touch-manipulation active:scale-95 ${
              drawerOpen ||
              pathname === "/profile" ||
              pathname === "/settings" ||
              pathname === "/safety"
                ? "text-deep-sage font-medium bg-sage/15"
                : "text-soft-gray hover:text-charcoal"
            }`}
            aria-label="More navigation options"
          >
            <MoreHorizontal size={20} strokeWidth={1.8} />
            <span className="text-[10px] tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Slide-up "More" Drawer for Mobile */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-charcoal/40 backdrop-blur-xs"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-full max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-charcoal/10 bg-warm-white p-6 shadow-2xl pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-charcoal/[0.08] pb-4">
              <div>
                <h2 className="font-serif text-lg text-charcoal">MindCare Menu</h2>
                <p className="text-xs text-soft-gray">
                  {(user as any)?.user_metadata?.name || user?.email || "Private Sanctuary"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-full p-2 text-soft-gray hover:bg-cream hover:text-charcoal cursor-pointer"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu Links */}
            <div className="mt-4 space-y-1.5">
              <Link
                href="/profile"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm text-charcoal hover:bg-cream transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User size={18} className="text-deep-sage" />
                  <span>Profile & Wellbeing Goals</span>
                </div>
                <ChevronRight size={16} className="text-soft-gray" />
              </Link>

              <Link
                href="/settings"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm text-charcoal hover:bg-cream transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings size={18} className="text-deep-sage" />
                  <span>Settings & Preferences</span>
                </div>
                <ChevronRight size={16} className="text-soft-gray" />
              </Link>

              <Link
                href="/safety"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm text-charcoal hover:bg-cream transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-deep-sage" />
                  <span>Safety & Crisis Resources</span>
                </div>
                <ChevronRight size={16} className="text-soft-gray" />
              </Link>

              <Link
                href="/about"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm text-charcoal hover:bg-cream transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Info size={18} className="text-deep-sage" />
                  <span>About MindCare</span>
                </div>
                <ChevronRight size={16} className="text-soft-gray" />
              </Link>

              <Link
                href="/privacy"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm text-charcoal hover:bg-cream transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Lock size={18} className="text-deep-sage" />
                  <span>Privacy Policy & Ethics</span>
                </div>
                <ChevronRight size={16} className="text-soft-gray" />
              </Link>

              {/* Quick Theme Switcher in Mobile Drawer */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm text-charcoal hover:bg-cream transition-colors"
              >
                <div className="flex items-center gap-3">
                  {resolvedTheme === "dark" ? (
                    <Sun size={18} className="text-amber-400" />
                  ) : (
                    <Moon size={18} className="text-deep-sage" />
                  )}
                  <span>Theme: {resolvedTheme === "dark" ? "Dark Mode" : "Light Mode"}</span>
                </div>
                <span className="text-xs font-medium text-deep-sage">Switch</span>
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 border-t border-charcoal/[0.08] pt-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cream py-3 text-xs font-medium text-charcoal transition-colors hover:bg-sand/40"
              >
                <LogOut size={15} />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
