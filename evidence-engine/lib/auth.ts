import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface TeamContext {
  supabase: SupabaseClient;
  profile: Profile;
}

/**
 * Resolve the calling user and assert they are an active grants-team member.
 * Every API route goes through this; RLS is the second line of defense.
 */
export async function requireTeamMember(): Promise<TeamContext> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError("Not signed in", 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    throw new AuthError(
      "Your account is not on the grants team. Ask an admin to add you to the allowlist.",
      403,
    );
  }

  return { supabase, profile: profile as Profile };
}
