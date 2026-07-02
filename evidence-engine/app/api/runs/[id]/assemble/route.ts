import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember } from "@/lib/auth";
import {
  clearRunFailure,
  handleRouteError,
  jsonError,
  recordRunFailure,
} from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { callClaudeJSON } from "@/lib/anthropic";
import { assembleJsonSchema, assembleValidator } from "@/lib/pipeline/schemas";
import { assembleSystemPrompt, assembleUserPrompt } from "@/lib/pipeline/prompts";
import { assembleDocument } from "@/lib/pipeline/assemble";
import { sectionGatePasses } from "@/lib/pipeline/citations";
import type {
  CitationClaim,
  CorpusEntry,
  GeneratedSection,
  GrantOpportunity,
} from "@/lib/types";

export const maxDuration = 300;

/**
 * Stage 5 — Final assembly. Deterministically stitches the approved sections
 * into one document with a unified reference list (the approved narrative is
 * the narrative that ships), then asks the model for an executive summary that
 * introduces no new claims. Re-checks the citation gate in code, and the DB
 * assembly-gate trigger re-checks it again on the stage transition.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();

    const { data: run } = await supabase
      .from("pipeline_runs")
      .select("*, grant_opportunities(*)")
      .eq("id", params.id)
      .single();
    if (!run) return jsonError("Pipeline run not found", 404);
    if (run.status === "cancelled" || run.stage === "completed") {
      return jsonError("Run is not active", 409);
    }
    if (!["section_review", "assembly"].includes(run.stage)) {
      return jsonError(
        `Assembly is not available at the ${run.stage} stage.`,
        409,
      );
    }

    const grant = run.grant_opportunities as GrantOpportunity;

    const { data: sectionRows } = await supabase
      .from("generated_sections")
      .select("*")
      .eq("pipeline_run_id", run.id)
      .order("sort_order");
    const sections = (sectionRows ?? []) as GeneratedSection[];

    if (sections.length === 0) {
      return jsonError("This run has no sections to assemble.", 409);
    }
    const unapproved = sections.filter(
      (s) => !["approved", "final"].includes(s.status),
    );
    if (unapproved.length > 0) {
      return jsonError(
        `Cannot assemble: ${unapproved.length} section(s) not yet approved (${unapproved
          .map((s) => s.section_key)
          .join(", ")}).`,
        409,
      );
    }

    // Application-level gate re-check (DB trigger is the backstop).
    const { data: claimRows } = await supabase
      .from("citation_claims")
      .select("*")
      .in(
        "section_id",
        sections.map((s) => s.id),
      );
    const claims = (claimRows ?? []) as CitationClaim[];
    const claimsBySection = new Map<string, CitationClaim[]>();
    for (const c of claims) {
      const list = claimsBySection.get(c.section_id) ?? [];
      list.push(c);
      claimsBySection.set(c.section_id, list);
    }
    for (const s of sections) {
      if (!sectionGatePasses(claimsBySection.get(s.id) ?? [])) {
        return jsonError(
          `Citation gate failed for section "${s.title}" — re-run verification before assembly.`,
          409,
        );
      }
    }

    // Move the run into assembly (DB assembly gate fires here).
    if (run.stage === "section_review") {
      const { error } = await supabase
        .from("pipeline_runs")
        .update({ stage: "assembly" })
        .eq("id", run.id);
      if (error) return jsonError(error.message, 409);
    }

    await clearRunFailure(supabase, run.id);

    const corpusIds = [
      ...new Set(claims.map((c) => c.corpus_entry_id).filter(Boolean)),
    ] as string[];
    const { data: corpus } = await supabase
      .from("corpus_entries")
      .select("*")
      .in("id", corpusIds);
    const corpusById = new Map(
      ((corpus ?? []) as CorpusEntry[]).map((c) => [c.id, c]),
    );

    const { document } = assembleDocument(sections, claimsBySection, corpusById);

    let result;
    try {
      result = await callClaudeJSON({
        system: assembleSystemPrompt(),
        user: assembleUserPrompt(
          grant,
          sections.map((s) => ({
            title: s.title,
            content: s.current_content ?? s.draft_content ?? "",
          })),
        ),
        schema: assembleJsonSchema as unknown as Record<string, unknown>,
        validator: assembleValidator,
      });
    } catch (error) {
      await recordRunFailure(supabase, run.id, "assembly", error);
      throw error;
    }

    const { error: saveError } = await supabase
      .from("pipeline_runs")
      .update({
        assembled_document: document,
        executive_summary: result.data.executive_summary,
        stage: "final_review",
      })
      .eq("id", run.id);
    if (saveError) return jsonError(saveError.message, 409);

    // Sections are now final.
    for (const s of sections) {
      await supabase
        .from("generated_sections")
        .update({ status: "final" })
        .eq("id", s.id);
    }

    // Open the final review checkpoint if none is pending.
    const { data: existing } = await supabase
      .from("review_checkpoints")
      .select("id")
      .eq("pipeline_run_id", run.id)
      .eq("kind", "final_review")
      .eq("status", "pending");
    if ((existing ?? []).length === 0) {
      await supabase.from("review_checkpoints").insert({
        pipeline_run_id: run.id,
        kind: "final_review",
        status: "pending",
      });
    }

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "pipeline_run.assembled",
      entityType: "pipeline_run",
      entityId: run.id,
      pipelineRunId: run.id,
      detail: {
        sections: sections.length,
        document_chars: document.length,
        model: result.model,
      },
    });

    return NextResponse.json({
      document_chars: document.length,
      executive_summary_chars: result.data.executive_summary.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
