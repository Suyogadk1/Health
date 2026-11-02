import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMultiAIProvider } from "@/lib/ai";
import { SYSTEM_PROMPT, MAX_RESPONSE_WORDS } from "@/lib/ai/systemPrompt";
import { assessRisk } from "@/lib/safety/riskAssessment";
import { HIGH_RISK_RESPONSE } from "@/lib/safety/safetyResponse";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { reviewAndFinalize } from "@/lib/safety/safetyOrchestrator";
import { NemotronUltraProvider } from "@/lib/ai/nemotronProvider";

const bodySchema = z.object({
  language: z.enum(["en-US", "hi-IN", "ta-IN", "te-IN", "ne-NP"]).default("en-US"),
  conversationId: z.string().min(1),
  message: z.string().min(1).max(4000),
});

function truncateToWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + "…";
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  // 1. Active session
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const guestModeEnabled = process.env.GUEST_MODE_ENABLED === "true";

  if (!authUser) {
    if (!guestModeEnabled) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      );
    }
    console.warn(
      "[Auth Warning] GUEST_MODE_ENABLED is true: Unauthenticated chat request permitted via fallback guest identity ('friend-user')."
    );
  }

  const user = authUser || {
    id: "friend-user",
    email: "friend@mindcare.app",
    is_guest: false,
    user_metadata: { name: "Friend" },
  };

  // 2. Input validation
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { conversationId, message, language } = parsed.data;

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
  let activeConvoId = conversationId;

  if (isUUID) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      activeConvoId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("conversations")
        .insert({
          id: conversationId,
          user_id: user.id,
          title: message.slice(0, 32) + (message.length > 32 ? "…" : ""),
        })
        .select("id")
        .maybeSingle();
      if (created) activeConvoId = created.id;
    }
  } else {
    const { data: created } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: message.slice(0, 32) + (message.length > 32 ? "…" : ""),
      })
      .select("id")
      .maybeSingle();
    if (created) activeConvoId = created.id;
  }

  // 3. Rate limiting
  const rate = checkRateLimit(user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "You're sending messages a little too quickly. Please wait a moment." },
      { status: 429 }
    );
  }

  // 4. Safety evaluation (input)
  const inputRisk = assessRisk(message);

  // Persist user's message
  await supabase.from("messages").insert({
    conversation_id: activeConvoId,
    user_id: user.id,
    role: "user",
    content: message,
  });

  // If high risk (self-harm / emergency), respond with crisis support immediately
  if (inputRisk.level === "high") {
    await supabase.from("messages").insert({
      conversation_id: activeConvoId,
      user_id: user.id,
      role: "assistant",
      content: HIGH_RISK_RESPONSE,
    });

    return NextResponse.json({ reply: HIGH_RISK_RESPONSE, risk: "high", provider: "Safety Guardrail" });
  }

  // 5. Load recent history for context
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", activeConvoId)
    .order("created_at", { ascending: true })
    .limit(12);

  const chatMessages = (history || []).map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));

  // 5b. Load user's recent wellbeing check-in & mood history for personalized context
  const { data: checkinRows } = await supabase
    .from("wellbeing_checkins")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const { formatCheckinContext } = await import("@/lib/wellbeing/checkinContext");
  const checkinContextText = formatCheckinContext(checkinRows || []);

  const languageName = { "en-US": "English", "hi-IN": "Hindi", "ta-IN": "Tamil", "te-IN": "Telugu", "ne-NP": "Nepali" }[language];
  let systemPromptWithContext = SYSTEM_PROMPT + `\nReply in ${languageName}, using its native script. Preserve all safety requirements.`;
  if (checkinContextText) {
    systemPromptWithContext += `\n\n${checkinContextText}`;
  }

  // 6. AI provider call using Multi-AI Orchestrator (Gemini 1 + Gemini 2 + Grok + Nemotron Nano + Fallback)
  const multiAI = getMultiAIProvider();
  const result = await multiAI.generateWithDetails(chatMessages, systemPromptWithContext);

  // 6b. Safety Review via Agent B (Nemotron Ultra) before final output check
  const reviewerProvider = new NemotronUltraProvider();
  const decision = await reviewAndFinalize(message, result.reply, { reviewerProvider });
  let reply = decision.overridden ? decision.finalReply : result.reply;

  // 7. Response validation: word limit & output risk check
  reply = truncateToWords(reply, MAX_RESPONSE_WORDS);

  const outputRisk = assessRisk(reply);
  if (outputRisk.level === "high") {
    reply = HIGH_RISK_RESPONSE;
  }

  // 8. Persist assistant response
  await supabase.from("messages").insert({
    conversation_id: activeConvoId,
    user_id: user.id,
    role: "assistant",
    content: reply,
  });

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", activeConvoId);

  return NextResponse.json({
    reply,
    risk: inputRisk.level,
    provider: result.provider,
    model: result.model,
    attempts: result.attempts,
    agentALevel: decision.agentALevel,
    agentBLevel: decision.agentBLevel,
    overridden: decision.overridden,
  });
}
