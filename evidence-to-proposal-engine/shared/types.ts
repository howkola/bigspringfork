// Shared types used by both the React client and the Netlify functions.

export type CitationBadge = "anchor" | "consensus";

export interface Citation {
  id: string;
  authors: string;
  year: string;
  title: string;
  source: string;
  finding: string;
  tags?: string[];
  badge: CitationBadge;
}

export interface SectionDef {
  key: string;
  num: string;
  label: string;
}

// ---- API payloads (client <-> functions) ----

export interface ConsensusRequest {
  request: string;
}

export interface ConsensusResponse {
  citations: Citation[];
  raw: string;
  failed: boolean;
}

export interface SectionRequest {
  request: string;
  sectionKey: string;
  /** Consensus citations retrieved this run, so the server can build the [C#] context. */
  consensusCitations: Citation[];
}

export interface SectionResponse {
  text: string;
  truncated: boolean;
}

export interface ApiError {
  error: string;
}
