import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const corpusEntrySchema = z.object({
  title: z.string().min(1),
  source_type: z
    .enum([
      "peer_reviewed_study",
      "government_report",
      "internal_program_data",
      "evaluation_report",
      "news_or_media",
      "other",
    ])
    .default("other"),
  authors: z.string().nullish(),
  publication: z.string().nullish(),
  publication_year: z.number().int().min(1900).max(2100).nullish(),
  url: z.string().url().nullish().or(z.literal("").transform(() => null)),
  summary: z.string().min(1),
  key_findings: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string()).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  freshness_months: z.number().int().min(1).max(60).default(12),
});

export async function GET() {
  try {
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase
      .from("corpus_entries")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ entries: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const body = corpusEntrySchema.parse(await request.json());
    const { freshness_months, ...fields } = body;

    const staleAfter = new Date();
    staleAfter.setMonth(staleAfter.getMonth() + freshness_months);

    const { data, error } = await supabase
      .from("corpus_entries")
      .insert({
        ...fields,
        last_verified_at: new Date().toISOString(),
        stale_after: staleAfter.toISOString(),
        created_by: profile.id,
      })
      .select()
      .single();
    if (error) return jsonError(error.message, 500);

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "corpus_entry.created",
      entityType: "corpus_entry",
      entityId: data.id,
      detail: { title: data.title },
    });

    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
