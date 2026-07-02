import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const updateSchema = z.object({
  funder: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  focus_areas: z.array(z.string()).optional(),
  amount_min: z.number().nullish(),
  amount_max: z.number().nullish(),
  deadline: z.string().nullish(),
  guidelines_url: z.string().url().nullish().or(z.literal("").transform(() => null)),
  status: z
    .enum(["prospect", "active", "submitted", "awarded", "declined", "archived"])
    .optional(),
  required_sections: z
    .array(
      z.object({
        key: z.string().min(1),
        title: z.string().min(1),
        word_limit: z.number().int().positive().optional(),
      }),
    )
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();
    const body = updateSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("grant_opportunities")
      .update(body)
      .eq("id", params.id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    if (!data) return jsonError("Grant opportunity not found", 404);

    await writeAudit(supabase, {
      actorId: profile.id,
      action: "grant_opportunity.updated",
      entityType: "grant_opportunity",
      entityId: params.id,
      detail: { changed_fields: Object.keys(body) },
    });

    return NextResponse.json({ grant: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
