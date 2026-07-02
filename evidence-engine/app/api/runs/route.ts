import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  grant_opportunity_id: z.string().uuid(),
});

export async function GET() {
  try {
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase
      .from("pipeline_runs")
      .select("*, grant_opportunities(funder, title, deadline)")
      .order("created_at", { ascending: false });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ runs: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const body = createSchema.parse(await request.json());

    const { data: grant } = await supabase
      .from("grant_opportunities")
      .select("id, funder, title")
      .eq("id", body.grant_opportunity_id)
      .single();
    if (!grant) return jsonError("Grant opportunity not found", 404);

    const { data: run, error } = await supabase
      .from("pipeline_runs")
      .insert({
        grant_opportunity_id: grant.id,
        stage: "intake",
        status: "active",
        created_by: profile.id,
      })
      .select()
      .single();
    if (error) return jsonError(error.message, 500);

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "pipeline_run.created",
      entityType: "pipeline_run",
      entityId: run.id,
      pipelineRunId: run.id,
      detail: { funder: grant.funder, grant_title: grant.title },
    });

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
