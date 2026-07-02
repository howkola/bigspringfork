// Resolves the calling user from the request's JWT using the anon client.
// verify_jwt=true in config.toml already rejects unauthenticated calls; this
// gives us the user object (and, by extension, their org via RLS) for logging
// and for scoping any DB writes performed with the caller's token.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface AuthedContext {
  supabase: SupabaseClient;
  userId: string;
}

export async function getAuthedContext(
  req: Request,
): Promise<AuthedContext | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return { supabase, userId: data.user.id };
}
