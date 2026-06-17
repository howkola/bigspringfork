import type {
  Citation,
  ConsensusResponse,
  ConsensusStreamEvent,
  SectionResponse,
  SectionStreamEvent,
} from "../../shared/types";
import { readSse } from "./sse";

/* Client-side calls to the Netlify functions. The Anthropic key lives only on
   the server — the browser never sees it. Both endpoints stream Server-Sent
   Events (Phase 2). */

async function postSse(
  path: string,
  body: unknown,
  onEvent: (e: unknown) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  await readSse(res, onEvent);
}

/** Stage 1: Consensus retrieval + structuring, streaming status frames.
    Never rejects on retrieval failure — resolves with { failed: true } and the
    pipeline degrades to anchors only. Rejects only on transport/HTTP errors. */
export function runConsensus(
  request: string,
  opts: { onStatus?: (message: string) => void; signal?: AbortSignal } = {}
): Promise<ConsensusResponse> {
  return new Promise<ConsensusResponse>((resolve, reject) => {
    let settled = false;
    postSse(
      "/api/consensus",
      { request },
      (raw) => {
        const e = raw as ConsensusStreamEvent;
        if (e.type === "status") opts.onStatus?.(e.message);
        else if (e.type === "result") {
          settled = true;
          resolve({ citations: e.citations, raw: e.raw, failed: e.failed });
        } else if (e.type === "error") {
          settled = true;
          reject(new Error(e.message));
        }
      },
      opts.signal
    ).then(
      () => {
        if (!settled) resolve({ citations: [], raw: "", failed: true });
      },
      (err) => {
        if (!settled) reject(err);
      }
    );
  });
}

/** Stage 2: generate one packet section, streaming markdown deltas.
    `onDelta` receives the accumulated markdown so far. */
export function generateSection(
  request: string,
  sectionKey: string,
  consensusCitations: Citation[],
  opts: {
    onDelta?: (accumulated: string) => void;
    onStatus?: (phase: "thinking" | "writing") => void;
    signal?: AbortSignal;
  } = {}
): Promise<SectionResponse> {
  return new Promise<SectionResponse>((resolve, reject) => {
    let acc = "";
    let settled = false;
    postSse(
      "/api/section",
      { request, sectionKey, consensusCitations },
      (raw) => {
        const e = raw as SectionStreamEvent;
        if (e.type === "delta") {
          acc += e.text;
          opts.onDelta?.(acc);
        } else if (e.type === "status") {
          opts.onStatus?.(e.phase);
        } else if (e.type === "done") {
          settled = true;
          resolve({ text: acc, truncated: e.truncated });
        } else if (e.type === "error") {
          settled = true;
          reject(new Error(e.message));
        }
      },
      opts.signal
    ).then(
      () => {
        if (!settled) {
          // Stream ended without a terminal frame — use whatever we accumulated.
          if (acc) resolve({ text: acc, truncated: false });
          else reject(new Error("Stream ended unexpectedly"));
        }
      },
      (err) => {
        if (!settled) reject(err);
      }
    );
  });
}
