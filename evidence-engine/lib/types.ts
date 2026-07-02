// Row types mirroring supabase/migrations/0001_schema.sql

export type TeamRole = "admin" | "grant_writer" | "reviewer";

export type CorpusSourceType =
  | "peer_reviewed_study"
  | "government_report"
  | "internal_program_data"
  | "evaluation_report"
  | "news_or_media"
  | "other";

export type ConfidenceLevel = "high" | "medium" | "low";

export type GrantStatus =
  | "prospect"
  | "active"
  | "submitted"
  | "awarded"
  | "declined"
  | "archived";

export type PipelineStage =
  | "intake"
  | "intake_review"
  | "drafting"
  | "citation_verification"
  | "section_review"
  | "assembly"
  | "final_review"
  | "completed";

export type RunStatus = "active" | "failed" | "cancelled" | "completed";

export type SectionStatus =
  | "planned"
  | "drafting"
  | "drafted"
  | "verifying"
  | "verification_failed"
  | "awaiting_review"
  | "changes_requested"
  | "approved"
  | "final";

export type ClaimVerificationStatus =
  | "pending"
  | "verified"
  | "unsupported"
  | "partially_supported"
  | "missing_source"
  | "stale_source";

export type CheckpointKind = "intake_review" | "section_review" | "final_review";
export type CheckpointStatus = "pending" | "approved" | "rejected" | "changes_requested";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: TeamRole;
  is_active: boolean;
  created_at: string;
}

export interface CorpusEntry {
  id: string;
  title: string;
  source_type: CorpusSourceType;
  authors: string | null;
  publication: string | null;
  publication_year: number | null;
  url: string | null;
  summary: string;
  key_findings: string[];
  tags: string[];
  confidence: ConfidenceLevel;
  last_verified_at: string;
  stale_after: string;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequiredSection {
  key: string;
  title: string;
  word_limit?: number;
}

export interface GrantOpportunity {
  id: string;
  funder: string;
  title: string;
  description: string;
  focus_areas: string[];
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  required_sections: RequiredSection[];
  guidelines_url: string | null;
  status: GrantStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntakeSectionPlan {
  key: string;
  title: string;
  sort_order: number;
  word_limit: number | null;
  drafting_guidance: string;
  relevant_corpus_ids: string[];
}

export interface IntakeAnalysis {
  fit_assessment: string;
  fit_score: number; // 1-10
  risks_and_gaps: string[];
  section_plan: IntakeSectionPlan[];
}

export interface PipelineRun {
  id: string;
  grant_opportunity_id: string;
  stage: PipelineStage;
  status: RunStatus;
  intake_analysis: IntakeAnalysis | null;
  assembled_document: string | null;
  executive_summary: string | null;
  last_error: { stage: string; message: string; at: string; retryable?: boolean } | null;
  failed_stage: PipelineStage | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface GeneratedSection {
  id: string;
  pipeline_run_id: string;
  section_key: string;
  title: string;
  sort_order: number;
  word_limit: number | null;
  drafting_guidance: string | null;
  relevant_corpus_ids: string[];
  status: SectionStatus;
  draft_content: string | null;
  current_content: string | null;
  model_used: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  verification_summary: {
    verified: number;
    failed: number;
    total: number;
    completed_at: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface CitationClaim {
  id: string;
  section_id: string;
  claim_text: string;
  citation_marker: string;
  corpus_entry_id: string | null;
  verification_status: ClaimVerificationStatus;
  verification_notes: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface ReviewCheckpoint {
  id: string;
  pipeline_run_id: string;
  kind: CheckpointKind;
  section_id: string | null;
  status: CheckpointStatus;
  reviewer_id: string | null;
  notes: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface SectionRevision {
  id: string;
  section_id: string;
  revision_number: number;
  previous_content: string | null;
  new_content: string;
  edited_by: string | null;
  edit_reason: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  pipeline_run_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}
