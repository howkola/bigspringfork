// Thin wrapper around the Anthropic SDK for edge functions.
// The API key lives only in the function's environment (Supabase secret) and
// is never exposed to the browser.
import Anthropic from "npm:@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-8";

export function getAnthropic(): Anthropic {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

/**
 * Call Claude with adaptive thinking + high effort and a JSON-schema-constrained
 * response, returning the parsed object. Uses structured outputs so we never
 * parse free-form prose.
 *
 * `output_config` (effort + structured format) and adaptive `thinking` are
 * recent API fields; we build params loosely and cast so the SDK's typings
 * don't block deploy-time `deno check`.
 */
export async function structuredCompletion<T>(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const client = getAnthropic();

  const params = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: opts.effort ?? "high",
      format: { type: "json_schema", schema: opts.schema },
    },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  };

  // deno-lint-ignore no-explicit-any
  const res = await client.messages.create(params as any);

  // deno-lint-ignore no-explicit-any
  const block = (res.content as any[]).find((b) => b.type === "text");
  if (!block) throw new Error("No text block in model response");
  return JSON.parse(block.text) as T;
}
