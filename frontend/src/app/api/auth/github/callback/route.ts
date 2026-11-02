import { NextRequest, NextResponse } from "next/server";
import { mockDb, MockUser } from "@/lib/supabase/mockStore";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  let next = "/dashboard";
  if (state) {
    try {
      const parsed = JSON.parse(decodeURIComponent(state));
      if (parsed?.next && typeof parsed.next === "string") {
        next = parsed.next.startsWith("/") ? parsed.next : "/dashboard";
      }
    } catch {}
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.nextUrl.origin));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[GitHub OAuth Callback] Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET");
    return NextResponse.redirect(new URL("/login?error=missing_credentials", request.nextUrl.origin));
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "MindCare-Mental-Health-App",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("[GitHub OAuth Callback] Token exchange failed:", tokenData);
      return NextResponse.redirect(new URL("/login?error=oauth_exchange_failed", request.nextUrl.origin));
    }

    // 2. Fetch authenticated GitHub user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "MindCare-Mental-Health-App",
        Accept: "application/vnd.github.v3+json",
      },
    });

    const ghUser = await userRes.json();
    if (!ghUser || !ghUser.id) {
      return NextResponse.redirect(new URL("/login?error=user_fetch_failed", request.nextUrl.origin));
    }

    let email = ghUser.email;

    // If email is private, fetch primary email from emails endpoint
    if (!email) {
      try {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "MindCare-Mental-Health-App",
            Accept: "application/vnd.github.v3+json",
          },
        });
        if (emailsRes.ok) {
          const emails = await emailsRes.json();
          const primary = emails.find((e: any) => e.primary && e.verified) || emails[0];
          if (primary?.email) email = primary.email;
        }
      } catch {}
    }

    if (!email) {
      email = `${ghUser.login}@users.noreply.github.com`;
    }

    const userId = `gh_${ghUser.id}`;
    const displayName = ghUser.name || ghUser.login;
    const avatarUrl = ghUser.avatar_url || `https://github.com/${ghUser.login}.png`;

    const user: MockUser = {
      id: userId,
      email,
      is_guest: false,
      user_metadata: {
        name: displayName,
        avatar_url: avatarUrl,
        github_username: ghUser.login,
      },
    };

    // Persist in mockDb singleton & profile
    mockDb.users.set(userId, user);
    mockDb.profiles.set(userId, {
      id: `p-${userId}`,
      user_id: userId,
      name: displayName,
      email,
      avatar_url: avatarUrl,
      preferred_language: "en",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const redirectUrl = new URL(next, request.nextUrl.origin);
    const response = NextResponse.redirect(redirectUrl);

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
  } catch (err: any) {
    console.error("[GitHub OAuth Callback] Unexpected error:", err);
    return NextResponse.redirect(new URL("/login?error=auth_error", request.nextUrl.origin));
  }
}
