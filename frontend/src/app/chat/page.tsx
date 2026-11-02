import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default async function ChatIndexPage() {
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

  const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";
  let conversations: any[] = [];

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authHeaders = {
    Authorization: `Bearer ${session?.access_token || "demo-token"}`,
  };

  try {
    const res = await fetch(`${backendUrl}/api/conversations?userId=${user.id}`, {
      headers: authHeaders,
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        conversations = json.data;
      }
    }
  } catch {}

  if (conversations.length === 0) {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    conversations = data || [];
  }

  let targetConvo = conversations && conversations.length > 0 ? conversations[0] : null;

  if (!targetConvo) {
    try {
      const res = await fetch(`${backendUrl}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ userId: user.id, title: "Mindful check-in" }),
      });
      if (res.ok) {
        const json = await res.json();
        targetConvo = json.data;
      }
    } catch {}

    if (!targetConvo) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title: "Mindful check-in" })
        .select()
        .single();
      targetConvo = newConvo;
    }
  }

  let messages: any[] = [];
  if (targetConvo) {
    try {
      const res = await fetch(`${backendUrl}/api/conversations/${targetConvo.id}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.messages) {
          messages = json.data.messages;
        }
      }
    } catch {}

    if (messages.length === 0) {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", targetConvo.id)
        .order("created_at", { ascending: true });
      messages = data || [];
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-warm-white">
      <Sidebar />
      <ConversationSidebar
        conversations={(conversations || []).map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          title: c.title,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }))}
      />
      <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden pb-16 md:pb-0">
        <ChatWindow
          conversationId={targetConvo?.id || "default"}
          isGuest={false}
          initialMessages={(messages || []).map((m: any) => ({
            id: m.id,
            conversationId: m.conversation_id || m.conversationId,
            userId: m.user_id || m.userId,
            role: m.role,
            content: m.content,
            createdAt: m.created_at || m.createdAt,
            provider: m.provider,
            attempts: m.attempts,
            agentALevel: m.agentALevel,
            agentBLevel: m.agentBLevel,
            overridden: m.overridden,
            risk: m.risk,
            isDangerous: m.isDangerous,
          }))}
        />
      </div>
      <MobileNav />
    </div>
  );
}
