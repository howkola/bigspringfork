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
import { intakeJsonSchema, intakeValidator } from "@/lib/pipeline/schemas";
import { intakeSystemPrompt, intakeUserPrompt } from "@/lib/pipeline/prompts";
import type { CorpusEntry, GrantOpportunity } from "@/lib/types";

export const maxDuration = 300;

/**
 * Stage 1 — Intake. Analyzes the grant opportunity against the fresh evidence
 * corpus, produces a fit assessment and section plan, and opens the intake
 * review checkpoint. Re-runnable: a rejected or failed intake wipes the
 * previous plan and starts over.
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
    if (run.stage !== "intake") {
      return jsonError(
        `Intake can only run at the intake stage (run is at ${run.stage}).`,
        409,
      );
    }

    const grant = run.grant_opportunities as GrantOpportunity;

    // Only fresh, non-archived evidence is offered to the model.
    const { data: corpus, error: corpusError } = await supabase
      .from("corpus_entries")
      .select("*")
      .eq("is_archived", false)
      .gt("stale_after", new Date().toISOString())
      .order("confidence");
    if (corpusError) return jsonError(corpusError.message, 500);
    if (!corpus || corpus.length === 0) {
      return jsonError(
        "The corpus has no fresh entries. Add or re-verify corpus entries before running intake.",
        409,
      );
    }

    await clearRunFailure(supabase, run.id);

    let result;
    try {
      result = await callClaudeJSON({
        system: intakeSystemPrompt(),
        user: intakeUserPrompt(grant, corpus as CorpusEntry[]),
        schema: intakeJsonSchema as unknown as Record<string, unknown>,
        validator: intakeValidator,
      });
    } catch (error) {
      await recordRunFailure(supabase, run.id, "intake", error);
      throw error;
    }

    const analysis = result.data;
    const validCorpusIds = new Set((corpus as CorpusEntry[]).map((c) => c.id));

    // Replace any sections from a previous (rejected) intake.
    await supabase
      .from("generated_sections")
      .delete()
      .eq("pipeline_run_id", run.id);

    const sectionRows = analysis.section_plan.map((plan, i) => ({
      pipeline_run_id: run.id,
      section_key: plan.key,
      title: plan.title,
      sort_order: plan.sort_order ?? i,
      word_limit: plan.word_limit,
      drafting_guidance: plan.drafting_guidance,
      // Drop any hallucinated corpus ids at the door.
      relevant_corpus_ids: plan.relevant_corpus_ids.filter((id) =>
        validCorpusIds.has(id),
      ),
      status: "planned" as const,
    }));

    const { error: sectionError } = await supabase
      .from("generated_sections")
      .insert(sectionRows);
    if (sectionError) return jsonError(sectionError.message, 500);

    const { error: updateError } = await supabase
      .from("pipeline_runs")
      .update({ intake_analysis: analysis, stage: "intake_review" })
      .eq("id", run.id);
    if (updateError) return jsonError(updateError.message, 500);

    // Open the human checkpoint.
    await supabase.from("review_checkpoints").insert({
      pipeline_run_id: run.id,
      kind: "intake_review",
      status: "pending",
    });

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "pipeline_run.intake_completed",
      entityType: "pipeline_run",
      entityId: run.id,
      pipelineRunId: run.id,
      detail: {
        fit_score: analysis.fit_score,
        sections_planned: analysis.section_plan.length,
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      },
    });

    return NextResponse.json({ analysis, sections: sectionRows.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
