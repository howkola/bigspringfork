import type { Context } from "@netlify/functions";
import type { Citation, SectionResponse } from "../../shared/types";
import { SECTION_DEFS } from "../../shared/anchors";
import { buildEvidenceContext, buildSectionPrompt } from "../../shared/prompts";
import { stripFences } from "../../shared/parse";
import { getClient, MODELS, SYNTHESIS_EFFORT, joinText, json } from "./lib/anthropic";

/* ---- Stage 2: synthesis — one small call per section, plain markdown out ----
   No JSON in the synthesis path, so a token-limit truncation can never corrupt
   a parse. We stream internally (SDK .stream()) for connection robustness and
   return the finished markdown as JSON. Phase 2 will stream this to the client. */

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

  try {
    const context = buildEvidenceContext(request, consensusCitations);
    const prompt = buildSectionPrompt(context, def.label, def.key);

    // adaptive thinking + output_config.effort are valid API fields that the
    // installed SDK version doesn't yet type — cast through unknown so they're
    // forwarded to the API verbatim.
    const params = {
      model: MODELS.synthesis(),
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: SYNTHESIS_EFFORT() },
      messages: [{ role: "user", content: prompt }],
    } as unknown as Parameters<typeof client.messages.stream>[0];

    const stream = client.messages.stream(params);

    const message = await stream.finalMessage();
    let text = stripFences(joinText(message.content).trim());
    const truncated = message.stop_reason === "max_tokens";

    if (!text) return json({ error: "Empty model response" }, 502);
    if (truncated) {
      text +=
        "\n\n> ⚠ Output reached the token limit and may be incomplete — use Regenerate on this section.";
    }

    return json({ text, truncated } satisfies SectionResponse);
  } catch (e) {
    console.error(`Section '${sectionKey}' failed:`, e);
    return json({ error: String((e as Error).message || e) }, 502);
  }
};
