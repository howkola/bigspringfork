import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase } = await requireTeamMember();
    const { data: run, error } = await supabase
      .from("pipeline_runs")
      .select("*, grant_opportunities(*)")
      .eq("id", params.id)
      .single();
    if (error || !run) return jsonError("Pipeline run not found", 404);

    const [{ data: sections }, { data: checkpoints }] = await Promise.all([
      supabase
        .from("generated_sections")
        .select("*, citation_claims(*)")
        .eq("pipeline_run_id", params.id)
        .order("sort_order"),
      supabase
        .from("review_checkpoints")
        .select("*")
        .eq("pipeline_run_id", params.id)
        .order("created_at"),
    ]);

    return NextResponse.json({ run, sections, checkpoints });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Cancel a run. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const { data: run, error } = await supabase
      .from("pipeline_runs")
      .update({ status: "cancelled" })
      .eq("id", params.id)
      .neq("stage", "completed")
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    if (!run) return jsonError("Run not found or already completed", 404);

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "pipeline_run.cancelled",
      entityType: "pipeline_run",
      entityId: run.id,
      pipelineRunId: run.id,
    });

    return NextResponse.json({ run });
  } catch (error) {
    return handleRouteError(error);
  }
}
