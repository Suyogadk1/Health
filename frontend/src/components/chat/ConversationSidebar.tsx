"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Conversation } from "@/types";
import { createClient } from "@/lib/supabase/client";

export function ConversationSidebar({ conversations }: { conversations: Conversation[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleNewConversation() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New conversation" })
      .select()
      .single();

    if (data) router.push(`/chat/${data.id}`);
  }

  return (
    <div className="hidden lg:flex w-72 shrink-0 flex-col border-r border-charcoal/[0.07] p-4">
      <button
        onClick={handleNewConversation}
        className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-cream px-3 py-2.5 text-sm font-medium text-charcoal hover:bg-sand/50"
      >
        <Plus size={16} />
        New chat
      </button>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-sm text-soft-gray">
            Your conversations will appear here.
          </p>
        )}
        {conversations.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className={`truncate rounded-xl px-3 py-2.5 text-sm ${
              pathname === `/chat/${c.id}`
                ? "bg-[#EDF1EA] text-deep-sage font-medium"
                : "text-charcoal hover:bg-cream"
            }`}
          >
            {c.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
