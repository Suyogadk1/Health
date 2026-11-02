"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ConversationRow {
  id: string;
  title: string;
  updated_at: string;
  messages: { content: string; created_at: string }[];
}

export function HistoryList({ conversations }: { conversations: ConversationRow[] }) {
  const [query, setQuery] = useState("");
  const supabase = createClient();
  const router = useRouter();

  const filtered = useMemo(
    () =>
      conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase())),
    [conversations, query]
  );

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    } catch {}
    await supabase.from("conversations").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="mt-6">
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft-gray" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          className="w-full rounded-xl border border-charcoal/10 bg-warm-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-sage"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-soft-gray">Your conversations will appear here.</p>
      )}

      <div className="divide-y divide-charcoal/[0.07]">
        {filtered.map((c) => {
          const last = c.messages?.[c.messages.length - 1];
          return (
            <div key={c.id} className="flex items-center justify-between gap-4 py-4">
              <Link href={`/chat/${c.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="mt-0.5 truncate text-xs text-soft-gray">
                  {last?.content || "No messages yet"}
                </p>
                <p className="mt-0.5 text-[11px] text-soft-gray">
                  {new Date(c.updated_at).toLocaleString()}
                </p>
              </Link>
              <button
                onClick={() => handleDelete(c.id)}
                aria-label="Delete conversation"
                className="shrink-0 rounded-lg p-2 text-soft-gray hover:bg-cream hover:text-dusty-rose"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
