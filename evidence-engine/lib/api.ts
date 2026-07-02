import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { PipelineApiError } from "@/lib/anthropic";
import type { PipelineStage } from "@/lib/types";

export function jsonError(message: string, status: number, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Uniform error handling for API routes. Auth failures map to 401/403,
 * validation to 400, model-call failures to 502 with a retryable hint,
 * database gate violations to 409.
 */
export function handleRouteError(error: unknown) {
  if (error instanceof AuthError) {
    return jsonError(error.message, error.status);
  }
  if (error instanceof ZodError) {
    return jsonError(
      `Invalid request: ${error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      400,
    );
  }
  if (error instanceof PipelineApiError) {
    return jsonError(error.message, 502, { retryable: error.retryable });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  // Postgres gate triggers raise P0001 with a descriptive message.
  if (message.includes("citation gate") || message.includes("assembly gate")) {
    return jsonError(message, 409);
  }
  console.error("Unhandled route error:", error);
  return jsonError(message, 500);
}

/**
 * Persist a mid-pipeline failure on the run so the UI can surface it and the
 * team can resume the stage after fixing the cause.
 */
export async function recordRunFailure(
  supabase: SupabaseClient,
  runId: string,
  stage: PipelineStage,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const retryable = error instanceof PipelineApiError ? error.retryable : false;
  await supabase
    .from("pipeline_runs")
    .update({
      status: "failed",
      failed_stage: stage,
      last_error: {
        stage,
        message,
        retryable,
        at: new Date().toISOString(),
      },
    })
    .eq("id", runId);
}

/**
 * Clear a previous failure when a stage is (re)attempted.
 */
export async function clearRunFailure(
  supabase: SupabaseClient,
  runId: string,
): Promise<void> {
  await supabase
    .from("pipeline_runs")
    .update({ status: "active", failed_stage: null, last_error: null })
    .eq("id", runId)
    .eq("status", "failed");
}
