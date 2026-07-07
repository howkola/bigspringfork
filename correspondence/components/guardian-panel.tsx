"use client";

// "Send to Guardian" + severity-tagged findings cards.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GuardianFinding, GuardianReview } from "@/lib/types";

const SEVERITY_STYLES: Record<GuardianFinding["severity"], string> = {
  blocker: "border-seal bg-seal/10 text-seal",
  warning: "border-sepia bg-sepia/10 text-ink-soft",
  note: "border-paper-deep bg-white/40 text-ink-faint",
};

export function FindingsCards({ findings }: { findings: GuardianFinding[] }) {
  if (!findings.length) {
    return <p className="text-sm italic text-ink-faint">Nothing found. The Guardian withholds applause on principle.</p>;
  }
  return (
    <ul className="space-y-2">
      {findings.map((f, i) => (
        <li key={i} className={`rounded border p-3 ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.note}`}>
          <div className="flex items-center gap-2">
            <span className="pill border-current">{f.severity}</span>
            <span className="font-mono text-[11px] uppercase tracking-wider">{f.category}</span>
          </div>
          {f.excerpt && <blockquote className="mt-2 border-l-2 border-current pl-2 font-display italic">“{f.excerpt}”</blockquote>}
          <p className="mt-2 text-sm text-ink">{f.explanation}</p>
          {f.suggestion && <p className="mt-1 text-sm text-ink-soft">Suggestion: {f.suggestion}</p>}
        </li>
      ))}
    </ul>
  );
}

export function GuardianPanel({
  letterId, draftVersions, latest,
}: {
  letterId: string;
  draftVersions: number[];
  latest: GuardianReview | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string>("");

  async function review() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/guardian/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letter_id: letterId,
          draft_version: version ? Number(version) : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `review failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3">
        <span className="chrome-label">Guardian</span>
        <select className="input w-auto" value={version} onChange={(e) => setVersion(e.target.value)}>
          <option value="">fair copy / final text</option>
          {draftVersions.map((v) => (
            <option key={v} value={v}>draft v{v}</option>
          ))}
        </select>
        <button className="btn btn-seal" onClick={review} disabled={busy}>
          {busy ? "Reviewing…" : "Send to Guardian"}
        </button>
        <span className="text-xs text-ink-faint">Review only. It never writes a word of him.</span>
      </div>
      {error && <p className="mt-2 text-sm text-seal">{error}</p>}
      {latest && (
        <div className="mt-4">
          <div className="chrome-label">
            latest review · {new Date(latest.created_at).toLocaleString()} · {latest.model}
            {latest.draft_version ? ` · draft v${latest.draft_version}` : ""}
          </div>
          <div className="mt-2">
            <FindingsCards findings={latest.findings?.findings ?? []} />
          </div>
        </div>
      )}
    </div>
  );
}
