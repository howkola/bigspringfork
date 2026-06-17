import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Server-side Supabase client using the service-role key. Lazily constructed so
   that an unconfigured deployment (no Supabase) simply disables persistence
   rather than crashing — getSupabase() returns null in that case. */
let _client: SupabaseClient | null = null;
let _checked = false;

export function getSupabase(): SupabaseClient | null {
  if (_checked) return _client;
  _checked = true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Short, URL-safe, unguessable-enough slug (36^10 space). */
export function newSlug(len = 10): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
  return s;
}

export const SLUG_RE = /^[a-z0-9]{6,32}$/;
