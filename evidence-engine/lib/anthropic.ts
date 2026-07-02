import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new PipelineApiError(
        "ANTHROPIC_API_KEY is not configured on the server.",
        false,
      );
    }
    // The SDK retries 429/5xx/connection errors with exponential backoff.
    _client = new Anthropic({ maxRetries: 3 });
  }
  return _client;
}

/**
 * Error thrown by pipeline model calls. `retryable` tells the pipeline whether
 * re-running the stage is worth attempting (rate limits, overloads, network)
 * versus a permanent problem (bad request, refusal, malformed output).
 */
export class PipelineApiError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "PipelineApiError";
  }
}

export interface ClaudeJSONCallArgs<T> {
  system: string;
  user: string;
  /** JSON schema sent to the API to constrain the output shape. */
  schema: Record<string, unknown>;
  /** Zod schema used to validate the parsed result server-side. */
  validator: ZodType<T>;
  maxTokens?: number;
}

export interface ClaudeJSONResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * One structured-output call to Claude. Streams (so large responses don't hit
 * HTTP timeouts), constrains the response with output_config.format, then
 * validates the JSON against a Zod schema before anything touches the DB.
 */
export async function callClaudeJSON<T>(
  args: ClaudeJSONCallArgs<T>,
): Promise<ClaudeJSONResult<T>> {
  const client = getClient();

  let message: Anthropic.Message;
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: args.maxTokens ?? 16000,
      thinking: { type: "adaptive" },
      system: args.system,
      messages: [{ role: "user", content: args.user }],
      output_config: {
        format: { type: "json_schema", schema: args.schema },
      },
    });
    message = await stream.finalMessage();
  } catch (error) {
    throw mapAnthropicError(error);
  }

  if (message.stop_reason === "refusal") {
    throw new PipelineApiError(
      "The model declined to generate this content (safety refusal). Revise the inputs and retry.",
      false,
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new PipelineApiError(
      "The model response was truncated at the token limit. Retry — if it persists, reduce the input size.",
      true,
    );
  }

  const text = message.content.find((b) => b.type === "text")?.text;
  if (!text) {
    throw new PipelineApiError("The model returned no text content.", true);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PipelineApiError(
      "The model returned output that is not valid JSON.",
      true,
    );
  }

  const result = args.validator.safeParse(parsed);
  if (!result.success) {
    throw new PipelineApiError(
      `The model output did not match the expected shape: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      true,
    );
  }

  return {
    data: result.data,
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

function mapAnthropicError(error: unknown): PipelineApiError {
  if (error instanceof Anthropic.RateLimitError) {
    return new PipelineApiError(
      "Anthropic API rate limit reached. Wait a moment and retry this stage.",
      true,
      error,
    );
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new PipelineApiError(
      "Anthropic API key is invalid. Check ANTHROPIC_API_KEY.",
      false,
      error,
    );
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new PipelineApiError(
      `Anthropic API rejected the request: ${error.message}`,
      false,
      error,
    );
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new PipelineApiError(
      "Could not reach the Anthropic API (network error). Retry this stage.",
      true,
      error,
    );
  }
  if (error instanceof Anthropic.APIError) {
    const status = (error as { status?: number }).status;
    return new PipelineApiError(
      `Anthropic API error${status ? ` (${status})` : ""}: ${error.message}`,
      status !== undefined && status >= 500,
      error,
    );
  }
  return new PipelineApiError(
    error instanceof Error ? error.message : "Unknown model call failure",
    false,
    error,
  );
}
