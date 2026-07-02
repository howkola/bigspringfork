import { describe, expect, it } from "vitest";
import {
  classifyDraftClaims,
  findMarkerMismatches,
  gateFailureReasons,
  isStale,
  sectionGatePasses,
} from "@/lib/pipeline/citations";
import { assembleDocument } from "@/lib/pipeline/assemble";
import { canTransition } from "@/lib/pipeline/stages";
import type {
  CitationClaim,
  CorpusEntry,
  GeneratedSection,
} from "@/lib/types";

const NOW = new Date("2026-07-01T00:00:00Z");

function corpusEntry(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "CAC outcomes study",
    source_type: "peer_reviewed_study",
    authors: "Cross et al.",
    publication: "Child Abuse & Neglect",
    publication_year: 2007,
    url: "https://example.org/study",
    summary: "Multi-site CAC evaluation.",
    key_findings: ["Finding A"],
    tags: [],
    confidence: "high",
    last_verified_at: "2026-01-01T00:00:00Z",
    stale_after: "2027-01-01T00:00:00Z",
    is_archived: false,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function claim(
  status: CitationClaim["verification_status"],
  marker = "[C1]",
): CitationClaim {
  return {
    id: `claim-${marker}`,
    section_id: "sec-1",
    claim_text: "Children at CACs were twice as likely to receive exams.",
    citation_marker: marker,
    corpus_entry_id: corpusEntry().id,
    verification_status: status,
    verification_notes: null,
    verified_at: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("citation hard gate", () => {
  it("passes only when every claim is verified", () => {
    expect(sectionGatePasses([claim("verified"), claim("verified", "[C2]")])).toBe(true);
    expect(sectionGatePasses([claim("verified"), claim("pending", "[C2]")])).toBe(false);
    expect(sectionGatePasses([claim("unsupported")])).toBe(false);
    expect(sectionGatePasses([claim("missing_source")])).toBe(false);
    expect(sectionGatePasses([claim("stale_source")])).toBe(false);
    expect(sectionGatePasses([claim("partially_supported")])).toBe(false);
  });

  it("fails when a section has no claims at all", () => {
    expect(sectionGatePasses([])).toBe(false);
    expect(gateFailureReasons([])[0]).toMatch(/No citation claims/);
  });

  it("summarizes failure reasons by status", () => {
    const reasons = gateFailureReasons([
      claim("verified"),
      claim("missing_source", "[C2]"),
      claim("stale_source", "[C3]"),
    ]);
    expect(reasons.join(" ")).toMatch(/does not exist in the corpus/);
    expect(reasons.join(" ")).toMatch(/stale source/);
  });
});

describe("classifyDraftClaims", () => {
  const fresh = corpusEntry();
  const stale = corpusEntry({
    id: "22222222-2222-2222-2222-222222222222",
    stale_after: "2026-01-01T00:00:00Z",
  });
  const byId = new Map([
    [fresh.id, fresh],
    [stale.id, stale],
  ]);

  it("flags fabricated citations as missing_source and drops the fake id", () => {
    const [result] = classifyDraftClaims(
      [
        {
          claim_text: "A made-up statistic.",
          citation_marker: "[C1]",
          corpus_entry_id: "99999999-9999-9999-9999-999999999999",
        },
      ],
      byId,
      NOW,
    );
    expect(result.verification_status).toBe("missing_source");
    expect(result.corpus_entry_id).toBeNull();
  });

  it("flags citations to stale sources", () => {
    const [result] = classifyDraftClaims(
      [
        {
          claim_text: "An old statistic.",
          citation_marker: "[C1]",
          corpus_entry_id: stale.id,
        },
      ],
      byId,
      NOW,
    );
    expect(result.verification_status).toBe("stale_source");
    expect(result.corpus_entry_id).toBe(stale.id);
  });

  it("leaves valid fresh citations pending verification", () => {
    const [result] = classifyDraftClaims(
      [
        {
          claim_text: "A real finding.",
          citation_marker: "[C1]",
          corpus_entry_id: fresh.id,
        },
      ],
      byId,
      NOW,
    );
    expect(result.verification_status).toBe("pending");
  });
});

describe("isStale", () => {
  it("treats entries past stale_after as stale", () => {
    expect(isStale({ stale_after: "2026-06-30T00:00:00Z" }, NOW)).toBe(true);
    expect(isStale({ stale_after: "2026-07-02T00:00:00Z" }, NOW)).toBe(false);
  });
});

describe("findMarkerMismatches", () => {
  it("detects markers without claims and claims without markers", () => {
    const result = findMarkerMismatches("Text [C1] and [C2].", [
      { claim_text: "x", citation_marker: "[C1]", corpus_entry_id: "a" },
      { claim_text: "y", citation_marker: "[C3]", corpus_entry_id: "b" },
    ]);
    expect(result.markersWithoutClaims).toEqual(["[C2]"]);
    expect(result.claimsWithoutMarkers).toEqual(["[C3]"]);
  });

  it("is clean when markers and claims line up", () => {
    const result = findMarkerMismatches("Text [C1].", [
      { claim_text: "x", citation_marker: "[C1]", corpus_entry_id: "a" },
    ]);
    expect(result.markersWithoutClaims).toEqual([]);
    expect(result.claimsWithoutMarkers).toEqual([]);
  });
});

describe("assembleDocument", () => {
  it("renumbers markers into document-wide footnotes and builds references", () => {
    const entryA = corpusEntry();
    const entryB = corpusEntry({
      id: "33333333-3333-3333-3333-333333333333",
      title: "TF-CBT RCT",
      authors: "Cohen et al.",
    });

    const sections = [
      {
        id: "sec-1",
        pipeline_run_id: "run-1",
        section_key: "need",
        title: "Need",
        sort_order: 0,
        word_limit: null,
        drafting_guidance: null,
        relevant_corpus_ids: [],
        status: "approved",
        draft_content: null,
        current_content: "Need text [C1].",
        model_used: null,
        input_tokens: null,
        output_tokens: null,
        verification_summary: null,
        created_at: "",
        updated_at: "",
      },
      {
        id: "sec-2",
        pipeline_run_id: "run-1",
        section_key: "program",
        title: "Program",
        sort_order: 1,
        word_limit: null,
        drafting_guidance: null,
        relevant_corpus_ids: [],
        status: "approved",
        draft_content: null,
        current_content: "Program text [C1] and again [C2].",
        model_used: null,
        input_tokens: null,
        output_tokens: null,
        verification_summary: null,
        created_at: "",
        updated_at: "",
      },
    ] as GeneratedSection[];

    const claimsBySection = new Map<string, CitationClaim[]>([
      [
        "sec-1",
        [{ ...claim("verified"), section_id: "sec-1", corpus_entry_id: entryA.id }],
      ],
      [
        "sec-2",
        [
          {
            ...claim("verified", "[C1]"),
            section_id: "sec-2",
            corpus_entry_id: entryB.id,
          },
          {
            ...claim("verified", "[C2]"),
            section_id: "sec-2",
            corpus_entry_id: entryA.id,
          },
        ],
      ],
    ]);

    const corpusById = new Map([
      [entryA.id, entryA],
      [entryB.id, entryB],
    ]);

    const { document, references } = assembleDocument(
      sections,
      claimsBySection,
      corpusById,
    );

    // Section 1's [C1] -> footnote 1 (entryA); section 2's [C1] -> footnote 2
    // (entryB); section 2's [C2] reuses footnote 1 (same source as section 1).
    expect(document).toContain("Need text [1].");
    expect(document).toContain("Program text [2] and again [1].");
    expect(references).toHaveLength(2);
    expect(document).toContain("## References");
    expect(references[0]).toContain("CAC outcomes study");
    expect(references[1]).toContain("TF-CBT RCT");
  });
});

describe("stage machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("intake", "intake_review")).toBe(true);
    expect(canTransition("intake_review", "drafting")).toBe(true);
    expect(canTransition("drafting", "citation_verification")).toBe(true);
    expect(canTransition("citation_verification", "section_review")).toBe(true);
    expect(canTransition("section_review", "assembly")).toBe(true);
    expect(canTransition("assembly", "final_review")).toBe(true);
    expect(canTransition("final_review", "completed")).toBe(true);
  });

  it("blocks skipping the gate stages", () => {
    expect(canTransition("drafting", "assembly")).toBe(false);
    expect(canTransition("intake", "completed")).toBe(false);
    expect(canTransition("completed", "intake")).toBe(false);
  });
});
