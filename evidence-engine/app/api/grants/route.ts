import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const grantSchema = z.object({
  funder: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  focus_areas: z.array(z.string()).default([]),
  amount_min: z.number().nullish(),
  amount_max: z.number().nullish(),
  deadline: z.string().nullish(),
  guidelines_url: z.string().url().nullish().or(z.literal("").transform(() => null)),
  required_sections: z
    .array(
      z.object({
        key: z.string().min(1),
        title: z.string().min(1),
        word_limit: z.number().int().positive().optional(),
      }),
    )
    .default([]),
});

export async function GET() {
  try {
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase
      .from("grant_opportunities")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ grants: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const body = grantSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("grant_opportunities")
      .insert({ ...body, created_by: profile.id })
      .select()
      .single();
    if (error) return jsonError(error.message, 500);

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "grant_opportunity.created",
      entityType: "grant_opportunity",
      entityId: data.id,
      detail: { funder: data.funder, title: data.title },
    });

    return NextResponse.json({ grant: data }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
