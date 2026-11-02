import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createQueryBuilder } from "./mockStore";

// Server-side Supabase client for use in Server Components, Route Handlers,
// and Server Actions. Supports live Supabase projects and seamless local demo sessions.
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isRealSupabase =
    url && !url.includes("placeholder") && anonKey && !anonKey.includes("placeholder");

  // A real Supabase session cookie (sb-...) only exists after someone has
  // actually completed a real Supabase auth flow. Check this BEFORE
  // touching the demo/guest mock path, and use it whenever it's present -
  // a genuine authenticated session should always take priority over a
  // leftover demo cookie from earlier local testing.
  const hasSupabaseCookie = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-") && Boolean(c.value));

  if (isRealSupabase && hasSupabaseCookie) {
    return createServerClient(url, anonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {}
        },
      },
    });
  }

  // Demo/mock path: only recognizes an EXPLICIT session, set by the
  // /api/auth/demo route after a real login/OTP/guest action. If no such
  // cookie exists, localUser stays null and getUser()/getSession() below
  // report no authenticated user - callers (e.g. the chat route's
  // GUEST_MODE_ENABLED check) can then correctly treat the request as
  // unauthenticated instead of silently being handed a shared identity.
  const demoCookie =
    cookieStore.get("mindcare_user_session")?.value ||
    cookieStore.get("understory_user_session")?.value;

  let localUser: any = null;
  if (demoCookie) {
    try {
      localUser = JSON.parse(decodeURIComponent(demoCookie));
    } catch {}
  }

  return {
    auth: {
      async getUser() {
        return { data: { user: localUser }, error: null };
      },
      async getSession() {
        if (!localUser) return { data: { session: null }, error: null };
        return {
          data: {
            session: {
              access_token: localUser?.id ? `demo-token:${localUser.id}` : "demo-token",
              token_type: "bearer",
              expires_in: 3600,
              refresh_token: "demo-refresh-token",
              user: localUser,
            },
          },
          error: null,
        };
      },
    },
    from(table: string) {
      return createQueryBuilder(table, localUser?.id);
    },
  } as any;
}

// Service-role client for administrative actions.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isRealSupabase =
    url && !url.includes("placeholder") && key && !key.includes("placeholder");

  if (isRealSupabase) {
    const { createClient } = require("@supabase/supabase-js");
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }

  return {
    auth: {
      admin: {
        async deleteUser(_id: string) {
          return { error: null };
        },
      },
    },
    from(table: string) {
      return createQueryBuilder(table);
    },
  } as any;
}
