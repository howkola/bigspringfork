import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  source_type: z
    .enum([
      "peer_reviewed_study",
      "government_report",
      "internal_program_data",
      "evaluation_report",
      "news_or_media",
      "other",
    ])
    .optional(),
  authors: z.string().nullish(),
  publication: z.string().nullish(),
  publication_year: z.number().int().min(1900).max(2100).nullish(),
  url: z.string().url().nullish().or(z.literal("").transform(() => null)),
  summary: z.string().min(1).optional(),
  key_findings: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string()).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const body = updateSchema.parse(await request.json());

    const { data: before } = await supabase
      .from("corpus_entries")
      .select("*")
      .eq("id", params.id)
      .single();
    if (!before) return jsonError("Corpus entry not found", 404);

    const { data, error } = await supabase
      .from("corpus_entries")
      .update(body)
      .eq("id", params.id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "corpus_entry.updated",
      entityType: "corpus_entry",
      entityId: params.id,
      detail: { changed_fields: Object.keys(body) },
    });

    return NextResponse.json({ entry: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();

    // Archive rather than delete: existing citation claims keep their source.
    const { data, error } = await supabase
      .from("corpus_entries")
      .update({ is_archived: true })
      .eq("id", params.id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    if (!data) return jsonError("Corpus entry not found", 404);

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "corpus_entry.archived",
      entityType: "corpus_entry",
      entityId: params.id,
      detail: { title: data.title },
    });

    return NextResponse.json({ entry: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
