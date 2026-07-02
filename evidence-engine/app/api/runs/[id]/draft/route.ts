import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import {
  clearRunFailure,
  handleRouteError,
  jsonError,
  recordRunFailure,
} from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { callClaudeJSON, PipelineApiError } from "@/lib/anthropic";
import { draftJsonSchema, draftValidator } from "@/lib/pipeline/schemas";
import { draftSystemPrompt, draftUserPrompt } from "@/lib/pipeline/prompts";
import {
  classifyDraftClaims,
  findMarkerMismatches,
} from "@/lib/pipeline/citations";
import type {
  CorpusEntry,
  GeneratedSection,
  GrantOpportunity,
} from "@/lib/types";

export const maxDuration = 300;

const bodySchema = z.object({
  // Optional: redraft a single section (e.g. after a rejected review or a
  // failed verification). Omit to draft everything outstanding.
  section_id: z.string().uuid().optional(),
});

const DRAFTABLE_STATUSES = [
  "planned",
  "drafting",
  "changes_requested",
  "verification_failed",
];

/**
 * Stage 2 — Section drafting. One model call per section; each call returns
 * the narrative plus its claim-to-citation mapping. Idempotent: sections that
 * already have a draft are skipped, so a run that failed mid-stage resumes
 * where it stopped.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    const { data: run } = await supabase
      .from("pipeline_runs")
      .select("*, grant_opportunities(*)")
      .eq("id", params.id)
      .single();
    if (!run) return jsonError("Pipeline run not found", 404);
    if (run.status === "cancelled" || run.stage === "completed") {
      return jsonError("Run is not active", 409);
    }
    if (!["drafting", "citation_verification", "section_review"].includes(run.stage)) {
      return jsonError(
        `Drafting is not available at the ${run.stage} stage. Approve the intake review first.`,
        409,
      );
    }

    const grant = run.grant_opportunities as GrantOpportunity;

    let sectionQuery = supabase
      .from("generated_sections")
      .select("*")
      .eq("pipeline_run_id", run.id)
      .in("status", DRAFTABLE_STATUSES)
      .order("sort_order");
    if (body.section_id) {
      sectionQuery = sectionQuery.eq("id", body.section_id);
    }
    const { data: sections } = await sectionQuery;

    if (!sections || sections.length === 0) {
      return jsonError(
        body.section_id
          ? "That section is not in a draftable state."
          : "No sections need drafting.",
        409,
      );
    }

    // Fresh corpus only; stale sources are never offered to the drafter.
    const { data: corpus, error: corpusError } = await supabase
      .from("corpus_entries")
      .select("*")
      .eq("is_archived", false)
      .gt("stale_after", new Date().toISOString());
    if (corpusError) return jsonError(corpusError.message, 500);
    const corpusById = new Map(
      ((corpus ?? []) as CorpusEntry[]).map((c) => [c.id, c]),
    );

    await clearRunFailure(supabase, run.id);

    const drafted: string[] = [];
    for (const sectionRow of sections as GeneratedSection[]) {
      // Corpus entries the intake plan selected; a missing entry (deleted,
      // archived, or gone stale since planning) is simply not offered.
      const offered = sectionRow.relevant_corpus_ids
        .map((id) => corpusById.get(id))
        .filter((e): e is CorpusEntry => Boolean(e));
      const sources = offered.length > 0 ? offered : [...corpusById.values()];

      if (sources.length === 0) {
        await recordRunFailure(
          supabase,
          run.id,
          "drafting",
          new PipelineApiError(
            `No fresh corpus entries are available for section "${sectionRow.title}". Re-verify or add corpus entries, then resume drafting.`,
            false,
          ),
        );
        return jsonError(
          `No fresh corpus entries available for section "${sectionRow.title}".`,
          409,
        );
      }

      await supabase
        .from("generated_sections")
        .update({ status: "drafting" })
        .eq("id", sectionRow.id);

      let result;
      try {
        result = await callClaudeJSON({
          system: draftSystemPrompt(),
          user: draftUserPrompt(grant, sectionRow, sources),
          schema: draftJsonSchema as unknown as Record<string, unknown>,
          validator: draftValidator,
        });
      } catch (error) {
        // Leave already-drafted sections intact; the run records the failure
        // and this endpoint resumes from the failed section when retried.
        await supabase
          .from("generated_sections")
          .update({ status: "planned" })
          .eq("id", sectionRow.id);
        await recordRunFailure(supabase, run.id, "drafting", error);
        throw error;
      }

      const { content, claims } = result.data;

      // Every inline marker must be traceable, and every claim must appear.
      const mismatches = findMarkerMismatches(content, claims);
      if (
        mismatches.markersWithoutClaims.length > 0 ||
        mismatches.claimsWithoutMarkers.length > 0
      ) {
        await supabase
          .from("generated_sections")
          .update({ status: "planned" })
          .eq("id", sectionRow.id);
        const err = new PipelineApiError(
          `Draft for "${sectionRow.title}" had citation markers that don't match its claim list (orphan markers: ${mismatches.markersWithoutClaims.join(", ") || "none"}; unplaced claims: ${mismatches.claimsWithoutMarkers.join(", ") || "none"}). Retry drafting.`,
          true,
        );
        await recordRunFailure(supabase, run.id, "drafting", err);
        throw err;
      }

      // Classify claims: fabricated ids -> missing_source, stale -> stale_source.
      const offeredById = new Map(sources.map((s) => [s.id, s]));
      const classified = classifyDraftClaims(claims, offeredById);

      // Replace prior draft state for this section (redraft path).
      await supabase
        .from("citation_claims")
        .delete()
        .eq("section_id", sectionRow.id);

      const { error: claimError } = await supabase
        .from("citation_claims")
        .insert(
          classified.map((c) => ({ ...c, section_id: sectionRow.id })),
        );
      if (claimError) return jsonError(claimError.message, 500);

      const { error: sectionError } = await supabase
        .from("generated_sections")
        .update({
          status: "drafted",
          draft_content: content,
          current_content: content,
          model_used: result.model,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          verification_summary: null,
        })
        .eq("id", sectionRow.id);
      if (sectionError) return jsonError(sectionError.message, 500);

      await writeAudit(supabase, {
        actorId: profile.id,
        action: "generated_section.drafted",
        entityType: "generated_section",
        entityId: sectionRow.id,
        pipelineRunId: run.id,
        detail: {
          section_key: sectionRow.section_key,
          claims: classified.length,
          fabricated_citations: classified.filter(
            (c) => c.verification_status === "missing_source",
          ).length,
          model: result.model,
        },
      });

      drafted.push(sectionRow.section_key);
    }

    // When nothing remains draftable, the run moves to verification.
    const { data: remaining } = await supabase
      .from("generated_sections")
      .select("id")
      .eq("pipeline_run_id", run.id)
      .in("status", DRAFTABLE_STATUSES);

    if ((remaining ?? []).length === 0 && run.stage === "drafting") {
      await supabase
        .from("pipeline_runs")
        .update({ stage: "citation_verification" })
        .eq("id", run.id);
    }

    return NextResponse.json({ drafted });
  } catch (error) {
    return handleRouteError(error);
  }
}
