import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default async function ConversationPage({
  params,
}: {
  params: { conversationId: string };
}) {
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
  let allConversations: any[] = [];
  let conversation: any = null;
  let messages: any[] = [];

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authHeaders = {
    Authorization: `Bearer ${session?.access_token || "demo-token"}`,
  };

  try {
    // 1. Fetch conversation details & messages from backend
    const res = await fetch(`${backendUrl}/api/conversations/${params.conversationId}`, {
      headers: authHeaders,
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        conversation = json.data;
        messages = json.data.messages || [];
      }
    }

    // 2. Fetch all conversations from backend
    const allRes = await fetch(`${backendUrl}/api/conversations?userId=${user.id}`, {
      headers: authHeaders,
      cache: "no-store",
    });
    if (allRes.ok) {
      const allJson = await allRes.json();
      if (allJson.data && Array.isArray(allJson.data)) {
        allConversations = allJson.data;
      }
    }
  } catch {}

  // Fallback to Supabase / mockStore if backend fetch was empty
  if (!conversation) {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", params.conversationId)
      .eq("user_id", user.id)
      .single();
    conversation = data;

    if (!conversation) {
      const { data: created } = await supabase
        .from("conversations")
        .insert({
          id: params.conversationId,
          user_id: user.id,
          title: "Mindful conversation",
        })
        .select()
        .single();
      conversation = created;
    }
  }

  if (allConversations.length === 0) {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    allConversations = data || [];
  }

  if (messages.length === 0) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", params.conversationId)
      .order("created_at", { ascending: true });
    messages = data || [];
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-warm-white">
      <Sidebar />
      <ConversationSidebar
        conversations={(allConversations || []).map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          title: c.title,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }))}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden pb-16 md:pb-0">
        <ChatWindow
          conversationId={params.conversationId}
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
