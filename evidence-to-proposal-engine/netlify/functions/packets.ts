import type { Context } from "@netlify/functions";
import type {
  LoadPacketResponse,
  PacketData,
  PacketMeta,
  SavePacketResponse,
} from "../../shared/types";
import { json } from "./lib/anthropic";
import { getSupabase, newSlug, SLUG_RE } from "./lib/supabase";

/* ---- Phase 3: save & revisit packets ----
   No accounts. A packet is addressed by an unguessable slug; anyone with the
   slug can view/edit. All DB access is server-side via the service-role key.

   GET  /api/packets?slug=<slug>  -> load one packet
   GET  /api/packets?list=1       -> recent packet metadata
   POST /api/packets              -> create (no slug) or update (with slug) */

const NOT_CONFIGURED = "Persistence is not configured on the server";

export default async (req: Request, _context: Context): Promise<Response> => {
  const supabase = getSupabase();
  if (!supabase) return json({ error: NOT_CONFIGURED }, 503);

  // ---------- GET: load one, or list recent ----------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (url.searchParams.get("list")) {
      const { data, error } = await supabase
        .from("packets")
        .select("slug, request, updated_at")
        .order("updated_at", { ascending: false })
        .limit(25);
      if (error) return json({ error: error.message }, 500);
      const items: PacketMeta[] = (data || []).map((r) => ({
        slug: r.slug as string,
        request: (r.request as string) || "",
        updatedAt: r.updated_at as string,
      }));
      return json({ items });
    }

    if (!slug) return json({ error: "Missing 'slug'" }, 400);
    if (!SLUG_RE.test(slug)) return json({ error: "Invalid slug" }, 400);

    const { data, error } = await supabase
      .from("packets")
      .select("slug, data, updated_at")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Not found" }, 404);

    return json({
      slug: data.slug,
      data: data.data as PacketData,
      updatedAt: data.updated_at,
    } satisfies LoadPacketResponse);
  }

  // ---------- POST: create or update ----------
  if (req.method === "POST") {
    let body: { slug?: string; data?: PacketData };
    try {
      body = (await req.json()) as { slug?: string; data?: PacketData };
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const data = body.data;
    if (!data || typeof data !== "object") return json({ error: "Missing 'data'" }, 400);

    const slug = body.slug && SLUG_RE.test(body.slug) ? body.slug : newSlug();
    const now = new Date().toISOString();

    const { error } = await supabase.from("packets").upsert(
      {
        slug,
        request: (data.request || "").slice(0, 2000),
        data,
        updated_at: now,
      },
      { onConflict: "slug" }
    );
    if (error) return json({ error: error.message }, 500);

    return json({ slug, updatedAt: now } satisfies SavePacketResponse);
  }

  return json({ error: "Method not allowed" }, 405);
};
