"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface ProfileData {
  name: string;
  email: string;
  timezone: string;
  preferredLanguage: string;
  createdAt?: string;
}

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const [name, setName] = useState(profile.name);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { showToast } = useToast();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ name, timezone })
      .eq("user_id", user.id);

    setSaving(false);
    showToast("Profile updated.");
  }

  return (
    <form onSubmit={handleSave} className="mt-6 max-w-md space-y-4 rounded-2xl bg-warm-white p-6">
      <div>
        <label className="mb-1 block text-xs text-soft-gray">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-soft-gray">Email</label>
        <Input value={profile.email} disabled className="opacity-60" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-soft-gray">Timezone</label>
        <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. Asia/Kolkata" />
      </div>
      {profile.createdAt && (
        <p className="text-xs text-soft-gray">
          Member since {new Date(profile.createdAt).toLocaleDateString()}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
