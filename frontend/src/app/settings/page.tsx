import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { BackButton } from "@/components/navigation/BackButton";
import { SettingsPanels } from "./SettingsPanels";

export default async function SettingsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 py-6 sm:px-10 sm:py-10 pb-28 md:pb-10 max-w-4xl">
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard" label="Dashboard" />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl text-charcoal">Settings</h1>
        <SettingsPanels />
      </main>
      <MobileNav />
    </div>
  );
}
