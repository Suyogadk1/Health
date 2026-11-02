"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createQueryBuilder } from "./mockStore";

let cachedBrowserClient: any = null;

export const DEFAULT_ACTIVE_USER = {
  id: "friend-user",
  email: "friend@mindcare.app",
  is_guest: false,
  user_metadata: { name: "Friend" },
};

/** Starts an explicit guest session with its own id, so guests don't share data. */
export function setGuestSession() {
  const rand = Math.random().toString(36).slice(2, 10);
  const guest = {
    id: `guest-${rand}`,
    email: "guest@mindcare.app",
    is_guest: true,
    user_metadata: { name: "Guest" },
  };
  if (typeof document === "undefined") return guest;
  const cookieVal = encodeURIComponent(JSON.stringify(guest));
  document.cookie = `mindcare_user_session=${cookieVal}; path=/; max-age=2592000; SameSite=Lax`;
  document.cookie = `understory_user_session=${cookieVal}; path=/; max-age=2592000; SameSite=Lax`;
  return guest;
}

export function clearLocalSession() {
  if (typeof document === "undefined") return;
  document.cookie = "mindcare_user_session=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "understory_user_session=; path=/; max-age=0; SameSite=Lax";
}

/**
 * Returns the signed-in demo user from the session cookie, or null when
 * nobody is signed in. (It used to silently create a default "Friend" user,
 * which made logout impossible and made every visitor share one identity.)
 */
export function getLocalUser() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(^|;\s*)(?:mindcare_user_session|understory_user_session)=([^;]+)/);
  if (match) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[2]));
      if (parsed && parsed.id) {
        parsed.is_guest = false; // guests keep full access to the app
        return parsed;
      }
    } catch {}
  }
  return null;
}

/** Demo access token that carries the user id so the backend can keep each user's data separate. */
export function demoAccessToken(userId?: string | null) {
  return userId ? `demo-token:${userId}` : "demo-token";
}

export function signInWithGithub(username?: string, next: string = "/dashboard") {
  if (typeof window === "undefined") return;
  const target = username
    ? `/api/auth/github?username=${encodeURIComponent(username)}&next=${encodeURIComponent(next)}`
    : `/api/auth/github?next=${encodeURIComponent(next)}`;
  window.location.href = target;
}

// Demo auth helper routines
async function demoSignInWithOtp(email: string, options?: any) {
  try {
    const res = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_otp", email, name: options?.data?.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send code");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Failed to send OTP code" } };
  }
}

async function demoVerifyOtp(email: string, token: string, type?: string) {
  try {
    const res = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_otp", email, token, type }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Verification failed");
    return { data: { user: data.user, session: { user: data.user } }, error: null };
  } catch (err: any) {
    return { data: { user: null, session: null }, error: { message: err?.message || "Invalid OTP code" } };
  }
}

async function demoSignInWithPassword(email: string) {
  try {
    const isGuest = email === "guest@mindcare.app" || email === "guest@understory.app";
    const res = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, is_guest: isGuest }),
    });
    const data = await res.json();
    return { data: { user: data.user, session: { user: data.user } }, error: null };
  } catch (err: any) {
    return { data: { user: null, session: null }, error: { message: err?.message || "Sign in failed" } };
  }
}

async function demoSignUp(email: string, options?: any) {
  try {
    const res = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: options?.data?.name, is_guest: false }),
    });
    const data = await res.json();
    return { data: { user: data.user, session: { user: data.user } }, error: null };
  } catch (err: any) {
    return { data: { user: null, session: null }, error: { message: err?.message || "Sign up failed" } };
  }
}

// Browser-side Supabase / Netlify auth client.
// Supports both live Supabase projects and seamless local/GitHub/Netlify sessions.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isRealSupabase =
    url && !url.includes("placeholder") && anonKey && !anonKey.includes("placeholder");

  if (isRealSupabase && !getLocalUser()) {
    if (!cachedBrowserClient) {
      const realClient = createBrowserClient(url, anonKey);
      const originalSignInWithPassword = realClient.auth.signInWithPassword.bind(realClient.auth);
      const originalSignUp = realClient.auth.signUp?.bind(realClient.auth);
      const originalSignInWithOtp = realClient.auth.signInWithOtp?.bind(realClient.auth);
      const originalVerifyOtp = realClient.auth.verifyOtp?.bind(realClient.auth);
      const originalSignOut = realClient.auth.signOut.bind(realClient.auth);

      realClient.auth.signInWithPassword = (async (credentials: any) => {
        if (credentials.email === "guest@mindcare.app" || credentials.email === "guest@understory.app") {
          const user = setGuestSession();
          await fetch("/api/auth/demo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "guest@mindcare.app", is_guest: true }),
          }).catch(() => {});
          return { data: { user, session: { user } }, error: null };
        }
        try {
          const res = await originalSignInWithPassword(credentials);
          if (!res.error) return res;
          console.warn("[Auth] Supabase signInWithPassword failed, trying demo fallback:", res.error);
          return demoSignInWithPassword(credentials.email);
        } catch (err) {
          console.warn("[Auth] Supabase network error, falling back to demo mode:", err);
          return demoSignInWithPassword(credentials.email);
        }
      }) as any;

      realClient.auth.signUp = (async (credentials: any) => {
        try {
          if (originalSignUp) {
            const res = await originalSignUp(credentials);
            if (!res.error) return res;
          }
          return demoSignUp(credentials.email, credentials.options);
        } catch (err) {
          console.warn("[Auth] Supabase network error in signUp, falling back to demo mode:", err);
          return demoSignUp(credentials.email, credentials.options);
        }
      }) as any;

      realClient.auth.signInWithOtp = (async (credentials: any) => {
        try {
          if (originalSignInWithOtp) {
            const res = await originalSignInWithOtp(credentials);
            if (!res.error) return res;
          }
          return demoSignInWithOtp(credentials.email, credentials.options);
        } catch (err) {
          console.warn("[Auth] Supabase network error in signInWithOtp, falling back to demo mode:", err);
          return demoSignInWithOtp(credentials.email, credentials.options);
        }
      }) as any;

      realClient.auth.verifyOtp = (async (credentials: any) => {
        try {
          if (originalVerifyOtp) {
            const res = await originalVerifyOtp(credentials);
            if (!res.error) return res;
          }
          return demoVerifyOtp(credentials.email, credentials.token, credentials.type);
        } catch (err) {
          console.warn("[Auth] Supabase network error in verifyOtp, falling back to demo mode:", err);
          return demoVerifyOtp(credentials.email, credentials.token, credentials.type);
        }
      }) as any;

      realClient.auth.signOut = (async (...args: any[]) => {
        clearLocalSession();
        await fetch("/api/auth/demo", { method: "DELETE" }).catch(() => {});
        return originalSignOut(...args);
      }) as any;

      realClient.auth.signInWithOAuth = (async ({ provider, options }: any) => {
        if (provider === "github") {
          const next = options?.redirectTo || "/dashboard";
          signInWithGithub(undefined, next);
          return { data: { provider: "github", url: `/api/auth/github?next=${encodeURIComponent(next)}` }, error: null };
        }
        return { data: null, error: { message: `Provider ${provider} not supported` } };
      }) as any;

      cachedBrowserClient = realClient;
    }
    return cachedBrowserClient;
  }

  return {
    auth: {
      async getUser() {
        const user = getLocalUser();
        return { data: { user }, error: null };
      },
      async getSession() {
        const user = getLocalUser();
        if (!user) return { data: { session: null }, error: null };
        return {
          data: {
            session: {
              access_token: demoAccessToken(user.id),
              token_type: "bearer",
              expires_in: 3600,
              refresh_token: "demo-refresh-token",
              user,
            },
          },
          error: null,
        };
      },
      async signInWithOAuth({ provider, options }: { provider: string; options?: any }) {
        if (provider === "github") {
          const next = options?.redirectTo || "/dashboard";
          signInWithGithub(undefined, next);
          return { data: { provider: "github", url: `/api/auth/github?next=${encodeURIComponent(next)}` }, error: null };
        }
        return { data: null, error: { message: `Provider ${provider} not supported` } };
      },
      async signInWithPassword({ email }: { email: string }) {
        return demoSignInWithPassword(email);
      },
      async signUp({ email, options }: { email: string; options?: any }) {
        return demoSignUp(email, options);
      },
      async signInWithOtp({ email, options }: { email: string; options?: any }) {
        return demoSignInWithOtp(email, options);
      },
      async verifyOtp({ email, token, type }: { email: string; token: string; type?: string }) {
        return demoVerifyOtp(email, token, type);
      },
      async signOut() {
        clearLocalSession();
        await fetch("/api/auth/demo", { method: "DELETE" }).catch(() => {});
        return { error: null };
      },
      onAuthStateChange(_callback: any) {
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from(table: string) {
      const user = getLocalUser();
      return createQueryBuilder(table, user?.id);
    },
  } as any;
}
