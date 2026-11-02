"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/components/theme/ThemeProvider";

export function SettingsPanels() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();

  async function handleExport() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [profile, conversations, messages, checkins] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("conversations").select("*").eq("user_id", user.id),
      supabase.from("messages").select("*").eq("user_id", user.id),
      supabase.from("wellbeing_checkins").select("*").eq("user_id", user.id),
    ]);

    const payload = {
      profile: profile.data,
      conversations: conversations.data,
      messages: messages.data,
      wellbeingCheckins: checkins.data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindcare-data-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      router.push("/");
    } else {
      showToast("Something went wrong deleting your account.");
    }
    setDeleting(false);
  }

  const themeOptions = [
    { id: "light" as const, label: "Light", icon: Sun },
    { id: "dark" as const, label: "Dark", icon: Moon },
    { id: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <div className="mt-6 max-w-md space-y-8">
      {/* 1. Appearance / Theme */}
      <section className="rounded-2xl border border-charcoal/[0.07] bg-warm-white p-6 shadow-xs">
        <h2 className="font-serif text-lg text-charcoal">Appearance</h2>
        <p className="mt-1 text-xs text-soft-gray">
          Choose a theme that feels calm and comfortable for your eyes ({resolvedTheme === "dark" ? "Dark active" : "Light active"}).
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {themeOptions.map(({ id, label, icon: Icon }) => {
            const isSelected = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border py-3 px-3 text-xs transition-all ${
                  isSelected
                    ? "border-deep-sage bg-sage/20 text-deep-sage font-medium shadow-xs"
                    : "border-charcoal/10 bg-cream/60 text-charcoal hover:bg-cream hover:border-charcoal/20"
                }`}
              >
                <Icon size={18} className={isSelected ? "text-deep-sage" : "text-soft-gray"} />
                <span className="capitalize">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Privacy & Data */}
      <section className="rounded-2xl border border-charcoal/[0.07] bg-warm-white p-6 shadow-xs">
        <h2 className="font-serif text-lg text-charcoal">Privacy & Data</h2>
        <p className="mt-2 text-sm text-soft-gray">
          Download a copy of your reflections and check-ins, or permanently delete your account.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={handleExport}>
            Export my data
          </Button>
          <Button
            variant="ghost"
            className="text-dusty-rose hover:bg-dusty-rose/10"
            onClick={() => setConfirmOpen(true)}
          >
            Delete account
          </Button>
        </div>
      </section>

      {/* Confirmation Modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete your account?">
        <p className="text-sm text-soft-gray">
          This permanently deletes your profile, conversations, messages, and check-ins.
          This can't be undone. Type <strong>DELETE</strong> to confirm.
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          className="mt-3 w-full rounded-xl border border-charcoal/10 bg-warm-white px-3 py-2 text-sm text-charcoal outline-none focus:ring-2 focus:ring-deep-sage/30"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={confirmText !== "DELETE" || deleting}
            onClick={handleDeleteAccount}
            className="bg-dusty-rose text-white"
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
