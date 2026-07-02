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
import { verifyJsonSchema, verifyValidator } from "@/lib/pipeline/schemas";
import { verifySystemPrompt, verifyUserPrompt } from "@/lib/pipeline/prompts";
import { gateFailureReasons, sectionGatePasses } from "@/lib/pipeline/citations";
import type {
  CitationClaim,
  ClaimVerificationStatus,
  CorpusEntry,
  GeneratedSection,
} from "@/lib/types";

export const maxDuration = 300;

/**
 * Stage 3 — Citation verification. For every pending claim, an independent
 * model call audits the claim against its cited source. This is the HARD GATE:
 * a section only advances to human review when every claim is verified —
 * fabricated citations (missing_source), stale sources, and unsupported claims
 * all block it. The database triggers enforce the same rule underneath.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { supabase, profile } = await requireTeamMember();

    const { data: run } = await supabase
      .from("pipeline_runs")
      .select("*")
      .eq("id", params.id)
      .single();
    if (!run) return jsonError("Pipeline run not found", 404);
    if (run.status === "cancelled" || run.stage === "completed") {
      return jsonError("Run is not active", 409);
    }
    if (!["citation_verification", "section_review", "drafting"].includes(run.stage)) {
      return jsonError(
        `Verification is not available at the ${run.stage} stage.`,
        409,
      );
    }

    const { data: sections } = await supabase
      .from("generated_sections")
      .select("*")
      .eq("pipeline_run_id", run.id)
      .in("status", ["drafted", "verifying", "verification_failed"])
      .order("sort_order");

    if (!sections || sections.length === 0) {
      return jsonError("No sections are awaiting verification.", 409);
    }

    await clearRunFailure(supabase, run.id);

    const summary: {
      section_key: string;
      verified: number;
      failed: number;
      gate_passed: boolean;
      reasons: string[];
    }[] = [];

    for (const section of sections as GeneratedSection[]) {
      await supabase
        .from("generated_sections")
        .update({ status: "verifying" })
        .eq("id", section.id);

      const { data: claims } = await supabase
        .from("citation_claims")
        .select("*")
        .eq("section_id", section.id);
      const allClaims = (claims ?? []) as CitationClaim[];

      // Claims that can be audited: pending ones with a real source attached.
      const pending = allClaims.filter(
        (c) => c.verification_status === "pending" && c.corpus_entry_id,
      );

      if (pending.length > 0) {
        const corpusIds = [...new Set(pending.map((c) => c.corpus_entry_id!))];
        const { data: corpus } = await supabase
          .from("corpus_entries")
          .select("*")
          .in("id", corpusIds);
        const corpusById = new Map(
          ((corpus ?? []) as CorpusEntry[]).map((c) => [c.id, c]),
        );

        const items = pending
          .filter((c) => corpusById.has(c.corpus_entry_id!))
          .map((c) => ({
            claim_id: c.id,
            claim_text: c.claim_text,
            source: corpusById.get(c.corpus_entry_id!)!,
          }));

        // A cited entry that vanished from the corpus between drafting and
        // verification is a hard failure, not a silent skip.
        for (const claim of pending) {
          if (!corpusById.has(claim.corpus_entry_id!)) {
            await supabase
              .from("citation_claims")
              .update({
                verification_status: "missing_source",
                verification_notes:
                  "The cited corpus entry no longer exists. Attach a valid source or remove the claim.",
              })
              .eq("id", claim.id);
          }
        }

        if (items.length > 0) {
          let result;
          try {
            result = await callClaudeJSON({
              system: verifySystemPrompt(),
              user: verifyUserPrompt(items),
              schema: verifyJsonSchema as unknown as Record<string, unknown>,
              validator: verifyValidator,
            });
          } catch (error) {
            await supabase
              .from("generated_sections")
              .update({ status: "drafted" })
              .eq("id", section.id);
            await recordRunFailure(
              supabase,
              run.id,
              "citation_verification",
              error,
            );
            throw error;
          }

          const verdictMap: Record<string, ClaimVerificationStatus> = {
            supported: "verified",
            partially_supported: "partially_supported",
            unsupported: "unsupported",
          };

          const knownIds = new Set(items.map((i) => i.claim_id));
          for (const r of result.data.results) {
            if (!knownIds.has(r.claim_id)) continue; // ignore hallucinated ids
            await supabase
              .from("citation_claims")
              .update({
                verification_status: verdictMap[r.verdict],
                verification_notes: r.reasoning,
                verified_at:
                  r.verdict === "supported" ? new Date().toISOString() : null,
              })
              .eq("id", r.claim_id);
          }

          // Any audited claim the model failed to return a verdict for stays
          // pending — the gate keeps it blocked rather than passing silently.
        }
      }

      // Re-read and evaluate the gate.
      const { data: finalClaims } = await supabase
        .from("citation_claims")
        .select("*")
        .eq("section_id", section.id);
      const evaluated = (finalClaims ?? []) as CitationClaim[];
      const passed = sectionGatePasses(evaluated);
      const failedCount = evaluated.filter(
        (c) => c.verification_status !== "verified",
      ).length;

      const verificationSummary = {
        verified: evaluated.length - failedCount,
        failed: failedCount,
        total: evaluated.length,
        completed_at: new Date().toISOString(),
      };

      if (passed) {
        // The DB trigger re-checks this transition; a bug here cannot push an
        // unverified section into review.
        const { error: gateError } = await supabase
          .from("generated_sections")
          .update({
            status: "awaiting_review",
            verification_summary: verificationSummary,
          })
          .eq("id", section.id);
        if (gateError) return jsonError(gateError.message, 409);

        // Open a section review checkpoint if none is pending.
        const { data: existing } = await supabase
          .from("review_checkpoints")
          .select("id")
          .eq("pipeline_run_id", run.id)
          .eq("section_id", section.id)
          .eq("status", "pending");
        if ((existing ?? []).length === 0) {
          await supabase.from("review_checkpoints").insert({
            pipeline_run_id: run.id,
            kind: "section_review",
            section_id: section.id,
            status: "pending",
          });
        }
      } else {
        await supabase
          .from("generated_sections")
          .update({
            status: "verification_failed",
            verification_summary: verificationSummary,
          })
          .eq("id", section.id);
      }

      const reasons = passed ? [] : gateFailureReasons(evaluated);
      summary.push({
        section_key: section.section_key,
        verified: verificationSummary.verified,
        failed: failedCount,
        gate_passed: passed,
        reasons,
      });

      await writeAudit(supabase, {
        actorId: profile.id,
        action: passed
          ? "generated_section.verification_passed"
          : "generated_section.verification_failed",
        entityType: "generated_section",
        entityId: section.id,
        pipelineRunId: run.id,
        detail: { section_key: section.section_key, ...verificationSummary, reasons },
      });
    }

    // The run reaches section_review only when every section cleared the gate.
    const { data: notReady } = await supabase
      .from("generated_sections")
      .select("id")
      .eq("pipeline_run_id", run.id)
      .not("status", "in", "(awaiting_review,approved,final)");

    if ((notReady ?? []).length === 0 && run.stage === "citation_verification") {
      await supabase
        .from("pipeline_runs")
        .update({ stage: "section_review" })
        .eq("id", run.id);
    }

    return NextResponse.json({ sections: summary });
  } catch (error) {
    return handleRouteError(error);
  }
}
