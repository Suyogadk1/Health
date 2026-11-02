import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEFAULT_GUEST_USER, mockDb } from "@/lib/supabase/mockStore";

// Store in-memory OTPs for demo testing
const demoOtpStore = new Map<string, { code: string; expiresAt: number; name?: string }>();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  // ==========================================
  // 1. Send OTP Action
  // ==========================================
  if (body.action === "send_otp") {
    const email = (body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Fixed predictable code for easy testing: 123456
    const code = "123456";
    demoOtpStore.set(email, {
      code,
      expiresAt: Date.now() + 1000 * 60 * 10, // 10 mins
      name: body.name,
    });

    console.log(`[Demo Auth] Verification OTP for ${email}: ${code}`);

    return NextResponse.json({
      ok: true,
      message: "Verification code sent to your email",
      demoCode: code, // returned in demo mode so user sees it right away
    });
  }

  // ==========================================
  // 2. Verify OTP Action
  // ==========================================
  if (body.action === "verify_otp") {
    const email = (body.email || "").trim().toLowerCase();
    const token = (body.token || body.code || "").trim();

    const stored = demoOtpStore.get(email);
    // Allow '123456' as universal test code in demo mode or the stored code
    if (token !== "123456" && (!stored || stored.code !== token)) {
      return NextResponse.json(
        { error: "Invalid or expired verification code. Use 123456 for testing." },
        { status: 400 }
      );
    }

    const name = body.name || stored?.name || email.split("@")[0] || "Friend";
    const userId = `user-${email.replace(/[^a-zA-Z0-9]/g, "_")}`;

    const user = {
      id: userId,
      email,
      is_guest: false,
      user_metadata: { name },
    };

    mockDb.users.set(userId, user);
    if (!mockDb.profiles.has(userId)) {
      mockDb.profiles.set(userId, {
        id: `p-${userId}`,
        user_id: userId,
        name,
        email,
        preferred_language: "en",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    demoOtpStore.delete(email);

    const response = NextResponse.json({ user });
    const userJson = JSON.stringify(user);
    response.cookies.set("mindcare_user_session", userJson, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
      httpOnly: false,
    });
    response.cookies.set("understory_user_session", userJson, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
      httpOnly: false,
    });

    return response;
  }

  // ==========================================
  // 3. Direct Password / Guest Auth Action
  // ==========================================
  const isGuest = Boolean(body.is_guest || body.email === "guest@mindcare.app" || body.email === "guest@understory.app");
  const email = isGuest ? DEFAULT_GUEST_USER.email : (body.email || "friend@mindcare.app");
  const name = isGuest ? "Guest" : (body.name || email.split("@")[0] || "Friend");
  // Guests keep the unique id the browser already generated (so guests don't share data).
  let existingGuestId: string | undefined;
  try {
    const raw = cookies().get("mindcare_user_session")?.value;
    const parsed = raw ? JSON.parse(decodeURIComponent(raw)) : null;
    if (typeof parsed?.id === "string" && /^guest-[a-z0-9]{4,16}$/.test(parsed.id)) existingGuestId = parsed.id;
  } catch {}
  const userId = isGuest
    ? existingGuestId || `guest-${Math.random().toString(36).slice(2, 10)}`
    : `user-${email.replace(/[^a-zA-Z0-9]/g, "_")}`;

  const user = {
    id: userId,
    email,
    is_guest: isGuest,
    user_metadata: { name },
  };

  mockDb.users.set(userId, user);
  if (!mockDb.profiles.has(userId)) {
    mockDb.profiles.set(userId, {
      id: `p-${userId}`,
      user_id: userId,
      name,
      email,
      preferred_language: "en",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const response = NextResponse.json({ user });
  const userJson = JSON.stringify(user);
  response.cookies.set("mindcare_user_session", userJson, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });
  response.cookies.set("understory_user_session", userJson, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("mindcare_user_session", "", {
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("understory_user_session", "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}
