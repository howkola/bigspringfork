import type Anthropic from "@anthropic-ai/sdk";
import type { Context } from "@netlify/functions";
import type { Citation } from "../../shared/types";
import { buildConsensusPrompt, buildStructuringPrompt } from "../../shared/prompts";
import { parseCitationsLoose } from "../../shared/parse";
import {
  getClient,
  MODELS,
  CONSENSUS_MCP_URL,
  joinText,
  joinMcpResults,
  json,
} from "./lib/anthropic";
import { sseResponse } from "./lib/sse";

/* ---- Stage 1: Consensus retrieval via MCP, then a cheap structuring pass ----
   STREAMED as SSE: status frames while the (potentially slow) MCP search loop
   runs keep the connection warm and give the UI live progress, then a single
   `result` frame carries the citations. Retrieval failure is NOT fatal — the
   client degrades to the anchor library only (result with failed: true). A
   missing API key is a real 500. */

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let request = "";
  try {
    const body = (await req.json()) as { request?: string };
    request = (body.request || "").trim();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!request) return json({ error: "Missing 'request'" }, 400);

  let client: ReturnType<typeof getClient>;
  try {
    client = getClient();
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }

  return sseResponse(async (send) => {
    const result = (citations: Citation[], raw: string, failed: boolean) =>
      send({ type: "result", citations, raw, failed });

    try {
      // --- Retrieval: let the model drive Consensus searches via MCP ---
      send({ type: "status", message: "Searching peer-reviewed literature via Consensus…" });

      let messages: Anthropic.Beta.BetaMessageParam[] = [
        { role: "user", content: buildConsensusPrompt(request) },
      ];
      let combinedTool = "";
      let combinedText = "";

      for (let i = 0; i < 4; i++) {
        const data = await client.beta.messages.create({
          model: MODELS.retrieval(),
          max_tokens: 2000,
          messages,
          mcp_servers: [{ type: "url", name: "consensus", url: CONSENSUS_MCP_URL() }],
          betas: ["mcp-client-2025-11-20"],
        });
        combinedTool += "\n\n" + joinMcpResults(data.content);
        combinedText += "\n\n" + joinText(data.content);

        // Server-side MCP loop hit its iteration cap — re-send to resume.
        if (data.stop_reason === "pause_turn") {
          send({ type: "status", message: "Running further searches…" });
          messages = [
            { role: "user", content: buildConsensusPrompt(request) },
            { role: "assistant", content: data.content },
          ];
          continue;
        }
        break;
      }

      const combined = [combinedTool, combinedText]
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n\n");
      if (!combined) return result([], "", true);

      // --- Structuring: turn raw retrieval into numbered C# citation entries ---
      send({ type: "status", message: "Structuring retrieved sources…" });
      const structured = await client.messages.create({
        model: MODELS.structuring(),
        max_tokens: 1200,
        messages: [{ role: "user", content: buildStructuringPrompt(combined) }],
      });

      const rawCites = parseCitationsLoose(joinText(structured.content));
      const citations: Citation[] = rawCites.map((c, i) => ({
        id: c.id && /^C\d+$/.test(c.id) ? c.id : `C${i + 1}`,
        authors: c.authors || "",
        year: c.year || "",
        title: c.title || "",
        source: c.source || "",
        finding: c.finding || "",
        badge: "consensus",
      }));

      result(citations, combined, false);
    } catch (e) {
      console.error("Consensus stage failed:", e);
      // Degrade gracefully — anchors-only run, not a hard error.
      result([], "", true);
    }
  });
};
