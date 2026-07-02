import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEvent {
  actorId: string;
  action: string;
  entityType:
    | "corpus_entry"
    | "grant_opportunity"
    | "pipeline_run"
    | "generated_section"
    | "citation_claim"
    | "review_checkpoint";
  entityId?: string;
  pipelineRunId?: string;
  detail?: Record<string, unknown>;
}

/**
 * Append an audit-log row. Audit writes must never take the primary action
 * down with them, but a silent gap in the trail is also unacceptable — so we
 * log loudly on failure.
 */
export async function writeAudit(
  supabase: SupabaseClient,
  event: AuditEvent,
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    actor_id: event.actorId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    pipeline_run_id: event.pipelineRunId ?? null,
    detail: event.detail ?? {},
  });
  if (error) {
    console.error("AUDIT WRITE FAILED", event.action, error.message);
  }
}
