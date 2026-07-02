// research-search — given a claim or query, return candidate supporting papers
// from OpenAlex. No Claude call; kept cheap. Results are cached per org+query.
import { handleOptions, json } from "../_shared/cors.ts";
import { getAuthedContext } from "../_shared/auth.ts";
import { searchOpenAlex } from "../_shared/openalex.ts";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const ctx = await getAuthedContext(req);
  if (!ctx) return json({ error: "Unauthorized" }, 401);

  let body: { query?: string; claim?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const query = (body.query ?? body.claim ?? "").trim();
  if (!query) return json({ error: "Provide `query` or `claim`" }, 400);
  const limit = Math.min(Math.max(body.limit ?? 8, 1), 20);

  const queryHash = await sha256(`${query}::${limit}`);

  // Cache read (RLS scopes to the caller's org automatically).
  const { data: cached } = await ctx.supabase
    .from("research_cache")
    .select("results")
    .eq("query_hash", queryHash)
    .maybeSingle();

  if (cached?.results) {
    return json({ papers: cached.results, cached: true });
  }

  let papers;
  try {
    papers = await searchOpenAlex(query, limit);
  } catch (e) {
    return json({ error: `Research lookup failed: ${String(e)}` }, 502);
  }

  // Cache write. Need org_id: fetch the caller's profile once.
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("org_id")
    .eq("id", ctx.userId)
    .single();

  if (profile?.org_id) {
    await ctx.supabase
      .from("research_cache")
      .upsert(
        { org_id: profile.org_id, query_hash: queryHash, results: papers },
        { onConflict: "org_id,query_hash" },
      );
  }

  return json({ papers, cached: false });
});
