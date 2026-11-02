import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

// Deletes the authenticated user's application data, then deletes the
// underlying auth user via the service-role client. This route is the only
// place the service-role key is used, and it only ever acts on the id taken
// from the verified session - never from the request body.
export async function POST() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS-scoped deletes of application data (belt-and-suspenders alongside
  // any "on delete cascade" foreign keys already defined in the schema).
  await supabase.from("messages").delete().eq("user_id", user.id);
  await supabase.from("conversations").delete().eq("user_id", user.id);
  await supabase.from("wellbeing_checkins").delete().eq("user_id", user.id);
  await supabase.from("profiles").delete().eq("user_id", user.id);

  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("Failed to delete auth user:", error);
    return NextResponse.json(
      { error: "We deleted your data but hit a problem removing your account. Please contact support." },
      { status: 500 }
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
