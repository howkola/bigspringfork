import { useState, useMemo, useCallback } from "react";
import type { Citation, SectionDef } from "../../shared/types";
import { ANCHOR_LIBRARY, SECTION_DEFS, DEFAULT_REQUEST } from "../../shared/anchors";
import { stripFences } from "../../shared/parse";
import { runConsensus, generateSection } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";
import { buildFullMarkdown } from "../lib/exportPacket";
import { SectionHead } from "./SectionHead";
import { CSS } from "../styles";

/* ============================================================
   EVIDENCE-TO-PROPOSAL RESEARCH ENGINE — Project Harmony CAC
   Live build (Phase 1): retrieval + synthesis run server-side through
   Netlify Functions; the Anthropic key never reaches the browser.
   ============================================================ */

type Stage = "idle" | "consensus" | "synthesis" | "done" | "error";

export default function EvidenceToProposalEngine() {
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [stage, setStage] = useState<Stage>("idle");
  const [stageNote, setStageNote] = useState("");
  const [sections, setSections] = useState<Record<string, string> | null>(null);
  const [consensusCitations, setConsensusCitations] = useState<Citation[]>([]);
  const [consensusRaw, setConsensusRaw] = useState("");
  const [consensusFailed, setConsensusFailed] = useState(false);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState("needStatement");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [regenKey, setRegenKey] = useState("");
  const [sectionFailures, setSectionFailures] = useState<string[]>([]);

  const allCitations = useMemo<Citation[]>(
    () => [...ANCHOR_LIBRARY, ...consensusCitations],
    [consensusCitations]
  );
  const citationMap = useMemo<Record<string, Citation>>(() => {
    const m: Record<string, Citation> = {};
    allCitations.forEach((c) => (m[c.id] = c));
    return m;
  }, [allCitations]);

  const usedCitations = useMemo<Citation[]>(() => {
    if (!sections) return allCitations;
    const text = Object.values(sections).join(" ");
    return allCitations.filter((c) => text.includes(`[${c.id}]`));
  }, [sections, allCitations]);

  const copy = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const TRUNCATION_WARNING =
    "\n\n> ⚠ Output reached the token limit and may be incomplete — use Regenerate on this section.";

  /* ----- Stage 1: Consensus retrieval (streamed status) ----- */
  async function doConsensus(): Promise<Citation[]> {
    setStage("consensus");
    setStageNote("Searching peer-reviewed literature via Consensus…");
    try {
      const res = await runConsensus(request, { onStatus: setStageNote });
      setConsensusRaw(res.raw || "");
      setConsensusFailed(res.failed);
      setConsensusCitations(res.citations);
      return res.citations;
    } catch (e) {
      console.error("Consensus stage failed:", e);
      setConsensusFailed(true);
      setConsensusCitations([]);
      return [];
    }
  }

  /* ----- Stage 2: Synthesis — one streamed server call per section ----- */
  async function doSynthesis(cites: Citation[]) {
    setStage("synthesis");
    const defs = SECTION_DEFS.filter((s) => s.key !== "citationPacket");
    const failures: string[] = [];
    setSections({});
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      setActive(def.key); // watch each section draft live
      const base = `Drafting ${def.num} · ${def.label} (${i + 1} of ${defs.length})`;
      setStageNote(`${base}…`);
      try {
        const res = await generateSection(request, def.key, cites, {
          onStatus: (phase) =>
            setStageNote(`${base} — ${phase === "thinking" ? "Reasoning…" : "Writing…"}`),
          onDelta: (acc) =>
            setSections((s) => ({ ...(s || {}), [def.key]: stripFences(acc) })),
        });
        const text = stripFences(res.text) + (res.truncated ? TRUNCATION_WARNING : "");
        setSections((s) => ({ ...(s || {}), [def.key]: text }));
      } catch (e) {
        console.error(`Section ${def.key} failed:`, e);
        failures.push(def.label);
        setSections((s) => ({
          ...(s || {}),
          [def.key]: `> ⚠ This section failed to generate (${String(
            (e as Error).message || e
          ).slice(0, 120)}). Use Regenerate above to retry just this section.`,
        }));
      }
    }
    if (failures.length === defs.length) throw new Error("All sections failed to generate");
    setSectionFailures(failures);
  }

  /* Regenerate a single section without re-running the pipeline (streamed live) */
  async function regenSection(def: SectionDef) {
    if (regenKey) return;
    setRegenKey(def.key);
    try {
      const res = await generateSection(request, def.key, consensusCitations, {
        onDelta: (acc) =>
          setSections((s) => ({ ...(s || {}), [def.key]: stripFences(acc) })),
      });
      const text = stripFences(res.text) + (res.truncated ? TRUNCATION_WARNING : "");
      setSections((s) => ({ ...(s || {}), [def.key]: text }));
      setReviewed((r) => ({ ...r, [def.key]: false }));
    } catch (e) {
      setSections((s) => ({
        ...(s || {}),
        [def.key]: `> ⚠ Regeneration failed (${String(
          (e as Error).message || e
        ).slice(0, 120)}). Try again.`,
      }));
    } finally {
      setRegenKey("");
    }
  }

  async function runPipeline() {
    setError("");
    setSections(null);
    setVerified({});
    setReviewed({});
    setSectionFailures([]);
    try {
      const cites = await doConsensus();
      await doSynthesis(cites);
      setStage("done");
      setStageNote("");
      setActive("needStatement");
    } catch (e) {
      console.error(e);
      setError(String((e as Error).message || e));
      setStage("error");
    }
  }

  const unverifiedCount = usedCitations.filter((c) => !verified[c.id]).length;
  const reviewedCount = SECTION_DEFS.filter((s) => reviewed[s.key]).length;

  function exportPacket() {
    const md = buildFullMarkdown(request, sections || {}, usedCitations, verified);
    copy("packet", md);
  }
  function downloadPacket() {
    const md = buildFullMarkdown(request, sections || {}, usedCitations, verified);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evidence-to-proposal-packet.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const onCiteClick = () => setActive("citationPacket");
  const working = stage === "consensus" || stage === "synthesis";

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* ---------- Masthead ---------- */}
      <header className="masthead">
        <div className="mast-rule" />
        <div className="mast-row">
          <div>
            <div className="kicker">Project Harmony · Grants Strategy Desk</div>
            <h1 className="title">
              Evidence-to-Proposal
              <br />
              Research Engine
            </h1>
          </div>
          <div className="mast-meta">
            <div className="meta-line">
              <span>Anchor</span> OJJDP Model Programs Guide — CAC Literature Review
            </div>
            <div className="meta-line">
              <span>Retrieval</span> Consensus (peer-reviewed)
            </div>
            <div className="meta-line">
              <span>Guardrail</span> Closed-corpus citations · human review gate
            </div>
          </div>
        </div>
        <div className="mast-rule heavy" />
      </header>

      {/* ---------- Brief / input ---------- */}
      <section className="brief">
        <label className="brief-label">Funding request under development</label>
        <textarea
          className="brief-input"
          rows={3}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
        />
        <div className="brief-actions">
          <button
            className="btn primary"
            disabled={working || !request.trim()}
            onClick={runPipeline}
          >
            {working ? "Working…" : sections ? "Rebuild evidence packet" : "Build evidence packet"}
          </button>
          {sections && (
            <>
              <button className="btn" onClick={exportPacket}>
                {copied === "packet" ? "Copied ✓" : "Copy full packet (.md)"}
              </button>
              <button className="btn" onClick={downloadPacket}>
                Download .md
              </button>
            </>
          )}
        </div>

        {/* pipeline status */}
        {working && (
          <div className="pipeline">
            <div className={`pstep ${stage === "consensus" ? "live" : "done"}`}>
              1 · Consensus retrieval
            </div>
            <div className={`pstep ${stage === "synthesis" ? "live" : ""}`}>2 · Cited synthesis</div>
            <div className="pstep">3 · Human review</div>
            <div className="pnote">{stageNote}</div>
          </div>
        )}
        {consensusFailed && stage !== "error" && (
          <div className="notice warn">
            Consensus retrieval was unavailable this run — the packet was built from the anchor
            library only. Re-run later to enrich with fresh peer-reviewed sources.
          </div>
        )}
        {sectionFailures.length > 0 && stage === "done" && (
          <div className="notice warn">
            {sectionFailures.length} section(s) failed during drafting ({sectionFailures.join(", ")})
            — open each and use Regenerate to retry just that section. Everything else completed
            normally.
          </div>
        )}
        {stage === "error" && (
          <div className="notice error">
            Pipeline error: {error}. Each section generates independently, so a single failure can't
            take down the whole packet — try again.
          </div>
        )}
      </section>

      {/* ---------- Output ---------- */}
      {sections && (
        <div className="layout">
          <nav className="toc">
            <div className="toc-head">Packet contents</div>
            {SECTION_DEFS.map((s) => (
              <button
                key={s.key}
                className={`toc-item ${active === s.key ? "active" : ""}`}
                onClick={() => setActive(s.key)}
              >
                <span className="toc-num">{s.num}</span>
                <span className="toc-label">{s.label}</span>
                <span className={`dot ${reviewed[s.key] ? "ok" : ""}`} />
              </button>
            ))}
            <div className="toc-foot">
              <div>{reviewedCount}/10 sections reviewed</div>
              <div className={unverifiedCount ? "warn-text" : "ok-text"}>
                {unverifiedCount ? `${unverifiedCount} citation(s) to verify` : "All citations verified"}
              </div>
            </div>
          </nav>

          <main className="content">
            {SECTION_DEFS.map((s) => {
              if (s.key !== active) return null;
              if (s.key === "citationPacket") {
                return (
                  <article key={s.key} className="card">
                    <SectionHead
                      def={s}
                      reviewed={!!reviewed[s.key]}
                      onReview={() => setReviewed((r) => ({ ...r, [s.key]: !r[s.key] }))}
                      onCopy={() =>
                        copy(
                          s.key,
                          usedCitations
                            .map(
                              (c) => `[${c.id}] ${c.authors} (${c.year}). ${c.title}. ${c.source}.`
                            )
                            .join("\n")
                        )
                      }
                      copied={copied === s.key}
                    />
                    <p className="md-p muted">
                      Sources actually cited in this packet. Confirm every entry against the original
                      publication before submission — badges indicate provenance, not final
                      verification.
                    </p>
                    {usedCitations.map((c) => (
                      <div key={c.id} className="cite-row">
                        <div className="cite-id">[{c.id}]</div>
                        <div className="cite-body">
                          <div className="cite-title">{c.title}</div>
                          <div className="cite-meta">
                            {c.authors} ({c.year}) · {c.source}
                          </div>
                          <div className="cite-finding">{c.finding}</div>
                        </div>
                        <div className="cite-side">
                          <span className={`badge ${c.badge}`}>
                            {c.badge === "anchor" ? "Anchor library" : "Consensus"}
                          </span>
                          <label className="verify">
                            <input
                              type="checkbox"
                              checked={!!verified[c.id]}
                              onChange={() => setVerified((v) => ({ ...v, [c.id]: !v[c.id] }))}
                            />
                            Verified
                          </label>
                        </div>
                      </div>
                    ))}
                    {consensusRaw && (
                      <details className="raw">
                        <summary>Raw Consensus retrieval (audit trail)</summary>
                        <pre>{consensusRaw.slice(0, 6000)}</pre>
                      </details>
                    )}
                  </article>
                );
              }
              return (
                <article key={s.key} className="card">
                  <SectionHead
                    def={s}
                    reviewed={!!reviewed[s.key]}
                    onReview={() => setReviewed((r) => ({ ...r, [s.key]: !r[s.key] }))}
                    onCopy={() => copy(s.key, (sections && sections[s.key]) || "")}
                    copied={copied === s.key}
                    onRegen={() => regenSection(s)}
                    regenerating={regenKey === s.key}
                  />
                  <div className="prose">
                    {sections[s.key] ? (
                      renderMarkdown(sections[s.key], citationMap, onCiteClick)
                    ) : (
                      <p className="md-p muted">
                        {regenKey === s.key
                          ? "Regenerating…"
                          : "Drafting… this section is in the queue."}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </main>
        </div>
      )}

      {!sections && stage === "idle" && (
        <section className="empty">
          <div className="empty-num">§</div>
          <p>
            Enter the funding request above and build the packet. The engine retrieves peer-reviewed
            evidence through Consensus, anchors it to the OJJDP Model Programs Guide CAC literature
            review, and drafts all ten sections with closed-corpus citations — nothing is cited that
            wasn't retrieved or seeded.
          </p>
        </section>
      )}

      <footer className="foot">
        Drafting aid only. All citations, statistics, and {"{{LOCAL}}"} placeholders must be
        human-verified before any submission. Never include identifying case details in narratives.
      </footer>
    </div>
  );
}
