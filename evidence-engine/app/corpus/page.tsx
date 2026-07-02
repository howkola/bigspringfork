import { requireTeamPage } from "@/lib/page-auth";
import CorpusForm from "@/components/CorpusForm";
import ActionButton from "@/components/ActionButton";
import { ConfidenceBadge, FreshnessBadge } from "@/components/badges";
import type { CorpusEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CorpusPage() {
  const { supabase } = await requireTeamPage();

  const { data } = await supabase
    .from("corpus_entries")
    .select("*")
    .eq("is_archived", false)
    .order("stale_after");
  const entries = (data ?? []) as CorpusEntry[];
  const staleCount = entries.filter(
    (e) => new Date(e.stale_after).getTime() <= Date.now(),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Citation corpus</h1>
          <p className="text-sm text-stone-500">
            {entries.length} entries · {staleCount} stale. Only fresh entries
            are offered to the drafting model.
          </p>
        </div>
        <ActionButton
          label="Run freshness sweep"
          url="/api/freshness"
          variant="secondary"
          pendingLabel="Sweeping…"
        />
      </div>
      <CorpusForm />

      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">{entry.title}</h2>
                <p className="text-xs text-stone-500">
                  {[
                    entry.authors,
                    entry.publication,
                    entry.publication_year,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {entry.url && (
                    <>
                      {" · "}
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        source link
                      </a>
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <FreshnessBadge staleAfter={entry.stale_after} />
                <ConfidenceBadge level={entry.confidence} />
              </div>
            </div>
            <p className="mt-2 text-sm text-stone-600">{entry.summary}</p>
            {entry.key_findings.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-stone-600">
                {entry.key_findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ActionButton
                label="Mark re-verified (12 mo)"
                url={`/api/corpus/${entry.id}/verify`}
                body={{ freshness_months: 12 }}
                variant="secondary"
                pendingLabel="Verifying…"
              />
              <ActionButton
                label="Archive"
                url={`/api/corpus/${entry.id}`}
                method="DELETE"
                variant="danger"
                confirmMessage="Archive this corpus entry? It will no longer be offered as evidence for new drafts."
              />
              {entry.tags.length > 0 && (
                <span className="text-xs text-stone-400">
                  {entry.tags.map((t) => `#${t}`).join(" ")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
