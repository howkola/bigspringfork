import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Page-level guard: redirects instead of throwing. API routes use
 * requireTeamMember from lib/auth.ts instead.
 */
export async function requireTeamPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) redirect("/unauthorized");

  return { supabase, profile: profile as Profile };
}
