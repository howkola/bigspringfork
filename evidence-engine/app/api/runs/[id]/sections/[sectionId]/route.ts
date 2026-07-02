import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { findMarkerMismatches, sectionGatePasses } from "@/lib/pipeline/citations";
import type { CitationClaim } from "@/lib/types";

const editSchema = z.object({
  content: z.string().min(1),
  edit_reason: z.string().min(1, "Give a reason for the edit — it goes in the audit trail."),
});

const EDITABLE_STATUSES = [
  "drafted",
  "verification_failed",
  "awaiting_review",
  "changes_requested",
  "approved",
];

/**
 * Human edit of a section's working text. Records a numbered revision with
 * before/after content, prunes claims whose citation markers were removed,
 * and re-evaluates the citation gate — an edit can demote a section back to
 * verification_failed but can never sneak one past the gate.
 * Editing an approved section always sends it back to review.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const body = editSchema.parse(await request.json());

    const { data: section } = await supabase
      .from("generated_sections")
      .select("*")
      .eq("id", params.sectionId)
      .eq("pipeline_run_id", params.id)
      .single();
    if (!section) return jsonError("Section not found", 404);
    if (!EDITABLE_STATUSES.includes(section.status)) {
      return jsonError(
        `Sections in status "${section.status}" cannot be edited.`,
        409,
      );
    }

    const previousContent: string | null = section.current_content;

    // Numbered revision for the audit trail.
    const { data: lastRevision } = await supabase
      .from("section_revisions")
      .select("revision_number")
      .eq("section_id", section.id)
      .order("revision_number", { ascending: false })
      .limit(1);
    const revisionNumber = (lastRevision?.[0]?.revision_number ?? 0) + 1;

    const { error: revisionError } = await supabase
      .from("section_revisions")
      .insert({
        section_id: section.id,
        revision_number: revisionNumber,
        previous_content: previousContent,
        new_content: body.content,
        edited_by: profile.id,
        edit_reason: body.edit_reason,
      });
    if (revisionError) return jsonError(revisionError.message, 500);

    // Claims whose markers no longer appear in the text are removed —
    // the claim map always reflects the current text.
    const { data: claims } = await supabase
      .from("citation_claims")
      .select("*")
      .eq("section_id", section.id);
    const allClaims = (claims ?? []) as CitationClaim[];
    const { claimsWithoutMarkers } = findMarkerMismatches(
      body.content,
      allClaims,
    );

    let removedClaims = 0;
    if (claimsWithoutMarkers.length > 0) {
      const doomed = allClaims.filter((c) =>
        claimsWithoutMarkers.includes(c.citation_marker),
      );
      const { error } = await supabase
        .from("citation_claims")
        .delete()
        .in(
          "id",
          doomed.map((c) => c.id),
        );
      if (error) return jsonError(error.message, 500);
      removedClaims = doomed.length;
    }

    // Re-evaluate the gate against the surviving claims.
    const surviving = allClaims.filter(
      (c) => !claimsWithoutMarkers.includes(c.citation_marker),
    );
    const gatePasses = sectionGatePasses(surviving);

    // An edited approved/awaiting section returns to review (or falls back to
    // verification_failed if the edit broke the gate).
    let nextStatus = section.status;
    if (["approved", "awaiting_review"].includes(section.status)) {
      nextStatus = gatePasses ? "awaiting_review" : "verification_failed";
    } else if (["drafted", "changes_requested", "verification_failed"].includes(section.status)) {
      // Stays in the verification queue; verify endpoint decides from here.
      nextStatus = section.status === "changes_requested" ? "changes_requested" : "drafted";
      if (!gatePasses && surviving.some((c) => c.verification_status !== "pending")) {
        nextStatus = section.status; // keep existing failed/drafted state
      }
    }

    const { error: updateError } = await supabase
      .from("generated_sections")
      .update({ current_content: body.content, status: nextStatus })
      .eq("id", section.id);
    if (updateError) return jsonError(updateError.message, 409);

    // Re-open a review checkpoint if we knocked an approved section back.
    if (section.status === "approved") {
      await supabase.from("review_checkpoints").insert({
        pipeline_run_id: params.id,
        kind: "section_review",
        section_id: section.id,
        status: "pending",
      });
    }

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "generated_section.edited",
      entityType: "generated_section",
      entityId: section.id,
      pipelineRunId: params.id,
      detail: {
        revision_number: revisionNumber,
        edit_reason: body.edit_reason,
        previous_status: section.status,
        new_status: nextStatus,
        removed_claims: removedClaims,
        chars_before: previousContent?.length ?? 0,
        chars_after: body.content.length,
      },
    });

    return NextResponse.json({
      revision_number: revisionNumber,
      removed_claims: removedClaims,
      status: nextStatus,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
