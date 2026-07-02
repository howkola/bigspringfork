import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in dev; a misconfigured env is the #1 setup mistake.
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy web/.env.example to .env.local.",
  );
}

// Untyped client. To get end-to-end types, generate the DB types with
//   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// then `createClient<Database>(...)` with the generated `Database`.
export const supabase = createClient(url, anonKey);
