# Correspondence

A Next.js + Supabase app with two lives: a private **Writer's Room** (production
tool for a serial, hand-delivered creative project) and a read-only **Archive**
(the finished work as a bound volume, revealed at the end). One data model
serves both; the Archive is a rendering mode, not a rebuild.

> **Privacy note.** This repository is currently public, so the project's canon
> (`seed-docs/`) and all derived seed content (`seeds/`, except the emitter)
> are excluded from git and delivered privately. See `seeds/README.md`.
> Make the repository private before committing that content.

## Stack

Next.js (App Router, TypeScript) · Tailwind · Supabase (Postgres, Auth,
Storage, RLS) · Anthropic API (review-only Guardian) · Vercel-ready.

## Setup

1. **Supabase project**: create one, then run `supabase/migrations/00001_init.sql`
   (SQL editor or `supabase db push`). It creates the schema, the row-level
   security model, the archive-lock triggers, and the private `photos` bucket.
2. **Auth**: create the single writer account manually (Supabase Dashboard →
   Auth → Add user, email + password; confirm it). No signup UI exists.
3. **Env**: copy `.env.example` → `.env` (and Vercel project env) and fill it in.
4. **Seeds**: restore the private seed bundle into `seeds/` and `seed-docs/`
   (see `seeds/README.md`), then:

   ```bash
   npm install
   npm run seed        # loads ~48 poems, 15 clippings, 16 manuscript items,
                       # ladder config, glossary, continuity bible, journal,
                       # Letter 1 — and stamps WRITER_EMAIL with the writer role
   ```

5. **Run**: `npm run dev`

## Acceptance tests (Phase 1)

```bash
npm run test:rls      # anonymous + archive_reader see nothing pre-reveal;
                      # drafts/reviews/name-workshop unreachable regardless
npm run test:export   # export zip round-trips: every table's JSON matches the DB
```

## The visibility model (load-bearing)

- Every content row carries `visibility: writer_only | archive`; enforced by
  **RLS at the database**, never by client filtering.
- The `archive_reader` role (magic-link account, post-reveal) can only ever see
  `visibility='archive'` rows on whitelisted tables.
- `letter_drafts`, `guardian_reviews`, and `bible_facts` (including the name
  workshop) have **no** archive policies — unreachable regardless of toggles.
- **THE FLIP**: Settings → type `REVEAL` → archive content locks read-only at
  the DB level (trigger) and a magic link is minted for the reader. Re-running
  mints a fresh link; it never unbinds.

## Notes

- The in-story calendar is 1817; all `in_story_date` fields accept 1817 dates.
- The Guardian reviews (anachronisms, continuity, ladder, through-lines, voice,
  guardrails) and returns severity-tagged findings. It does not write. AI
  drafting is deliberately out of scope — decision on record.
- Export (Settings → "Export everything") streams one zip: full-database JSON
  including writer-only rows, all Storage media, and `seed-docs/`.
