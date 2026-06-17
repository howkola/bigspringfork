import type {
  Citation,
  ConsensusResponse,
  SectionResponse,
} from "../../shared/types";

/* Client-side calls to the Netlify functions. The Anthropic key lives only on
   the server — the browser never sees it. */

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data as { error?: string }).error) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/** Stage 1: Consensus retrieval + structuring. Never throws on retrieval failure —
    the server returns { failed: true } and the pipeline degrades to anchors only. */
export function runConsensus(request: string): Promise<ConsensusResponse> {
  return postJson<ConsensusResponse>("/api/consensus", { request });
}

/** Stage 2: generate one packet section as markdown. */
export function generateSection(
  request: string,
  sectionKey: string,
  consensusCitations: Citation[]
): Promise<SectionResponse> {
  return postJson<SectionResponse>("/api/section", {
    request,
    sectionKey,
    consensusCitations,
  });
}
