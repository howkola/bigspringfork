# Seeds

**This directory is intentionally almost empty in git.**

The structured seed data (poems, clippings, manuscript items, ladder config,
glossary, continuity facts, journal entries, Letter 1) is derived from the
project's canon in `../seed-docs/`. That content is private: it contains
surprises for a real person — a hidden backstory, an unrevealed name, and the
story's ending.

Because this repository is currently **public**, both `seed-docs/` and the
seed content here are excluded by `.gitignore`. The full seed bundle
(`seeds/src/*.mjs` + emitted `seeds/json/*.json`) is delivered privately
alongside this build. To restore it:

1. Unzip the private seed bundle into `correspondence/seeds/` and
   `correspondence/seed-docs/`.
2. `npm run seeds:build` — emits `seeds/json/*.json` from `seeds/src/`.
3. `npm run seed` — loads everything into Supabase (needs `.env`, see
   `../README.md`).

Once the repository is private (as the project handoff requires), remove the
privacy-guard block from `correspondence/.gitignore` and commit the seeds
alongside the markdown sources, per the spec.
