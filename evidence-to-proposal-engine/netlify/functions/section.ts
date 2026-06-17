import type { Context } from "@netlify/functions";
import type { Citation } from "../../shared/types";
import { SECTION_DEFS } from "../../shared/anchors";
import { buildEvidenceContext, buildSectionPrompt } from "../../shared/prompts";
import { stripFences } from "../../shared/parse";
import { getClient, MODELS, SYNTHESIS_EFFORT, json } from "./lib/anthropic";
import { sseResponse } from "./lib/sse";

/* ---- Stage 2: synthesis — one section per call, STREAMED as SSE ----
   Plain markdown out (no JSON in the synthesis path, so truncation can never
   corrupt a parse). Streaming token-by-token gives live rendering and keeps the
   connection warm, so the effort level is no longer bounded by a single
   round-trip. We forward only text deltas — thinking blocks stay server-side. */

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let request = "";
  let sectionKey = "";
  let consensusCitations: Citation[] = [];
  try {
    const body = (await req.json()) as {
      request?: string;
      sectionKey?: string;
      consensusCitations?: Citation[];
    };
    request = (body.request || "").trim();
    sectionKey = body.sectionKey || "";
    consensusCitations = Array.isArray(body.consensusCitations)
      ? body.consensusCitations
      : [];
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!request) return json({ error: "Missing 'request'" }, 400);
  const def = SECTION_DEFS.find((s) => s.key === sectionKey);
  if (!def || def.key === "citationPacket") {
    return json({ error: `Unknown section '${sectionKey}'` }, 400);
  }

  let client: ReturnType<typeof getClient>;
  try {
    client = getClient();
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }

  const context = buildEvidenceContext(request, consensusCitations);
  const prompt = buildSectionPrompt(context, def.label, def.key);

  // adaptive thinking + output_config.effort are valid API fields the installed
  // SDK version doesn't yet type — cast through unknown so they're forwarded.
  const params = {
    model: MODELS.synthesis(),
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: { effort: SYNTHESIS_EFFORT() },
    messages: [{ role: "user", content: prompt }],
  } as unknown as Parameters<typeof client.messages.stream>[0];

  return sseResponse(async (send) => {
    const mstream = client.messages.stream(params);
    let raw = "";
    for await (const ev of mstream as AsyncIterable<Record<string, any>>) {
      if (ev.type === "content_block_start") {
        const t = ev.content_block?.type;
        if (t === "thinking") send({ type: "status", phase: "thinking" });
        else if (t === "text") send({ type: "status", phase: "writing" });
      } else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
        raw += ev.delta.text;
        send({ type: "delta", text: ev.delta.text });
      }
    }

    const final = await mstream.finalMessage();
    const truncated = final.stop_reason === "max_tokens";
    if (!stripFences(raw).trim()) {
      send({ type: "error", message: "Empty model response" });
      return;
    }
    send({ type: "done", truncated });
  });
};
