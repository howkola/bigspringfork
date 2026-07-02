import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const decisionSchema = z.object({
  checkpoint_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  notes: z.string().optional(),
});

/**
 * Stage 4 — Human review gate. Records a decision on a pending checkpoint and
 * moves the run/section accordingly. Every decision lands in the audit log.
 *
 *  - intake_review:  approved -> drafting; rejected -> back to intake (plan wiped on re-run)
 *  - section_review: approved -> section approved (all approved -> run to assembly-ready);
 *                    rejected/changes_requested -> section back to drafting queue
 *  - final_review:   approved -> run completed; rejected -> back to section_review
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const body = decisionSchema.parse(await request.json());

    const { data: run } = await supabase
      .from("pipeline_runs")
      .select("*")
      .eq("id", params.id)
      .single();
    if (!run) return jsonError("Pipeline run not found", 404);
    if (run.status === "cancelled") return jsonError("Run is cancelled", 409);

    const { data: checkpoint } = await supabase
      .from("review_checkpoints")
      .select("*")
      .eq("id", body.checkpoint_id)
      .eq("pipeline_run_id", run.id)
      .single();
    if (!checkpoint) return jsonError("Checkpoint not found", 404);
    if (checkpoint.status !== "pending") {
      return jsonError("This checkpoint has already been decided.", 409);
    }

    const { error: cpError } = await supabase
      .from("review_checkpoints")
      .update({
        status: body.decision,
        reviewer_id: profile.id,
        notes: body.notes ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", checkpoint.id);
    if (cpError) return jsonError(cpError.message, 500);

    let outcome = "";

    if (checkpoint.kind === "intake_review") {
      if (body.decision === "approved") {
        await supabase
          .from("pipeline_runs")
          .update({ stage: "drafting" })
          .eq("id", run.id);
        outcome = "Intake plan approved — run moved to drafting.";
      } else {
        await supabase
          .from("pipeline_runs")
          .update({ stage: "intake" })
          .eq("id", run.id);
        outcome =
          "Intake plan rejected — re-run intake to generate a new plan.";
      }
    }

    if (checkpoint.kind === "section_review") {
      if (!checkpoint.section_id) {
        return jsonError("Section checkpoint is missing its section.", 500);
      }
      if (body.decision === "approved") {
        // DB citation gate re-checks this transition.
        const { error } = await supabase
          .from("generated_sections")
          .update({ status: "approved" })
          .eq("id", checkpoint.section_id);
        if (error) return jsonError(error.message, 409);
        outcome = "Section approved.";

        const { data: unapproved } = await supabase
          .from("generated_sections")
          .select("id")
          .eq("pipeline_run_id", run.id)
          .not("status", "in", "(approved,final)");
        if ((unapproved ?? []).length === 0) {
          outcome += " All sections approved — ready for final assembly.";
        }
      } else {
        await supabase
          .from("generated_sections")
          .update({ status: "changes_requested" })
          .eq("id", checkpoint.section_id);
        // Send the run back so the drafting endpoint accepts a redraft.
        if (run.stage === "section_review") {
          await supabase
            .from("pipeline_runs")
            .update({ stage: "drafting" })
            .eq("id", run.id);
        }
        outcome =
          "Section sent back for changes — redraft it or edit the text directly, then re-verify.";
      }
    }

    if (checkpoint.kind === "final_review") {
      if (body.decision === "approved") {
        const { error } = await supabase
          .from("pipeline_runs")
          .update({
            stage: "completed",
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id);
        if (error) return jsonError(error.message, 409);
        outcome = "Final proposal approved — run completed.";
      } else {
        await supabase
          .from("pipeline_runs")
          .update({ stage: "section_review" })
          .eq("id", run.id);
        outcome =
          "Final assembly rejected — run returned to section review. Re-open sections as needed, then reassemble.";
      }
    }

    await writeAudit(supabase, {
      actorId: profile.id,
      action: `review_checkpoint.${body.decision}`,
      entityType: "review_checkpoint",
      entityId: checkpoint.id,
      pipelineRunId: run.id,
      detail: {
        kind: checkpoint.kind,
        section_id: checkpoint.section_id,
        notes: body.notes ?? null,
        outcome,
      },
    });

    return NextResponse.json({ outcome });
  } catch (error) {
    return handleRouteError(error);
  }
}
