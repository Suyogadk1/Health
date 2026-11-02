import Link from "next/link";
import { MessageCircle, Mic, HeartPulse, Compass, Sprout, Leaf } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { MoodCheckIn } from "@/components/dashboard/MoodCheckIn";

const TIPS = [
  { icon: Sprout, title: "Step outside for five minutes", body: "A short change of scenery can reset a racing mind." },
  { icon: Leaf, title: "Name what you're feeling", body: "Putting a word to an emotion often loosens its grip a little." },
];

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const user = authUser || {
    id: "friend-user",
    email: "friend@mindcare.app",
    is_guest: false,
    user_metadata: { name: "Friend" },
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(5);

  const { data: checkins } = await supabase
    .from("wellbeing_checkins")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const firstName = profile?.name?.split(" ")[0] || (user as any).user_metadata?.name || "Friend";

  return (
    <div className="dashboard-surface flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 px-4 py-6 sm:px-10 sm:py-10 pb-28 md:pb-10">
          <div className="dashboard-welcome"><span className="dashboard-eyebrow">YOUR DAILY BREATHING SPACE</span><h1 className="font-serif text-3xl">Good to see you, {firstName}.</h1><p className="mt-2 text-sm text-soft-gray">Set it all down for a moment. This time is yours.</p><div className="dashboard-pebble" aria-hidden="true" /></div>

          <MoodCheckIn userId={user.id} initialCheckins={checkins || []} />

          <div className="dashboard-actions mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <Link
              href="/chat"
              className="group relative flex flex-col items-center gap-2.5 rounded-[20px] border border-charcoal/[0.06] bg-warm-white p-4 text-sm transition-all hover:border-charcoal/20 hover:shadow-xs"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px]" style={{ background: "#EDF1EA", color: "#71866D" }}>
                <MessageCircle size={18} />
              </span>
              <span className="flex items-center gap-1 font-medium text-charcoal">
                Talk it out
              </span>
            </Link>

            <Link
              href="/voice"
              className="group relative flex flex-col items-center gap-2.5 rounded-[20px] border border-charcoal/[0.06] bg-warm-white p-4 text-sm transition-all hover:border-charcoal/20 hover:shadow-xs"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px]" style={{ background: "#F1EDF7", color: "#7A6FA0" }}>
                <Mic size={18} />
              </span>
              <span className="flex items-center gap-1 font-medium text-charcoal">
                Speak instead
              </span>
            </Link>

            <Link
              href="/chat"
              className="flex flex-col items-center gap-2.5 rounded-[20px] border border-charcoal/[0.06] bg-warm-white p-4 text-sm transition-all hover:border-charcoal/20 hover:shadow-xs"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px]" style={{ background: "#FBEFE9", color: "#C17F5C" }}>
                <HeartPulse size={18} />
              </span>
              <span className="font-medium text-charcoal">Quick check-in</span>
            </Link>

            <Link
              href="/safety"
              className="flex flex-col items-center gap-2.5 rounded-[20px] border border-charcoal/[0.06] bg-warm-white p-4 text-sm transition-all hover:border-charcoal/20 hover:shadow-xs"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px]" style={{ background: "#F4EEE3", color: "#8A7B54" }}>
                <Compass size={18} />
              </span>
              <span className="font-medium text-charcoal">Explore resources</span>
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section>
              <h2 className="mb-3.5 font-serif text-lg">Gentle reminders</h2>
              {TIPS.map((tip, i) => {
                const Icon = tip.icon;
                return (
                  <div key={i} className="mb-2.5 flex gap-3 rounded-2xl border border-sand/40 bg-warm-white p-3.5">
                    <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[10px] bg-[#EDF1EA] text-deep-sage">
                      <Icon size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{tip.title}</p>
                      <p className="text-xs text-soft-gray">{tip.body}</p>
                    </div>
                  </div>
                );
              })}
            </section>

            <section>
              <h2 className="mb-3.5 font-serif text-lg">Recent conversations</h2>
              {(!conversations || conversations.length === 0) && (
                <p className="text-sm text-soft-gray">Your conversations will appear here.</p>
              )}
              {conversations?.map((c: any) => (
                <a
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className="flex items-center justify-between border-b border-charcoal/[0.07] py-3 text-sm last:border-none hover:text-deep-sage"
                >
                  <span>{c.title}</span>
                  <span className="text-xs text-soft-gray">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </span>
                </a>
              ))}
            </section>
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
