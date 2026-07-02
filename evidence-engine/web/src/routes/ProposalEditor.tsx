import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { draftSection, type DraftCitationInput } from "../lib/functions";
import type {
  Citation,
  Claim,
  Proposal,
  ProposalSection,
} from "../lib/types";
import EvidencePanel from "../components/EvidencePanel";
import CitationsExport from "../components/CitationsExport";

export default function ProposalEditor() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: prop }, { data: userRes }] = await Promise.all([
      supabase.from("proposals").select("*").eq("id", id).single(),
      supabase.auth.getUser(),
    ]);
    setProposal(prop as Proposal);

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userRes.user!.id)
      .single();
    setOrgId((profile as { org_id: string })?.org_id ?? "");

    const { data: secs } = await supabase
      .from("proposal_sections")
      .select("*")
      .eq("proposal_id", id)
      .order("position");
    const sectionList = (secs ?? []) as ProposalSection[];
    setSections(sectionList);

    const sectionIds = sectionList.map((s) => s.id);
    if (sectionIds.length) {
      const { data: cl } = await supabase
        .from("claims")
        .select("*")
        .in("section_id", sectionIds);
      const claimList = (cl ?? []) as Claim[];
      setClaims(claimList);

      const claimIds = claimList.map((c) => c.id);
      if (claimIds.length) {
        const { data: ci } = await supabase
          .from("citations")
          .select("*")
          .in("claim_id", claimIds);
        setCitations((ci ?? []) as Citation[]);
      } else {
        setCitations([]);
      }
    } else {
      setClaims([]);
      setCitations([]);
    }
  }, [id]);

  useEffect(() => {
    load().catch((e) => setErr(String(e)));
  }, [load]);

  const addSection = async () => {
    await supabase.from("proposal_sections").insert({
      proposal_id: id,
      org_id: orgId,
      heading: "New section",
      position: sections.length,
    });
    load();
  };

  if (!proposal) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-slate-500 hover:underline">
          ← All proposals
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{proposal.title}</h1>
        <p className="text-sm text-slate-500">
          {proposal.funder ?? "No funder"} · {proposal.status}
        </p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          orgId={orgId}
          claims={claims.filter((c) => c.section_id === section.id)}
          citations={citations}
          onChange={load}
        />
      ))}

      <button
        onClick={addSection}
        className="rounded border border-dashed px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
      >
        + Add section
      </button>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">Bibliography</h2>
        <CitationsExport citations={citations} />
      </section>
    </div>
  );
}

function SectionCard({
  section,
  orgId,
  claims,
  citations,
  onChange,
}: {
  section: ProposalSection;
  orgId: string;
  claims: Claim[];
  citations: Citation[];
  onChange: () => void;
}) {
  const [heading, setHeading] = useState(section.heading);
  const [body, setBody] = useState(section.body);
  const [newClaim, setNewClaim] = useState("");
  const [openClaim, setOpenClaim] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const claimIds = new Set(claims.map((c) => c.id));
  const sectionCitations = citations.filter((c) => claimIds.has(c.claim_id));

  const saveSection = async () => {
    await supabase
      .from("proposal_sections")
      .update({ heading, body })
      .eq("id", section.id);
    onChange();
  };

  const addClaim = async () => {
    if (!newClaim.trim()) return;
    await supabase.from("claims").insert({
      section_id: section.id,
      org_id: orgId,
      text: newClaim.trim(),
    });
    setNewClaim("");
    onChange();
  };

  const removeCitation = async (cid: string) => {
    await supabase.from("citations").delete().eq("id", cid);
    onChange();
  };

  const runDraft = async () => {
    setDrafting(true);
    setErr(null);
    setDraft(null);
    try {
      const usable = sectionCitations.filter(
        (c) => c.verdict !== "contradicts",
      );
      if (!usable.length) {
        setErr("Attach at least one non-contradicting citation first.");
        return;
      }
      const citationInputs: DraftCitationInput[] = usable.map((c) => ({
        id: c.id.slice(0, 8),
        title: c.title,
        authors: c.authors,
        year: c.year,
        abstract: c.abstract_snippet,
        verdict: c.verdict,
      }));
      const res = await draftSection({
        passage: body || heading,
        sectionContext: heading,
        claims: claims.map((c) => c.text),
        citations: citationInputs,
      });
      setDraft(res.draft_markdown);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDrafting(false);
    }
  };

  const applyDraft = async () => {
    if (draft == null) return;
    setBody(draft);
    await supabase
      .from("proposal_sections")
      .update({ body: draft })
      .eq("id", section.id);
    setDraft(null);
    onChange();
  };

  return (
    <section className="rounded-lg border bg-white p-4">
      <input
        className="mb-2 w-full rounded border px-3 py-2 font-medium"
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        onBlur={saveSection}
      />
      <textarea
        className="min-h-[120px] w-full rounded border px-3 py-2 text-sm"
        placeholder="Write the section narrative here. Use [id] markers to cite."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={saveSection}
      />

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Claims &amp; evidence
          </h3>
          <button
            onClick={runDraft}
            disabled={drafting}
            className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {drafting ? "Drafting…" : "Draft with evidence"}
          </button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}

        <div className="mb-2 flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-1.5 text-sm"
            placeholder="Add a claim to support (e.g. 'art therapy reduces PTSD symptoms in veterans')"
            value={newClaim}
            onChange={(e) => setNewClaim(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addClaim()}
          />
          <button
            onClick={addClaim}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Add
          </button>
        </div>

        <ul className="space-y-2">
          {claims.map((claim) => {
            const claimCites = sectionCitations.filter(
              (c) => c.claim_id === claim.id,
            );
            return (
              <li key={claim.id} className="rounded border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {claim.text}{" "}
                    <span className="text-xs text-slate-400">
                      ({claim.status})
                    </span>
                  </span>
                  <button
                    onClick={() =>
                      setOpenClaim(openClaim === claim.id ? null : claim.id)
                    }
                    className="text-xs text-slate-500 underline"
                  >
                    {openClaim === claim.id ? "Hide" : "Evidence"}
                  </button>
                </div>

                {claimCites.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {claimCites.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between text-xs text-slate-600"
                      >
                        <span>
                          <span className="font-mono text-slate-400">
                            [{c.id.slice(0, 8)}]
                          </span>{" "}
                          {c.title}
                          {c.verdict && (
                            <span className="ml-1 text-slate-400">
                              · {c.verdict}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => removeCitation(c.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {openClaim === claim.id && (
                  <EvidencePanel
                    claim={claim}
                    orgId={orgId}
                    onAttached={onChange}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {draft != null && (
        <div className="mt-3 rounded border border-indigo-200 bg-indigo-50 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700">
              Suggested draft
            </span>
            <div className="flex gap-2">
              <button
                onClick={applyDraft}
                className="rounded bg-indigo-600 px-2 py-0.5 text-xs text-white hover:bg-indigo-500"
              >
                Apply to section
              </button>
              <button
                onClick={() => setDraft(null)}
                className="rounded border px-2 py-0.5 text-xs hover:bg-white"
              >
                Discard
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-slate-800">
            {draft}
          </pre>
        </div>
      )}
    </section>
  );
}
