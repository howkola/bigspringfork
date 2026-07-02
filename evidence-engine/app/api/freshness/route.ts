import { NextResponse } from "next/server";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

/** List corpus entries that are past their freshness deadline. */
export async function GET() {
  try {
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase
      .from("corpus_entries")
      .select("*")
      .eq("is_archived", false)
      .lte("stale_after", new Date().toISOString())
      .order("stale_after");
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ stale_entries: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Freshness sweep. Flags verified claims in active runs whose cited source
 * has passed its stale_after date — those claims fall back out of the gate
 * until the source is re-verified. Safe to call any time; also suitable for a
 * cron trigger.
 */
export async function POST() {
  try {
    const { supabase, profile } = await requireTeamMember();

    const { data: flagged, error } = await supabase.rpc("flag_stale_citations");
    if (error) return jsonError(error.message, 500);

    // Sections that had claims flagged must drop out of awaiting_review /
    // approved so the gate is re-run after re-verification.
    const { data: affected } = await supabase
      .from("citation_claims")
      .select("section_id")
      .eq("verification_status", "stale_source");
    const sectionIds = [...new Set((affected ?? []).map((r) => r.section_id))];

    let demoted = 0;
    if (sectionIds.length > 0) {
      const { data: demotedRows } = await supabase
        .from("generated_sections")
        .update({ status: "verification_failed" })
        .in("id", sectionIds)
        .in("status", ["awaiting_review", "approved"])
        .select("id");
      demoted = demotedRows?.length ?? 0;
    }

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "freshness.sweep",
      entityType: "citation_claim",
      detail: { claims_flagged: flagged ?? 0, sections_demoted: demoted },
    });

    return NextResponse.json({
      claims_flagged: flagged ?? 0,
      sections_demoted: demoted,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
