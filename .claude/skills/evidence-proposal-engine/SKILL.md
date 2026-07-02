---
name: evidence-proposal-engine
description: Project Harmony's live evidence→proposal engine. Use when building or refreshing a cited need statement for a Project Harmony grant proposal — it revalidates corpus claims against primary sources (Exa), attaches peer-reviewed efficacy evidence (Consensus), matches live funders and deadlines (Instrumentl), and assembles a cited need statement with an Honest Draft integrity report. Corpus and helpers live in evidence-engine/.
---

# Project Harmony — Live Evidence → Proposal Engine

Turns Project Harmony's static citation corpus into a self-verifying pipeline.
Every figure that goes into a proposal is confirmed against its primary source,
its vintage is checked, and what still needs a human is surfaced explicitly.
This operationalizes the **Honest Draft Standard**: human accountability,
truthful representation, citation integrity, data stewardship, disclosure
readiness.

## Where things live
- `evidence-engine/corpus/schema.json` — the claim schema (the data contract).
- `evidence-engine/corpus/*.json` — the corpus, one file per domain/slice
  (start: `matys.json`).
- `evidence-engine/scripts/corpus.py` — local, network-free query/assemble/report
  helper. Retrieval and verification are done by *you* via MCP tools, not by this
  script.

## Corpus policy: persist + revalidate
Verified claims persist on disk so value compounds. On each use, re-check
freshness and only refetch when a claim is stale. A claim is stale when its
`status` is `VERIFY`/`PULL`, when it has no `last_verified`, or when
`last_verified` is older than the freshness window (`corpus.py stale`).

## The four-phase run

### Phase 1 — Verify + freshness loop (Exa)
For each stale claim in the requested slice:
1. `web_search_exa` for the figure + its cited source. Prefer the primary
   source (agency PDF, official data page) over aggregators.
2. If the figure matches the primary source → set `status: VERIFIED-WEB`,
   fill `source_url`, stamp `last_verified` (ask the user for today's date or
   use the session date — never invent one).
3. If a newer edition/vintage exists → keep the current figure but record the
   drift in `expiry` and, if the number changed, add a `red_team_flag` and
   flag it for human review.
4. For `PULL` claims, retrieve the figure from the identified source and
   promote to `VERIFIED-WEB` once confirmed; if it can't be pulled, leave as
   `PULL` and list it as human-required.
5. Always run the claim's existing `red_team_flags` as guards (e.g. vintage,
   definitional incomparability, reporting-mandate artifacts).

### Phase 2 — Efficacy enrichment (Consensus)
For each program in the slice, `search` Consensus for peer-reviewed evidence
that the program model works, and attach the best 1–3 to `efficacy_evidence`
(title, url, cite, one-line finding). This pairs each *need* claim with
*this-model-works* backing. Follow Consensus citation rules: cite inline with
numbered refs and list linked references.

### Phase 3 — Funder matching (Instrumentl)
1. Map the program to its Instrumentl project (e.g. MATYS →
   `proj_018b242b6c347c7bbe84f4e5c14cb1a9`).
2. `list_project_matches` (recommendations) or `list_saved_grants` (tracker) —
   disambiguate with the user which they mean.
3. Read the funder profile + deadline; infer the funder lens (Federal /
   Foundation / State / Corporate-Tech …) and use it to select the corpus
   subset for assembly.

### Phase 4 — Assemble + Honest Draft report
Run `corpus.py assemble` (or assemble narratively) to emit the cited need
statement + source appendix, then the integrity report: VERIFIED vs.
needs-review, stale items, and every red-team flag that fired. Never present a
claim as verified without a resolving `source_url`.

## Guardrails
- Bind claims to the funder via the corpus `lenses`; don't overstate fit.
- Nebraska (substantiation) and Iowa (founded/confirmed) counts are **not
  comparable** — present side by side, never summed.
- Hotline/CyberTipline counts are reporting volume, not prevalence — say so.
- Write updates back to the corpus JSON so the next run starts fresher.
