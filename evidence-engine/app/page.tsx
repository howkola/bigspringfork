import Link from "next/link";
import { requireTeamPage } from "@/lib/page-auth";
import { StageBadge } from "@/components/badges";
import ActionButton from "@/components/ActionButton";
import type { GrantOpportunity, PipelineRun } from "@/lib/types";

export const dynamic = "force-dynamic";

type RunWithGrant = PipelineRun & {
  grant_opportunities: Pick<GrantOpportunity, "funder" | "title" | "deadline">;
};

export default async function DashboardPage() {
  const { supabase } = await requireTeamPage();

  const [{ data: runs }, { data: staleEntries }] = await Promise.all([
    supabase
      .from("pipeline_runs")
      .select("*, grant_opportunities(funder, title, deadline)")
      .order("created_at", { ascending: false }),
    supabase
      .from("corpus_entries")
      .select("id, title")
      .eq("is_archived", false)
      .lte("stale_after", new Date().toISOString()),
  ]);

  const runList = (runs ?? []) as RunWithGrant[];
  const stale = staleEntries ?? [];

  return (
    <div className="space-y-6">
      {stale.length > 0 && (
        <div className="flex items-start justify-between rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <div>
            <p className="font-medium text-yellow-900">
              Freshness monitor: {stale.length} corpus{" "}
              {stale.length === 1 ? "entry has" : "entries have"} gone stale
            </p>
            <p className="text-sm text-yellow-800">
              Stale sources are excluded from new drafts. Run a sweep to flag
              citations in active runs, then re-verify the sources in the{" "}
              <Link href="/corpus" className="underline">corpus</Link>.
            </p>
          </div>
          <ActionButton
            label="Run freshness sweep"
            url="/api/freshness"
            variant="secondary"
            pendingLabel="Sweeping…"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pipeline runs</h1>
        <Link
          href="/grants"
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Start a run from a grant →
        </Link>
      </div>

      {runList.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
          No runs yet. Add a grant opportunity, then start a run from the
          Grants page.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-2">Grant</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {runList.map((run) => (
                <tr key={run.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {run.grant_opportunities?.title}
                    </div>
                    <div className="text-xs text-stone-500">
                      {run.grant_opportunities?.funder}
                      {run.grant_opportunities?.deadline &&
                        ` · deadline ${run.grant_opportunities.deadline}`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={run.stage} />
                  </td>
                  <td className="px-4 py-3">
                    {run.status === "failed" ? (
                      <span className="text-xs font-medium text-red-600">
                        Failed at {run.failed_stage} — open run to retry
                      </span>
                    ) : (
                      <span className="text-xs text-stone-500">{run.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {new Date(run.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/runs/${run.id}`}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
