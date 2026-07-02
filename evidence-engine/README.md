# Evidence-to-Proposal Engine (live)

A standalone web app for a small grant-writing team. Its core workflow is
**research-backed drafting**: state a claim in a grant narrative → find
supporting studies → adversarially verify them → have Claude draft the passage
with inline citations. All work is team-shared and org-scoped.

This lives alongside (and is independent of) the Baker Writing Hugo site in this
repo. Deploy it as its **own** Netlify site.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind (`web/`), deployed on Netlify.
- **Backend:** Supabase — Postgres (with RLS), Auth, and Edge Functions (`supabase/`).
- **Research source:** [OpenAlex](https://docs.openalex.org) (free, no API key).
- **AI:** Claude (`claude-opus-4-8`) via the Anthropic SDK, called only from
  edge functions so the API key never reaches the browser.

```
Browser (React, Netlify)
  │ supabase-js (auth + data, RLS-scoped)   │ functions.invoke
  ▼                                         ▼
Supabase Postgres                         Edge Functions (Deno)
                                            ├─ research-search → OpenAlex
                                            ├─ draft-section   → Claude (structured)
                                            └─ verify-citation → Claude (adversarial)
```

## Layout

```
evidence-engine/
├── supabase/
│   ├── config.toml
│   ├── migrations/0001_init.sql        # schema + RLS + auth trigger
│   └── functions/
│       ├── _shared/{cors,auth,anthropic,openalex}.ts
│       ├── research-search/index.ts
│       ├── draft-section/index.ts
│       └── verify-citation/index.ts
└── web/                                 # Vite React app (its own Netlify site)
    └── src/{lib,auth,routes,components}
```

## Setup

### 1. Supabase project

```bash
# From evidence-engine/
supabase link --project-ref <your-ref>      # or `supabase start` for local
supabase db push                            # applies migrations/0001_init.sql
supabase functions deploy research-search draft-section verify-citation

# Secret used by draft-section / verify-citation (server-side only):
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Optional: identify your app to OpenAlex's "polite pool":
supabase secrets set OPENALEX_MAILTO=you@yourteam.org
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected into functions automatically.

### 2. Web app

```bash
cd web
cp .env.example .env.local     # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
npm run dev                    # http://localhost:5173
```

### 3. Netlify

Create a **new** Netlify site from this repo with **Base directory = `evidence-engine/web`**
(the `netlify.toml` there handles build + SPA redirects). Set env vars
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Netlify UI.

## How it works

1. **Sign up** → the `on_auth_user_created` trigger creates an organization and a
   profile (first user = `owner`). Teammates join by signing up with the org's id
   in signup metadata, or via Supabase dashboard invite for v1.
2. **Create a proposal**, add **sections**, and within a section add **claims**.
3. Per claim, **Find evidence** queries OpenAlex; **Verify** runs the adversarial
   check (`supports` / `weak` / `contradicts`); **Attach** saves the citation.
4. **Draft with evidence** rewrites the section body weaving in attached
   (non-contradicting) citations with `[id]` markers.
5. The **Bibliography** panel de-dupes and exports a reference list.

## Verify end-to-end

- **Research:** add a claim like *"art therapy reduces PTSD symptoms in veterans"*
  → Find evidence → real OpenAlex papers with abstracts appear.
- **Integrity:** Verify a clearly off-topic paper → returns `weak`/`contradicts`,
  not `supports`.
- **Drafting:** attach 2–3 papers → Draft with evidence → passage cites them inline.
- **RLS:** sign in as a second org's user → none of the first org's proposals are
  visible (test against the API, not just the UI).
- **Secret safety:** `grep -r ANTHROPIC web/dist` after a build → no match.

## Notes / next steps

- Swap the untyped Supabase client for generated types:
  `supabase gen types typescript --project-id <ref> > web/src/lib/database.types.ts`.
- Reference export is a plain author-date list; add funder-specific styles
  (APA, etc.) as needed.
- v1 uses Supabase-dashboard invites for teammates; in-app invites are a later add.
