"use client";

import { useEffect, useState, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, getLocalUser } from "@/lib/supabase/client";

export function useAuth() {
  // Start null on both server and client (cookie is read in the effect) to avoid hydration mismatches.
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    // Fast resolution: If a local/guest session exists, use it immediately
    const local = getLocalUser();
    if (local) {
      setUser(local as any);
      setLoading(false);
    }

    supabase.auth
      .getUser()
      .then(({ data }: any) => {
        if (active) {
          if (data?.user) {
            setUser(data.user);
          } else if (!local) {
            setUser(null);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const { data: listener }: any = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (active) {
        setUser(session?.user ?? (getLocalUser() as any) ?? null);
      }
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  return { user, loading, supabase };
}
