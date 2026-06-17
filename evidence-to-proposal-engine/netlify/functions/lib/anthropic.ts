import Anthropic from "@anthropic-ai/sdk";

/** Lazily construct the client so a missing key produces a clean 500, not a crash at import. */
let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

export const MODELS = {
  synthesis: () => process.env.SYNTHESIS_MODEL || "claude-opus-4-8",
  structuring: () => process.env.STRUCTURING_MODEL || "claude-haiku-4-5",
  retrieval: () => process.env.RETRIEVAL_MODEL || "claude-opus-4-8",
};

// Effort for the section synthesis. Defaults to "low" in Phase 1 so each section
// completes inside the Netlify synchronous-function window; Phase 2 streams the
// response to the client, which removes the timeout ceiling and lets this rise.
export const SYNTHESIS_EFFORT = () => process.env.SYNTHESIS_EFFORT || "low";

export const CONSENSUS_MCP_URL = () =>
  process.env.CONSENSUS_MCP_URL || "https://mcp.consensus.app/mcp";

type Block = { type: string; text?: string; content?: Array<{ text?: string }> };

/** Join all top-level text blocks of a message. */
export function joinText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as Block[])
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

/** Pull text out of any mcp_tool_result blocks (the raw Consensus payload). */
export function joinMcpResults(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as Block[])
    .filter((b) => b && b.type === "mcp_tool_result" && Array.isArray(b.content))
    .map((b) => (b.content || []).map((c) => c.text || "").join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
