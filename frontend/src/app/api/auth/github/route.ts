import { NextRequest, NextResponse } from "next/server";
import { mockDb, MockUser } from "@/lib/supabase/mockStore";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const usernameParam = searchParams.get("username")?.trim();
  const nextParam = searchParams.get("next") || "/dashboard";

  // 1. Instant GitHub Connect (Zero-Config or by Username)
  if (usernameParam) {
    return handleInstantGitHubLogin(usernameParam, nextParam, request.nextUrl.origin);
  }

  // 2. Real Production GitHub OAuth if credentials are configured
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (clientId && clientId !== "placeholder" && clientId.length > 5) {
    const origin = request.nextUrl.origin;
    const callbackUrl = `${origin}/api/auth/github/callback`;
    const state = encodeURIComponent(JSON.stringify({ next: nextParam }));
    const githubOAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      callbackUrl
    )}&scope=read:user,user:email&state=${state}`;

    return NextResponse.redirect(githubOAuthUrl);
  }

  // 3. Fallback when GITHUB_CLIENT_ID is not configured in Netlify environment:
  // Redirect to login page with instant GitHub connect prompt so user can enter handle or 1-click connect
  const redirectUrl = new URL("/login", request.nextUrl.origin);
  redirectUrl.searchParams.set("instant_github", "1");
  if (nextParam && nextParam !== "/dashboard") {
    redirectUrl.searchParams.set("next", nextParam);
  }
  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = (body.username || "github-explorer").trim();
  const next = body.next || "/dashboard";

  return handleInstantGitHubLogin(username, next, request.nextUrl.origin);
}

async function handleInstantGitHubLogin(username: string, next: string, origin: string) {
  const cleanUsername = username.replace(/^@/, "").trim() || "github-explorer";
  let ghData: any = null;

  try {
    const ghRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, {
      headers: {
        "User-Agent": "MindCare-Mental-Health-App",
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 3600 },
    });
    if (ghRes.ok) {
      ghData = await ghRes.json();
    }
  } catch (err) {
    console.warn("[GitHub Auth] Failed to query public GitHub API, using fallback profile", err);
  }

  const userId = `gh_${ghData?.id || cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
  const displayName = ghData?.name || cleanUsername;
  const avatarUrl = ghData?.avatar_url || `https://github.com/${cleanUsername}.png`;
  const email = ghData?.email || `${cleanUsername}@users.noreply.github.com`;

  const user: MockUser = {
    id: userId,
    email,
    is_guest: false,
    user_metadata: {
      name: displayName,
      avatar_url: avatarUrl,
      github_username: cleanUsername,
    },
  };

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

  const destPath = next.startsWith("/") ? next : "/dashboard";
  const redirectUrl = new URL(destPath, origin);
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
}
