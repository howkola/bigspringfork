import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export function roleOf(user: User | null): string {
  return (user?.app_metadata as Record<string, unknown> | undefined)?.app_role as string ?? "";
}

/** Gate for Writer's Room pages. Redirects to /login or /archive as appropriate. */
export async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (roleOf(user) !== "writer") redirect("/archive");
  return { supabase, user };
}

/** Gate for the Archive. Writers may preview; archive readers belong here. */
export async function requireReader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const role = roleOf(user);
  if (role !== "writer" && role !== "archive_reader") redirect("/login");
  return { supabase, user, role };
}
