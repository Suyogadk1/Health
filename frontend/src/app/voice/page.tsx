import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { VoiceClient } from "@/components/voice/VoiceClient";

export default async function VoicePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <VoiceClient isGuest={false} />
      <MobileNav />
    </div>
  );
}
