export type Visibility = "writer_only" | "archive";
export type LetterStatus =
  | "outlined" | "drafted" | "fair_copy" | "photographed" | "sealed" | "delivered" | "replied";
export type EnclosureKind = "poem" | "clipping" | "austen" | "object";
export type LibraryStatus = "available" | "reserved" | "used";
export type AustenTier = "published" | "manuscript";
export type BibleCategory =
  | "fixed_canon" | "established_fact" | "promise" | "open_decision" | "name_workshop";
export type ThroughlineKind =
  | "ladder_salutation" | "ladder_closing" | "stella_barometer"
  | "claire_ledger" | "wrong_direction" | "gigi_question";

export const LETTER_STATUSES: LetterStatus[] = [
  "outlined", "drafted", "fair_copy", "photographed", "sealed", "delivered", "replied",
];

export interface Letter {
  id: string; number: number; act: number; title: string | null;
  status: LetterStatus; in_story_date: string | null; sent_date: string | null;
  final_text: string | null; summary: string | null;
  salutation_rung: number | null; closing_rung: number | null;
  poem_id: string | null; photo_paths: string[]; visibility: Visibility;
  created_at: string; updated_at: string;
}

export interface LetterDraft {
  id: string; letter_id: string; version: number; body: string; notes: string | null;
  visibility: "writer_only"; created_at: string; updated_at: string;
}

export interface Enclosure {
  id: string; letter_id: string; kind: EnclosureKind; ref_id: string | null;
  description: string | null; photo_path: string | null; visibility: Visibility;
  created_at: string; updated_at: string;
}

export interface Reply {
  id: string; letter_id: string; received_date: string; body_text: string | null;
  photo_paths: string[]; notes: string | null; visibility: Visibility;
  created_at: string; updated_at: string;
}

export interface ConcordancePhrase {
  id: string; reply_id: string | null; phrase: string; context_note: string | null;
  quoted_back_in_letter_id: string | null; visibility: Visibility;
  created_at: string; updated_at: string;
}

export interface Poem {
  id: string; poet: string; title: string; date_str: string | null; act: number | null;
  theme: string | null; why_it_fits: string | null; deployment_note: string | null;
  status: LibraryStatus; reserved_for_letter_number: number | null;
  used_in_letter_id: string | null; her_reaction: string | null; visibility: Visibility;
}

export interface Clipping {
  id: string; number: number | null; publication: string | null; act: number | null;
  body: string; design_note: string | null; status: LibraryStatus;
  reserved_for_letter_number: number | null; used_in_letter_id: string | null;
  her_reaction: string | null; visibility: Visibility;
}

export interface AustenItem {
  id: string; code: string; tier: AustenTier; title: string; deployment: string | null;
  act: number | null; planned_letter_number: number | null; status: LibraryStatus;
  reserved_for_letter_number: number | null; used_in_letter_id: string | null;
  her_reaction: string | null; guardrails: string | null; visibility: Visibility;
}

export interface BibleFact {
  id: string; category: BibleCategory; body: string;
  established_in_letter_id: string | null; tags: string[]; resolved: boolean;
  visibility: Visibility; created_at: string; updated_at: string;
}

export interface ThroughlineEvent {
  id: string; letter_id: string; kind: ThroughlineKind; value: string | null;
  numeric_value: number | null; visibility: Visibility; created_at: string;
}

export interface JournalEntry {
  id: string; in_story_date: string; body: string; excerpt_marker: boolean;
  sent_with_letter_id: string | null; visibility: Visibility;
}

export interface GuardianFinding {
  severity: "blocker" | "warning" | "note";
  category: "anachronism" | "continuity" | "ladder" | "throughline" | "voice" | "guardrail";
  excerpt: string;
  explanation: string;
  suggestion?: string;
}

export interface GuardianReview {
  id: string; letter_id: string; draft_version: number | null;
  findings: { findings: GuardianFinding[] }; model: string; created_at: string;
}

export interface AppState {
  id: boolean; revealed: boolean; revealed_at: string | null;
  archive_include_concordance: boolean; archive_include_journal: boolean;
  cadence_anchor_date: string | null;
}

export interface LadderConfig {
  salutations: string[];
  closings: string[];
  rules: { max_advance_per_letter: number; retreats_allowed: number; retreat_act: number; note: string };
}
