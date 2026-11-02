import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { BackButton } from "@/components/navigation/BackButton";
import { HistoryList } from "./HistoryList";

export default async function HistoryPage() {
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

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, messages(content, created_at)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 py-6 sm:px-10 sm:py-10 pb-28 md:pb-10 max-w-4xl">
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard" label="Dashboard" />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl text-charcoal">History</h1>
        <p className="mt-1 text-sm text-soft-gray">Every conversation you've had, all in one place.</p>

        <HistoryList conversations={(conversations || []) as any} />
      </main>
      <MobileNav />
    </div>
  );
}
