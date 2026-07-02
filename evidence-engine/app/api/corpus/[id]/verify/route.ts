import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const verifySchema = z.object({
  freshness_months: z.number().int().min(1).max(60).default(12),
  notes: z.string().optional(),
});

/**
 * A human confirms a corpus entry is still valid. Resets its freshness clock
 * and puts any claims that were flagged stale_source back into the
 * verification queue (pending) for active runs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const body = verifySchema.parse(await request.json().catch(() => ({})));

    const staleAfter = new Date();
    staleAfter.setMonth(staleAfter.getMonth() + body.freshness_months);

    const { data: entry, error } = await supabase
      .from("corpus_entries")
      .update({
        last_verified_at: new Date().toISOString(),
        stale_after: staleAfter.toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    if (!entry) return jsonError("Corpus entry not found", 404);

    // Requeue claims previously flagged stale because of this entry.
    const { data: requeued } = await supabase
      .from("citation_claims")
      .update({
        verification_status: "pending",
        verification_notes: `Source re-verified by ${profile.email} on ${new Date().toISOString().slice(0, 10)}; claim requeued for verification.`,
        verified_at: null,
      })
      .eq("corpus_entry_id", params.id)
      .eq("verification_status", "stale_source")
      .select("id");

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "corpus_entry.freshness_verified",
      entityType: "corpus_entry",
      entityId: params.id,
      detail: {
        title: entry.title,
        stale_after: entry.stale_after,
        requeued_claims: requeued?.length ?? 0,
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json({
      entry,
      requeued_claims: requeued?.length ?? 0,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
