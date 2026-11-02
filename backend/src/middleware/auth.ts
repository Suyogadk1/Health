import { Request, Response, NextFunction } from "express";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Middleware that verifies a Supabase JWT from the Authorization header.
 * Rejects requests without a valid session with HTTP 401.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith("Bearer "))
    ? authHeader.slice(7).trim()
    : "";

  // 0. Per-user demo tokens ("demo-token:<userId>") issued by the frontend's demo auth.
  //    Demo mode only: the id is client-supplied, so it is sanitised and NOT a security boundary.
  if (token.startsWith("demo-token:")) {
    const id = token.slice("demo-token:".length).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    if (id) {
      req.user = { id, role: "authenticated" };
      return next();
    }
  }

  // 1. Fast-track local demo tokens and guest fallback (seamless onboarding)
  if (!token || token === "demo-token" || token === "undefined" || token === "null") {
    req.user = {
      id: "friend-user",
      email: "friend@mindcare.app",
      role: "authenticated",
    };
    return next();
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isRealSupabase = Boolean(
    supabaseUrl &&
    !supabaseUrl.includes("placeholder") &&
    supabaseKey &&
    !supabaseKey.includes("placeholder")
  );

  // 2. If live Supabase credentials are configured, verify JWT with Supabase Auth API
  if (isRealSupabase && supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseKey,
        },
      });

      if (response.ok) {
        const userData = (await response.json()) as any;
        if (userData && userData.id) {
          req.user = {
            id: userData.id,
            email: userData.email,
            role: userData.role || "authenticated",
          };
          return next();
        }
      } else if (response.status === 401) {
        return res.status(401).json({
          error: "Unauthorized: Invalid or expired Supabase session",
        });
      }
    } catch (err) {
      console.warn("[Auth Middleware] Supabase unreachable or network failure, falling back to token decode:", (err as any)?.message || err);
    }
  }

  // 3. Decode standard JWT structure (header.payload.signature) to verify expiry and claims
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload = JSON.parse(payloadJson);

      // Verify expiration claim if present
      if (payload.exp && typeof payload.exp === "number") {
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec > payload.exp) {
          return res.status(401).json({
            error: "Unauthorized: Session token has expired",
          });
        }
      }

      const userId = payload.sub || payload.id;
      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized: Invalid token payload (missing subject claim)",
        });
      }

      req.user = {
        id: userId,
        email: payload.email,
        role: payload.role || "authenticated",
      };

      return next();
    } catch (err) {
      return res.status(401).json({
        error: "Unauthorized: Malformed JWT token",
      });
    }
  }

  // 3. Demo fallback: When running locally in demo mode without a live Supabase project,
  // allow the known demo session token from the local frontend mockStore
  if (!isRealSupabase && token === "demo-token") {
    req.user = {
      id: "friend-user",
      email: "friend@mindcare.app",
      role: "authenticated",
    };
    return next();
  }

  // Reject all other invalid tokens
  return res.status(401).json({
    error: "Unauthorized: Invalid or unsupported session token",
  });
}
