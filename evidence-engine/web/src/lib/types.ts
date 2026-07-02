// Hand-written domain types. In a real setup, regenerate the `Database` type with:
//   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// and swap `Database` below for the generated one.

export type ProposalStatus =
  | "draft"
  | "in_review"
  | "submitted"
  | "awarded"
  | "declined";

export type ClaimStatus = "needs_evidence" | "supported" | "rejected";
export type Verdict = "supports" | "weak" | "contradicts";

export interface Proposal {
  id: string;
  org_id: string;
  title: string;
  funder: string | null;
  program: string | null;
  status: ProposalStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalSection {
  id: string;
  proposal_id: string;
  org_id: string;
  heading: string;
  body: string;
  position: number;
}

export interface Claim {
  id: string;
  section_id: string;
  org_id: string;
  text: string;
  status: ClaimStatus;
}

export interface Citation {
  id: string;
  claim_id: string;
  org_id: string;
  title: string;
  authors: string | null;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  abstract_snippet: string | null;
  relevance: number | null;
  verdict: Verdict | null;
  verdict_rationale: string | null;
  openalex_id: string | null;
}

// Edge-function payloads
export interface Paper {
  openalex_id: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  cited_by_count: number;
  relevance: number;
}

export interface VerifyResult {
  verdict: Verdict;
  rationale: string;
}

export interface DraftResult {
  draft_markdown: string;
  citations_used: { id: string; supports: string }[];
  unused_citations: string[];
}

// Minimal Database shape so createClient<Database> is happy without generated types.
export type Database = Record<string, unknown>;
