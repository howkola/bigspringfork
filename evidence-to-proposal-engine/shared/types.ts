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

// ---- Server-Sent Event payloads (streaming, Phase 2) ----

export type SectionStreamEvent =
  | { type: "status"; phase: "thinking" | "writing" }
  | { type: "delta"; text: string }
  | { type: "done"; truncated: boolean }
  | { type: "error"; message: string };

export type ConsensusStreamEvent =
  | { type: "status"; message: string }
  | { type: "result"; citations: Citation[]; raw: string; failed: boolean }
  | { type: "error"; message: string };

// ---- Persistence (Phase 3) ----

/** The full, rehydratable state of a saved packet. Anchors are static
    (rebuilt from ANCHOR_LIBRARY), so only the Consensus citations are stored. */
export interface PacketData {
  request: string;
  sections: Record<string, string>;
  consensusCitations: Citation[];
  consensusRaw: string;
  consensusFailed: boolean;
  verified: Record<string, boolean>;
  reviewed: Record<string, boolean>;
}

export interface PacketMeta {
  slug: string;
  request: string;
  updatedAt: string;
}

export interface SavePacketResponse {
  slug: string;
  updatedAt: string;
}

export interface LoadPacketResponse {
  slug: string;
  data: PacketData;
  updatedAt: string;
}
