import { notFound } from "next/navigation";
import { requireTeamPage } from "@/lib/page-auth";
import ActionButton from "@/components/ActionButton";
import ReviewDecision from "@/components/ReviewDecision";
import SectionEditor from "@/components/SectionEditor";
import {
  ClaimStatusBadge,
  SectionStatusBadge,
  StageBadge,
} from "@/components/badges";
import { STAGE_ORDER, stageIndex, stageLabel } from "@/lib/pipeline/stages";
import type {
  CitationClaim,
  CorpusEntry,
  GeneratedSection,
  GrantOpportunity,
  PipelineRun,
  ReviewCheckpoint,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type SectionWithClaims = GeneratedSection & { citation_claims: CitationClaim[] };

export default async function RunPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireTeamPage();

  const { data: runRow } = await supabase
    .from("pipeline_runs")
    .select("*, grant_opportunities(*)")
    .eq("id", params.id)
    .single();
  if (!runRow) notFound();

  const run = runRow as PipelineRun & { grant_opportunities: GrantOpportunity };
  const grant = run.grant_opportunities;

  const [{ data: sectionRows }, { data: checkpointRows }] = await Promise.all([
    supabase
      .from("generated_sections")
      .select("*, citation_claims(*)")
      .eq("pipeline_run_id", run.id)
      .order("sort_order"),
    supabase
      .from("review_checkpoints")
      .select("*")
      .eq("pipeline_run_id", run.id)
      .order("created_at", { ascending: false }),
  ]);

  const sections = (sectionRows ?? []) as SectionWithClaims[];
  const checkpoints = (checkpointRows ?? []) as ReviewCheckpoint[];

  // Corpus titles for citation display.
  const citedIds = [
    ...new Set(
      sections
        .flatMap((s) => s.citation_claims)
        .map((c) => c.corpus_entry_id)
        .filter(Boolean),
    ),
  ] as string[];
  const { data: corpusRows } = citedIds.length
    ? await supabase
        .from("corpus_entries")
        .select("id, title, stale_after")
        .in("id", citedIds)
    : { data: [] };
  const corpusById = new Map(
    ((corpusRows ?? []) as Pick<CorpusEntry, "id" | "title" | "stale_after">[]).map(
      (c) => [c.id, c],
    ),
  );

  const pendingIntake = checkpoints.find(
    (c) => c.kind === "intake_review" && c.status === "pending",
  );
  const pendingFinal = checkpoints.find(
    (c) => c.kind === "final_review" && c.status === "pending",
  );
  const pendingBySection = new Map(
    checkpoints
      .filter((c) => c.kind === "section_review" && c.status === "pending")
      .map((c) => [c.section_id!, c]),
  );

  const allApproved =
    sections.length > 0 &&
    sections.every((s) => ["approved", "final"].includes(s.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{grant.title}</h1>
          <StageBadge stage={run.stage} />
          {run.status !== "active" && (
            <span className="text-sm text-stone-500">({run.status})</span>
          )}
        </div>
        <p className="text-sm text-stone-500">
          {grant.funder}
          {grant.deadline && ` · deadline ${grant.deadline}`}
        </p>
      </div>

      {/* Stage progress */}
      <ol className="flex flex-wrap gap-1 text-xs">
        {STAGE_ORDER.map((stage, i) => {
          const current = stageIndex(run.stage);
          const state =
            i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li
              key={stage}
              className={`rounded px-2 py-1 ${
                state === "done"
                  ? "bg-emerald-100 text-emerald-800"
                  : state === "current"
                    ? "bg-indigo-600 text-white"
                    : "bg-stone-200 text-stone-500"
              }`}
            >
              {i + 1}. {stageLabel(stage)}
            </li>
          );
        })}
      </ol>

      {/* Failure banner */}
      {run.status === "failed" && run.last_error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="font-medium text-red-900">
            Pipeline failed at {run.failed_stage ?? run.last_error.stage}
          </p>
          <p className="mt-1 text-sm text-red-800">{run.last_error.message}</p>
          <p className="mt-1 text-xs text-red-700">
            {run.last_error.retryable
              ? "This looks transient — re-run the stage below to resume where it stopped."
              : "Fix the underlying problem (corpus, configuration, or inputs), then re-run the stage."}
          </p>
        </div>
      )}

      {run.status === "cancelled" && (
        <p className="rounded-lg border border-stone-300 bg-stone-50 p-3 text-sm text-stone-600">
          This run was cancelled.
        </p>
      )}

      {/* Stage actions */}
      {run.status !== "cancelled" && run.stage !== "completed" && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          {(run.stage === "intake" ||
            (run.status === "failed" && run.failed_stage === "intake")) && (
            <ActionButton
              label="Run intake analysis"
              url={`/api/runs/${run.id}/intake`}
              pendingLabel="Analyzing grant against corpus… (may take a minute)"
            />
          )}
          {["drafting", "citation_verification", "section_review"].includes(
            run.stage,
          ) &&
            sections.some((s) =>
              ["planned", "changes_requested", "verification_failed"].includes(
                s.status,
              ),
            ) && (
              <ActionButton
                label="Draft outstanding sections"
                url={`/api/runs/${run.id}/draft`}
                pendingLabel="Drafting sections… (one model call per section)"
              />
            )}
          {sections.some((s) =>
            ["drafted", "verification_failed"].includes(s.status),
          ) && (
            <ActionButton
              label="Run citation verification"
              url={`/api/runs/${run.id}/verify`}
              pendingLabel="Auditing every claim against its source…"
            />
          )}
          {["section_review", "assembly"].includes(run.stage) && allApproved && (
            <ActionButton
              label="Assemble final proposal"
              url={`/api/runs/${run.id}/assemble`}
              pendingLabel="Assembling document + executive summary…"
            />
          )}
          <span className="grow" />
          <ActionButton
            label="Cancel run"
            url={`/api/runs/${run.id}`}
            method="DELETE"
            variant="danger"
            confirmMessage="Cancel this pipeline run? This cannot be undone."
          />
        </div>
      )}

      {/* Intake analysis + checkpoint */}
      {run.intake_analysis && (
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Intake analysis — fit score {run.intake_analysis.fit_score}/10
            </h2>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
            {run.intake_analysis.fit_assessment}
          </p>
          {run.intake_analysis.risks_and_gaps.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-medium text-stone-700">
                Risks & gaps
              </h3>
              <ul className="mt-1 list-inside list-disc text-sm text-stone-600">
                {run.intake_analysis.risks_and_gaps.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {pendingIntake && (
            <ReviewDecision
              runId={run.id}
              checkpointId={pendingIntake.id}
              allowChangesRequested={false}
            />
          )}
        </div>
      )}

      {/* Sections */}
      {sections.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold">
            Sections ({sections.filter((s) => ["approved", "final"].includes(s.status)).length}/{sections.length} approved)
          </h2>
          {sections.map((section) => {
            const claims = section.citation_claims ?? [];
            const failedClaims = claims.filter(
              (c) => c.verification_status !== "verified",
            );
            const checkpoint = pendingBySection.get(section.id);
            return (
              <div
                key={section.id}
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">
                    {section.sort_order + 1}. {section.title}
                    {section.word_limit && (
                      <span className="ml-2 text-xs text-stone-400">
                        limit {section.word_limit} words
                      </span>
                    )}
                  </h3>
                  <SectionStatusBadge status={section.status} />
                </div>

                {section.status === "planned" && section.drafting_guidance && (
                  <p className="mt-2 text-sm text-stone-500">
                    <span className="font-medium">Plan:</span>{" "}
                    {section.drafting_guidance}
                  </p>
                )}

                {section.current_content && (
                  <div className="mt-3 whitespace-pre-wrap rounded bg-stone-50 p-3 text-sm text-stone-800">
                    {section.current_content}
                  </div>
                )}

                {/* Verification summary */}
                {section.verification_summary && (
                  <p className="mt-2 text-xs text-stone-500">
                    Verification: {section.verification_summary.verified}/
                    {section.verification_summary.total} claims verified
                    {section.verification_summary.failed > 0 &&
                      ` — ${section.verification_summary.failed} blocked by the citation gate`}
                  </p>
                )}

                {/* Claims table */}
                {claims.length > 0 && (
                  <details className="mt-2" open={failedClaims.length > 0}>
                    <summary className="cursor-pointer text-sm font-medium text-stone-600">
                      Citation claims ({claims.length})
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {claims
                        .sort((a, b) =>
                          a.citation_marker.localeCompare(b.citation_marker, undefined, { numeric: true }),
                        )
                        .map((claim) => {
                          const source = claim.corpus_entry_id
                            ? corpusById.get(claim.corpus_entry_id)
                            : null;
                          return (
                            <li
                              key={claim.id}
                              className="rounded border border-stone-200 p-2 text-sm"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs text-stone-500">
                                  {claim.citation_marker}
                                </span>
                                <ClaimStatusBadge
                                  status={claim.verification_status}
                                />
                                {source && (
                                  <span className="text-xs text-stone-500">
                                    → {source.title}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-stone-700">
                                “{claim.claim_text}”
                              </p>
                              {claim.verification_notes && (
                                <p className="mt-1 text-xs text-stone-500">
                                  {claim.verification_notes}
                                </p>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  </details>
                )}

                {/* Per-section actions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {["drafted", "verification_failed", "awaiting_review", "changes_requested", "approved"].includes(section.status) &&
                    section.current_content && (
                      <SectionEditor
                        runId={run.id}
                        sectionId={section.id}
                        initialContent={section.current_content}
                      />
                    )}
                  {["verification_failed", "changes_requested"].includes(
                    section.status,
                  ) && (
                    <ActionButton
                      label="Redraft this section"
                      url={`/api/runs/${run.id}/draft`}
                      body={{ section_id: section.id }}
                      variant="secondary"
                      pendingLabel="Redrafting…"
                    />
                  )}
                </div>

                {checkpoint && (
                  <ReviewDecision runId={run.id} checkpointId={checkpoint.id} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assembled document + final review */}
      {run.assembled_document && (
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Assembled proposal</h2>
          {run.executive_summary && (
            <>
              <h3 className="mt-3 text-sm font-medium text-stone-700">
                Executive summary
              </h3>
              <p className="mt-1 whitespace-pre-wrap rounded bg-stone-50 p-3 text-sm text-stone-800">
                {run.executive_summary}
              </p>
            </>
          )}
          <h3 className="mt-3 text-sm font-medium text-stone-700">
            Full document
          </h3>
          <pre className="mt-1 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded bg-stone-50 p-3 font-sans text-sm text-stone-800">
            {run.assembled_document}
          </pre>
          {pendingFinal && (
            <ReviewDecision
              runId={run.id}
              checkpointId={pendingFinal.id}
              allowChangesRequested={false}
            />
          )}
        </div>
      )}

      {/* Checkpoint history */}
      {checkpoints.length > 0 && (
        <details className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer font-semibold">
            Checkpoint history ({checkpoints.length})
          </summary>
          <ul className="mt-2 space-y-1 text-sm text-stone-600">
            {checkpoints.map((cp) => (
              <li key={cp.id}>
                <span className="font-medium">{cp.kind}</span> — {cp.status}
                {cp.decided_at &&
                  ` on ${new Date(cp.decided_at).toLocaleString()}`}
                {cp.notes && ` · “${cp.notes}”`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
