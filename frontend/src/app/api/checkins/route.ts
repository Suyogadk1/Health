import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  // 1. Try Supabase / mockStore
  try {
    const { data, error } = await supabase
      .from("wellbeing_checkins")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data && data.length > 0) {
      return NextResponse.json({
        data,
        latest: data[0] || null,
      });
    }
  } catch (err) {
    console.warn("[Checkins GET] Local store fetch issue, trying backend:", err);
  }

  // 2. Try proxying to backend if available
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";
  try {
    const backendRes = await fetch(`${backendUrl}/api/checkins?limit=${limit}`, {
      headers: {
        Authorization: `Bearer demo-token:${user.id}`,
      },
      cache: "no-store",
    });
    if (backendRes.ok) {
      const json = await backendRes.json();
      return NextResponse.json(json);
    }
  } catch {}

  return NextResponse.json({ data: [], latest: null });
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const {
    mood = "okay",
    stress_level,
    stressLevel,
    sleep_quality,
    sleepQuality,
    energy_level,
    energyLevel,
    clarity_level,
    clarityLevel,
    score,
    insight,
    breakdown,
    notes,
  } = body;

  const record = {
    user_id: user.id,
    mood,
    stress_level: stress_level ?? stressLevel ?? 3,
    sleep_quality: sleep_quality ?? sleepQuality ?? 3,
    energy_level: energy_level ?? energyLevel ?? 3,
    clarity_level: clarity_level ?? clarityLevel ?? 3,
    score: typeof score === "number" ? score : undefined,
    insight: insight || undefined,
    breakdown: breakdown || undefined,
    notes: notes || undefined,
    created_at: new Date().toISOString(),
  };

  // 1. Insert into Supabase / local mockStore
  try {
    await supabase.from("wellbeing_checkins").insert(record);
  } catch (err) {
    console.warn("[Checkins POST] Store insert notice:", err);
  }

  // 2. Sync to backend store if available
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";
  try {
    fetch(`${backendUrl}/api/checkins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer demo-token:${user.id}`,
      },
      body: JSON.stringify(record),
    }).catch(() => {});
  } catch {}

  return NextResponse.json({ data: record }, { status: 201 });
}
