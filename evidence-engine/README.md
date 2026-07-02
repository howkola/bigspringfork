# Evidence-to-Proposal Research Engine

Production Next.js + Supabase implementation of the Evidence-to-Proposal
Research Engine for **Project Harmony Child Advocacy Center**. It takes a
grant opportunity plus the team's citation corpus and produces
proposal-ready narrative sections through a staged pipeline with citation
integrity guardrails and human review checkpoints.

## Pipeline

```
intake ─▶ intake review ─▶ drafting ─▶ citation verification ─▶
section review ─▶ assembly ─▶ final review ─▶ completed
        (human)                 (HARD GATE)      (human)                (human)
```

| Stage | What happens | Anthropic call |
|---|---|---|
| **Intake** | Grant analyzed against the *fresh* corpus; fit score, risks, and a per-section drafting plan | 1 structured-output call |
| **Intake review** | Human approves/rejects the plan | — |
| **Drafting** | Each section drafted with inline `[C#]` markers and a claim→corpus mapping | 1 call per section |
| **Citation verification** | Every claim independently audited against its cited source | 1 call per section |
| **Section review** | Human approves, requests changes, or edits each section | — |
| **Assembly** | Deterministic stitch of approved sections + unified reference list; model writes only the executive summary | 1 call |
| **Final review** | Human approves the assembled proposal | — |

## Citation integrity — the hard gate

No section can advance to review, approval, or the final document while any
of its claims is unverified. The gate is enforced **twice**:

1. **Application level** — `lib/pipeline/citations.ts` (`sectionGatePasses`)
   drives every stage route.
2. **Database level** — Postgres triggers
   (`assert_section_citation_gate`, `assert_run_assembly_gate` in
   `supabase/migrations/0001_schema.sql`) reject the transition even if the
   application is bypassed or buggy.

Failure modes are explicit, never silent:

- **Fabricated citation** (`missing_source`) — the model cited a
  `corpus_entry_id` that doesn't exist or wasn't offered. The id is dropped
  and the claim blocks the section.
- **Unsupported / partially supported** — the verification model compared
  the claim against the source and it doesn't hold (numbers must match
  exactly).
- **Stale source** (`stale_source`) — the cited corpus entry passed its
  `stale_after` deadline. The freshness monitor (`POST /api/freshness`)
  flags verified claims in active runs when sources go stale and demotes
  affected sections out of review. Re-verifying the source in the corpus UI
  requeues the claims.
- **Missing corpus entry mid-run** — a source deleted between drafting and
  verification hard-fails the claim rather than skipping it.

Stale or archived corpus entries are never offered to the model in the
first place.

## Error handling mid-pipeline

Every Anthropic call is wrapped (`lib/anthropic.ts`): typed SDK errors map
to a `retryable` flag, the failure is persisted on the run
(`last_error`, `failed_stage`, status `failed`), and the UI surfaces a
retry banner. Stage endpoints are idempotent — re-running drafting skips
already-drafted sections, so a run resumes where it stopped. Malformed or
schema-violating model output is rejected by Zod validation before anything
touches the database.

## Review & audit

- Approve / reject / request-changes at every checkpoint, with notes.
- Manual edits require an edit reason, create a numbered
  `section_revisions` row (before/after content), and automatically prune
  claims whose markers were deleted — the claim map always matches the
  text. Editing an approved section knocks it back to review; an edit that
  breaks the gate demotes the section to `verification_failed`.
- `audit_log` is append-only (no update/delete RLS policies) and records
  every pipeline action, decision, edit, and freshness event. See the
  **Audit trail** page.

## Auth — grants team only

Supabase email/password auth plus an allowlist:

1. An admin inserts team emails into `team_allowlist` (see
   `supabase/seed.sql`).
2. On signup, a trigger creates a `profiles` row; accounts are **active only
   if the email is allowlisted**.
3. Row Level Security on every table checks `is_grants_team()` — non-team
   users see nothing, even with a valid session. Middleware + page guards
   handle redirects; API routes re-check membership on every request.

## Setup

### 1. Supabase

```bash
# New project at https://supabase.com, then run migrations in order:
#   supabase/migrations/0001_schema.sql
#   supabase/migrations/0002_rls.sql
#   supabase/seed.sql   (edit the allowlist emails first!)
# via the SQL editor, or with the CLI:
supabase link --project-ref <your-ref>
supabase db push        # applies migrations/
psql "$DATABASE_URL" -f supabase/seed.sql
```

Optionally schedule the freshness sweep with pg_cron:

```sql
select cron.schedule('freshness-sweep', '0 6 * * *', $$select public.flag_stale_citations()$$);
```

### 2. App

```bash
cd evidence-engine
npm install
cp .env.example .env.local   # fill in Supabase URL/anon key + ANTHROPIC_API_KEY
npm run dev
```

Sign up with an allowlisted email, add corpus entries and a grant
opportunity (seed data provides both), then start a run.

### 3. Deploy

Any Node host works (Vercel, Fly, Render…). Set the three env vars. The
pipeline stage routes set `maxDuration = 300` — on Vercel this requires a
plan that allows long function durations; on a self-hosted Node server it
just works.

## Commands

```bash
npm run dev        # local dev server
npm run build      # production build
npm run test       # vitest unit tests (gate logic, assembly, stage machine)
npm run typecheck  # tsc --noEmit
```

## Layout

```
supabase/migrations/   schema, RLS, hard-gate triggers, freshness function
supabase/seed.sql      allowlist + starter corpus + sample grant
lib/anthropic.ts       model wrapper: structured output, retries, typed errors
lib/pipeline/          prompts, JSON+Zod schemas, gate logic, stage machine, assembly
app/api/               stage endpoints + CRUD + freshness sweep
app/                   dashboard, run review UI, corpus, grants, audit trail
tests/                 unit tests for the citation gate and assembly
```
