# Project Harmony — Live Evidence → Proposal Engine

An advanced, *live* version of the Cited Need Statement Builder. Instead of a
hand-maintained corpus, this engine keeps Project Harmony's evidence
continuously verified against primary sources, backs it with peer-reviewed
efficacy research, and matches it to live funders — assembling cited need
statements with an integrity report attached.

Project Harmony specific. Not multi-tenant.

## The upgrade over v1
| v1 (static corpus) | This engine (live) |
| --- | --- |
| Claims hand-compiled | Claims verified live via **Exa** against primary sources |
| Verification by hand | Automated verify + freshness loop; vintage drift flagged |
| Need/prevalence data only | Need claims paired with **Consensus** efficacy evidence |
| Funder fit judged manually | Live matches + deadlines via **Instrumentl** projects |
| Prose document | Structured, revalidating corpus + Honest Draft report |

## Layout
```
evidence-engine/
  corpus/
    schema.json     # the claim data contract
    matys.json      # first slice: Missing & Trafficked Youth Services (T-series)
  scripts/
    corpus.py       # local query / assemble / report (no network, stdlib only)
.claude/skills/
  evidence-proposal-engine/
    SKILL.md        # how Claude orchestrates Exa + Consensus + Instrumentl
```

## Quick start
```bash
# What's in the MATYS slice, and what needs revalidation today?
python3 evidence-engine/scripts/corpus.py list  evidence-engine/corpus/matys.json --program Anti-Trafficking
python3 evidence-engine/scripts/corpus.py stale evidence-engine/corpus/matys.json --today 2026-07-02

# Draft a cited need statement for a federal anti-trafficking funder
python3 evidence-engine/scripts/corpus.py assemble evidence-engine/corpus/matys.json \
    --program Anti-Trafficking --lens Federal
```

Then invoke the **evidence-proposal-engine** skill in Claude to run the live
verify → enrich → match → assemble loop and write results back to the corpus.

## Corpus policy
**Persist + revalidate.** Verified claims stay on disk; each run re-checks
freshness and only refetches stale ones (unverified status, no timestamp, or a
timestamp older than the freshness window).

## Instrumentl project ↔ program map (bound at match time)
| Instrumentl project | Corpus programs |
| --- | --- |
| MATYS | Anti-Trafficking, Missing Youth |
| Connections / Mental Health | Connections, MH |
| Training | Training, Prevention |
| Response Services | CFS, MDT, Triage, Advocacy |
| Prosecutor/Trial Assistant | MDT, legal outcomes |
