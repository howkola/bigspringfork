import { useState } from "react";
import { researchSearch, verifyCitation } from "../lib/functions";
import { supabase } from "../lib/supabase";
import type { Claim, Paper, Verdict } from "../lib/types";

const verdictColor: Record<Verdict, string> = {
  supports: "bg-green-100 text-green-800",
  weak: "bg-amber-100 text-amber-800",
  contradicts: "bg-red-100 text-red-800",
};

interface Props {
  claim: Claim;
  orgId: string;
  onAttached: () => void;
}

export default function EvidencePanel({ claim, orgId, onAttached }: Props) {
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<
    Record<string, { verdict: Verdict; rationale: string } | "loading">
  >({});

  const search = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { papers } = await researchSearch(claim.text);
      setPapers(papers);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (p: Paper) => {
    if (!p.abstract) return;
    setVerdicts((v) => ({ ...v, [p.openalex_id]: "loading" }));
    try {
      const res = await verifyCitation(claim.text, p.abstract, p.title);
      setVerdicts((v) => ({ ...v, [p.openalex_id]: res }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setVerdicts((v) => {
        const next = { ...v };
        delete next[p.openalex_id];
        return next;
      });
    }
  };

  const attach = async (p: Paper) => {
    const v = verdicts[p.openalex_id];
    const verdict = v && v !== "loading" ? v.verdict : null;
    const { error } = await supabase.from("citations").insert({
      claim_id: claim.id,
      org_id: orgId,
      title: p.title,
      authors: p.authors,
      year: p.year,
      venue: p.venue,
      doi: p.doi,
      url: p.url,
      abstract_snippet: p.abstract?.slice(0, 600) ?? null,
      relevance: p.relevance,
      verdict,
      verdict_rationale: v && v !== "loading" ? v.rationale : null,
      openalex_id: p.openalex_id,
    });
    if (error) setErr(error.message);
    else {
      // Mark the claim supported if we attached a supporting citation.
      if (verdict === "supports") {
        await supabase
          .from("claims")
          .update({ status: "supported" })
          .eq("id", claim.id);
      }
      onAttached();
    }
  };

  return (
    <div className="mt-2 rounded border bg-slate-50 p-3">
      <button
        onClick={search}
        disabled={busy}
        className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
      >
        {busy ? "Searching…" : "Find evidence"}
      </button>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

      {papers && papers.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">No papers found.</p>
      )}

      {papers && papers.length > 0 && (
        <ul className="mt-3 space-y-2">
          {papers.map((p) => {
            const v = verdicts[p.openalex_id];
            return (
              <li key={p.openalex_id} className="rounded border bg-white p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <a
                      href={p.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-slate-800 hover:underline"
                    >
                      {p.title}
                    </a>
                    <div className="text-xs text-slate-500">
                      {p.authors} {p.year ? `· ${p.year}` : ""}{" "}
                      {p.venue ? `· ${p.venue}` : ""} · {p.cited_by_count} cites
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => verify(p)}
                      disabled={!p.abstract || v === "loading"}
                      className="rounded border px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-40"
                      title={p.abstract ? "Verify support" : "No abstract"}
                    >
                      {v === "loading" ? "…" : "Verify"}
                    </button>
                    <button
                      onClick={() => attach(p)}
                      className="rounded bg-slate-800 px-2 py-0.5 text-xs text-white hover:bg-slate-700"
                    >
                      Attach
                    </button>
                  </div>
                </div>
                {v && v !== "loading" && (
                  <div className="mt-1">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${verdictColor[v.verdict]}`}
                    >
                      {v.verdict}
                    </span>
                    <span className="ml-2 text-xs text-slate-600">
                      {v.rationale}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
