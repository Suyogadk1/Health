import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { BackButton } from "@/components/navigation/BackButton";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
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
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 py-6 sm:px-10 sm:py-10 pb-28 md:pb-10 max-w-4xl">
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard" label="Dashboard" />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl text-charcoal">Profile</h1>

        <ProfileForm
          profile={{
            name: profile?.name || user.user_metadata?.name || "Friend",
            email: profile?.email || user.email || "friend@mindcare.app",
            timezone: profile?.timezone || "",
            preferredLanguage: profile?.preferred_language || "en",
            createdAt: profile?.created_at,
          }}
        />
      </main>
      <MobileNav />
    </div>
  );
}
