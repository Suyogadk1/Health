"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Mic,
  History,
  User,
  Settings,
  ShieldCheck,
  Leaf,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/theme/ThemeProvider";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/voice", label: "Voice", icon: Mic },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/safety", label: "Safety", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, supabase } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex w-[232px] shrink-0 flex-col gap-8 border-r border-charcoal/[0.07] bg-warm-white p-6">
      <Link href="/dashboard" className="flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sage text-warm-white">
          <Leaf size={15} />
        </span>
        <span className="font-serif text-lg">MindCare</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-[#EDF1EA] text-deep-sage font-medium"
                  : "text-soft-gray hover:bg-cream hover:text-charcoal"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={17} />
                <span>{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2">
        {user && (
          <div className="flex items-center gap-2.5 rounded-xl border border-charcoal/[0.06] bg-cream/50 p-2 text-xs">
            {(user as any).user_metadata?.avatar_url ? (
              <img
                src={(user as any).user_metadata.avatar_url}
                alt={(user as any).user_metadata?.name || "Profile"}
                className="h-7 w-7 rounded-full object-cover shrink-0 border border-charcoal/10"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sage/20 text-deep-sage font-medium text-xs shrink-0">
                {(((user as any).user_metadata?.name || user.email || "F")[0]).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-charcoal truncate text-xs">
                {(user as any).user_metadata?.name || user.email?.split("@")[0] || "Friend"}
              </p>
              <p className="text-[10px] text-soft-gray truncate">
                {(user as any).user_metadata?.github_username
                  ? `@${(user as any).user_metadata.github_username}`
                  : "Private Sanctuary"}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-soft-gray hover:bg-cream hover:text-charcoal transition-colors"
          title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {resolvedTheme === "dark" ? (
            <Sun size={15} className="text-amber-400" />
          ) : (
            <Moon size={15} className="text-deep-sage" />
          )}
          <span>{resolvedTheme === "dark" ? "Light Theme" : "Dark Theme"}</span>
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-soft-gray hover:bg-cream hover:text-charcoal transition-colors"
          title="Log out and return to the home page"
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>
    </aside>
  );
}
