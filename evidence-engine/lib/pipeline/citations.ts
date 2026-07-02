import type { CitationClaim, ClaimVerificationStatus, CorpusEntry } from "@/lib/types";

/**
 * Pure citation-integrity logic. These functions are the single source of
 * truth the API routes use; the database triggers mirror them as a backstop.
 */

export interface DraftClaimInput {
  claim_text: string;
  citation_marker: string;
  corpus_entry_id: string;
}

export interface ClassifiedClaim {
  claim_text: string;
  citation_marker: string;
  corpus_entry_id: string | null;
  verification_status: ClaimVerificationStatus;
  verification_notes: string | null;
}

/**
 * Classify freshly drafted claims before verification:
 * - a cited corpus id that doesn't exist (or wasn't offered to the model) is a
 *   fabricated citation -> missing_source, hard failure, never silently kept;
 * - a citation to a stale corpus entry is flagged stale_source immediately;
 * - everything else starts as pending, awaiting model verification.
 */
export function classifyDraftClaims(
  claims: DraftClaimInput[],
  corpusById: Map<string, CorpusEntry>,
  now: Date = new Date(),
): ClassifiedClaim[] {
  return claims.map((claim) => {
    const entry = corpusById.get(claim.corpus_entry_id);
    if (!entry) {
      return {
        claim_text: claim.claim_text,
        citation_marker: claim.citation_marker,
        corpus_entry_id: null,
        verification_status: "missing_source",
        verification_notes: `The model cited corpus entry ${claim.corpus_entry_id}, which does not exist in the corpus. This claim is blocked until a real source is attached or the claim is removed.`,
      };
    }
    if (isStale(entry, now)) {
      return {
        claim_text: claim.claim_text,
        citation_marker: claim.citation_marker,
        corpus_entry_id: entry.id,
        verification_status: "stale_source",
        verification_notes: `Cited source "${entry.title}" passed its freshness deadline (${entry.stale_after}). Re-verify the source in the corpus, then re-run verification.`,
      };
    }
    return {
      claim_text: claim.claim_text,
      citation_marker: claim.citation_marker,
      corpus_entry_id: entry.id,
      verification_status: "pending",
      verification_notes: null,
    };
  });
}

export function isStale(
  entry: Pick<CorpusEntry, "stale_after">,
  now: Date = new Date(),
): boolean {
  return new Date(entry.stale_after).getTime() <= now.getTime();
}

/**
 * The hard gate: a section may advance past verification only when it has at
 * least one claim and every claim is verified.
 */
export function sectionGatePasses(
  claims: Pick<CitationClaim, "verification_status">[],
): boolean {
  return (
    claims.length > 0 &&
    claims.every((c) => c.verification_status === "verified")
  );
}

export function gateFailureReasons(
  claims: Pick<CitationClaim, "verification_status" | "citation_marker">[],
): string[] {
  if (claims.length === 0) {
    return [
      "No citation claims are recorded for this section — every factual claim must be traceable to the corpus.",
    ];
  }
  const reasons: string[] = [];
  const byStatus = new Map<string, number>();
  for (const c of claims) {
    if (c.verification_status !== "verified") {
      byStatus.set(
        c.verification_status,
        (byStatus.get(c.verification_status) ?? 0) + 1,
      );
    }
  }
  const labels: Record<string, string> = {
    pending: "awaiting verification",
    unsupported: "not supported by the cited source",
    partially_supported: "only partially supported by the cited source",
    missing_source: "citing a source that does not exist in the corpus",
    stale_source: "citing a stale source that needs re-verification",
  };
  for (const [status, count] of byStatus) {
    reasons.push(`${count} claim(s) ${labels[status] ?? status}`);
  }
  return reasons;
}

/**
 * Render corpus entries as a numbered evidence list for prompts. The model may
 * only cite these exact IDs; anything else is rejected as fabricated.
 */
export function formatCorpusForPrompt(entries: CorpusEntry[]): string {
  return entries
    .map((e, i) => {
      const findings = e.key_findings.map((f) => `    - ${f}`).join("\n");
      return [
        `SOURCE ${i + 1}`,
        `  corpus_entry_id: ${e.id}`,
        `  title: ${e.title}`,
        `  type: ${e.source_type} | confidence: ${e.confidence} | year: ${e.publication_year ?? "n/a"}`,
        e.authors ? `  authors: ${e.authors}` : null,
        `  summary: ${e.summary}`,
        findings ? `  key findings:\n${findings}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

/**
 * Verify that every [C#] marker in the drafted content has a matching claim
 * record, and vice versa. Orphan markers mean untraceable statements.
 */
export function findMarkerMismatches(
  content: string,
  claims: Pick<CitationClaim, "citation_marker">[] | DraftClaimInput[],
): { markersWithoutClaims: string[]; claimsWithoutMarkers: string[] } {
  const inText = new Set(content.match(/\[C\d+\]/g) ?? []);
  const inClaims = new Set(claims.map((c) => c.citation_marker));
  return {
    markersWithoutClaims: [...inText].filter((m) => !inClaims.has(m)),
    claimsWithoutMarkers: [...inClaims].filter((m) => !inText.has(m)),
  };
}
