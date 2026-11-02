import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];
// Pages that need a signed-in (or guest) session.
const PROTECTED = ["/dashboard", "/chat", "/voice", "/history", "/profile", "/settings"];

const hasSession = (request: NextRequest) =>
  Boolean(
    request.cookies.get("mindcare_user_session")?.value ||
      request.cookies.get("understory_user_session")?.value ||
      request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.value)
  );

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const signedIn = hasSession(request);

  // Signed-in users have no reason to see the auth pages.
  if (signedIn && matches(path, AUTH_PAGES)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Signed-out users are sent to the login page and returned afterwards.
  if (!signedIn && matches(path, PROTECTED)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // NOTE: this middleware never creates a session. Identity is established only by
  // an explicit action (login/OTP/guest) through /api/auth/demo or real Supabase auth.
  return NextResponse.next({ request: { headers: request.headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
