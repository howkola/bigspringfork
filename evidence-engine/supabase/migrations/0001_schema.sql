-- Evidence-to-Proposal Research Engine — core schema
-- Project Harmony Child Advocacy Center

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.team_role as enum ('admin', 'grant_writer', 'reviewer');

create type public.corpus_source_type as enum (
  'peer_reviewed_study',
  'government_report',
  'internal_program_data',
  'evaluation_report',
  'news_or_media',
  'other'
);

create type public.confidence_level as enum ('high', 'medium', 'low');

create type public.grant_status as enum ('prospect', 'active', 'submitted', 'awarded', 'declined', 'archived');

create type public.pipeline_stage as enum (
  'intake',
  'intake_review',
  'drafting',
  'citation_verification',
  'section_review',
  'assembly',
  'final_review',
  'completed'
);

create type public.run_status as enum ('active', 'failed', 'cancelled', 'completed');

create type public.section_status as enum (
  'planned',
  'drafting',
  'drafted',
  'verifying',
  'verification_failed',
  'awaiting_review',
  'changes_requested',
  'approved',
  'final'
);

create type public.claim_verification_status as enum (
  'pending',
  'verified',
  'unsupported',
  'partially_supported',
  'missing_source',
  'stale_source'
);

create type public.checkpoint_kind as enum ('intake_review', 'section_review', 'final_review');

create type public.checkpoint_status as enum ('pending', 'approved', 'rejected', 'changes_requested');

-- ---------------------------------------------------------------------------
-- Team membership (auth is scoped to the grants team, not public)
-- ---------------------------------------------------------------------------

-- Emails allowed to activate an account. Managed by an admin (or seed SQL).
create table public.team_allowlist (
  email text primary key check (email = lower(email)),
  role public.team_role not null default 'grant_writer',
  added_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.team_role not null default 'grant_writer',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Activate accounts only for allowlisted emails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  allow_row public.team_allowlist%rowtype;
begin
  select * into allow_row from public.team_allowlist where email = lower(new.email);
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(allow_row.role, 'grant_writer'),
    allow_row.email is not null
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- True when the calling user is an active grants-team member.
create or replace function public.is_grants_team()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$$;

create or replace function public.is_team_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Citation corpus
-- ---------------------------------------------------------------------------

create table public.corpus_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type public.corpus_source_type not null default 'other',
  authors text,
  publication text,
  publication_year int check (publication_year between 1900 and 2100),
  url text,
  -- The evidence itself: what the source says, quotable findings.
  summary text not null,
  key_findings text[] not null default '{}',
  tags text[] not null default '{}',
  -- Confidence in the strength/quality of the evidence.
  confidence public.confidence_level not null default 'medium',
  -- Freshness: when a human last confirmed the source is still valid,
  -- and when it must be re-verified before use.
  last_verified_at timestamptz not null default now(),
  stale_after timestamptz not null default now() + interval '12 months',
  is_archived boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index corpus_entries_stale_after_idx on public.corpus_entries (stale_after);
create index corpus_entries_tags_idx on public.corpus_entries using gin (tags);

create or replace function public.corpus_entry_is_stale(entry public.corpus_entries)
returns boolean
language sql
stable
as $$
  select entry.stale_after <= now();
$$;

-- ---------------------------------------------------------------------------
-- Grant opportunities
-- ---------------------------------------------------------------------------

create table public.grant_opportunities (
  id uuid primary key default gen_random_uuid(),
  funder text not null,
  title text not null,
  description text not null default '',
  focus_areas text[] not null default '{}',
  amount_min numeric,
  amount_max numeric,
  deadline date,
  -- Funder requirements the pipeline must satisfy, e.g. required narrative
  -- sections and word limits: [{"key": "need_statement", "title": "...", "word_limit": 750}]
  required_sections jsonb not null default '[]',
  guidelines_url text,
  status public.grant_status not null default 'prospect',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pipeline runs
-- ---------------------------------------------------------------------------

create table public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  grant_opportunity_id uuid not null references public.grant_opportunities (id),
  stage public.pipeline_stage not null default 'intake',
  status public.run_status not null default 'active',
  -- Output of the intake analysis: fit assessment + section plan.
  intake_analysis jsonb,
  -- Final assembled proposal (set at assembly stage).
  assembled_document text,
  executive_summary text,
  -- Error bookkeeping for mid-pipeline API failures.
  last_error jsonb,
  failed_stage public.pipeline_stage,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index pipeline_runs_grant_idx on public.pipeline_runs (grant_opportunity_id);

-- ---------------------------------------------------------------------------
-- Generated sections
-- ---------------------------------------------------------------------------

create table public.generated_sections (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references public.pipeline_runs (id) on delete cascade,
  section_key text not null,
  title text not null,
  sort_order int not null default 0,
  word_limit int,
  -- Guidance produced at intake for what this section must cover.
  drafting_guidance text,
  -- Corpus entries the intake stage selected as relevant evidence.
  relevant_corpus_ids uuid[] not null default '{}',
  status public.section_status not null default 'planned',
  -- Original model draft (immutable once written) and the current working text.
  draft_content text,
  current_content text,
  model_used text,
  input_tokens int,
  output_tokens int,
  verification_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_run_id, section_key)
);

create index generated_sections_run_idx on public.generated_sections (pipeline_run_id);

-- ---------------------------------------------------------------------------
-- Citation-to-claim mapping
-- ---------------------------------------------------------------------------

create table public.citation_claims (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.generated_sections (id) on delete cascade,
  -- The factual claim as written in the section text.
  claim_text text not null,
  -- Inline marker used in the section content, e.g. [C1].
  citation_marker text not null,
  -- Null when the model cited a source that does not exist in the corpus —
  -- that is a hard verification failure (missing_source), never silently kept.
  corpus_entry_id uuid references public.corpus_entries (id),
  verification_status public.claim_verification_status not null default 'pending',
  verification_notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index citation_claims_section_idx on public.citation_claims (section_id);
create index citation_claims_corpus_idx on public.citation_claims (corpus_entry_id);
create index citation_claims_status_idx on public.citation_claims (verification_status);

-- ---------------------------------------------------------------------------
-- Human review checkpoints
-- ---------------------------------------------------------------------------

create table public.review_checkpoints (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references public.pipeline_runs (id) on delete cascade,
  kind public.checkpoint_kind not null,
  -- Null for run-level checkpoints (intake_review, final_review).
  section_id uuid references public.generated_sections (id) on delete cascade,
  status public.checkpoint_status not null default 'pending',
  reviewer_id uuid references public.profiles (id),
  notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index review_checkpoints_run_idx on public.review_checkpoints (pipeline_run_id);

-- ---------------------------------------------------------------------------
-- Section revisions (edit history for the audit trail)
-- ---------------------------------------------------------------------------

create table public.section_revisions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.generated_sections (id) on delete cascade,
  revision_number int not null,
  previous_content text,
  new_content text not null,
  edited_by uuid references public.profiles (id),
  edit_reason text,
  created_at timestamptz not null default now(),
  unique (section_id, revision_number)
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  pipeline_run_id uuid references public.pipeline_runs (id) on delete set null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_run_idx on public.audit_log (pipeline_run_id);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger corpus_entries_touch before update on public.corpus_entries
  for each row execute function public.touch_updated_at();
create trigger grant_opportunities_touch before update on public.grant_opportunities
  for each row execute function public.touch_updated_at();
create trigger pipeline_runs_touch before update on public.pipeline_runs
  for each row execute function public.touch_updated_at();
create trigger generated_sections_touch before update on public.generated_sections
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Citation integrity HARD GATE (database level)
--
-- A section can never move to awaiting_review / approved / final while any of
-- its claims is unverified, unsupported, missing its source, or stale.
-- The application enforces this too, but the database is the backstop: even a
-- buggy or bypassed API route cannot push an unverified section forward.
-- ---------------------------------------------------------------------------

create or replace function public.assert_section_citation_gate()
returns trigger
language plpgsql
as $$
declare
  bad_count int;
  total_count int;
begin
  if new.status in ('awaiting_review', 'approved', 'final')
     and new.status is distinct from old.status then
    select count(*) filter (where verification_status <> 'verified'),
           count(*)
      into bad_count, total_count
      from public.citation_claims
     where section_id = new.id;

    if total_count = 0 then
      raise exception 'citation gate: section % has no citation claims recorded; every section must trace its claims to the corpus before advancing', new.id
        using errcode = 'P0001';
    end if;

    if bad_count > 0 then
      raise exception 'citation gate: section % has % unverified/failed citation claim(s); it cannot advance to %', new.id, bad_count, new.status
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger generated_sections_citation_gate
  before update on public.generated_sections
  for each row execute function public.assert_section_citation_gate();

-- Run-level gate: assembly and completion require every section approved and
-- every claim verified.
create or replace function public.assert_run_assembly_gate()
returns trigger
language plpgsql
as $$
declare
  unapproved int;
  bad_claims int;
begin
  if new.stage in ('assembly', 'final_review', 'completed')
     and new.stage is distinct from old.stage then
    select count(*) into unapproved
      from public.generated_sections
     where pipeline_run_id = new.id
       and status not in ('approved', 'final');

    if unapproved > 0 then
      raise exception 'assembly gate: run % has % section(s) not yet approved', new.id, unapproved
        using errcode = 'P0001';
    end if;

    select count(*) into bad_claims
      from public.citation_claims cc
      join public.generated_sections gs on gs.id = cc.section_id
     where gs.pipeline_run_id = new.id
       and cc.verification_status <> 'verified';

    if bad_claims > 0 then
      raise exception 'assembly gate: run % has % citation claim(s) that are not verified', new.id, bad_claims
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger pipeline_runs_assembly_gate
  before update on public.pipeline_runs
  for each row execute function public.assert_run_assembly_gate();

-- ---------------------------------------------------------------------------
-- Freshness sweep: flag verified claims whose source has gone stale.
-- Returns the number of claims flagged. Called by the freshness API route
-- (and safe to run on a schedule via pg_cron or Supabase scheduled functions).
-- ---------------------------------------------------------------------------

create or replace function public.flag_stale_citations()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  flagged int;
begin
  with stale as (
    update public.citation_claims cc
       set verification_status = 'stale_source',
           verification_notes = coalesce(verification_notes || E'\n', '')
             || 'Flagged by freshness monitor on ' || now()::date
             || ': cited corpus entry passed its stale_after date and must be re-verified.'
      from public.corpus_entries ce
     where cc.corpus_entry_id = ce.id
       and ce.stale_after <= now()
       and cc.verification_status = 'verified'
       -- Only claims in runs that are still in flight; completed proposals keep
       -- their historical verification record.
       and exists (
         select 1
           from public.generated_sections gs
           join public.pipeline_runs pr on pr.id = gs.pipeline_run_id
          where gs.id = cc.section_id
            and pr.status = 'active'
            and pr.stage <> 'completed'
       )
     returning cc.id
  )
  select count(*) into flagged from stale;
  return flagged;
end;
$$;
