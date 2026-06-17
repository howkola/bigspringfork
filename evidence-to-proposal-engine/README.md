# Evidence-to-Proposal Research Engine — Live Build

A grant research engine for an NCA-accredited Children's Advocacy Center. It
retrieves peer-reviewed evidence via the **Consensus** MCP server, anchors it to
a seeded library (OJJDP Model Programs Guide CAC literature review), and drafts a
ten-section evidence packet under strict **closed-corpus citation** rules with a
human review gate.

This is the **live** version of the original single-file artifact. The key
architectural change: every Anthropic and Consensus call runs inside **Netlify
Functions**, so the API key never reaches the browser.

> ⚠️ Drafting aid only. All citations, statistics, and `{{LOCAL: ...}}`
> placeholders must be human-verified before any submission. Never include
> identifying case details in narratives.

## Architecture

```
Browser (React + Vite SPA)
   │  POST /api/consensus, /api/section   (no API key in the client)
   ▼
Netlify Functions (Node + @anthropic-ai/sdk)
   ├─ consensus.ts  → Anthropic + Consensus MCP retrieval, then a cheap
   │                  structuring pass into [C#] citation entries
   └─ section.ts    → cited synthesis, one section per call (plain markdown)
   ▼
api.anthropic.com
```

Single source of truth for the anchor library, section definitions, prompts, and
parsers lives in `shared/`, imported by both the client and the functions.

## Project layout

```
shared/            anchors, prompts, parsers, types (client + server)
src/               React app
  components/      EvidenceToProposalEngine, SectionHead
  lib/             api client, markdown renderer, markdown export
netlify/functions/ consensus.ts, section.ts, lib/anthropic.ts
```

## Local development

1. `npm install`
2. Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`.
3. Install the Netlify CLI if needed: `npm i -g netlify-cli`
4. `npm run netlify` — serves the Vite app and the functions together at
   <http://localhost:8888> (functions reachable at `/api/*`).

`npm run dev` alone serves only the frontend; it proxies `/api/*` to
`localhost:8888`, so the functions need `netlify dev` running for the pipeline to
work.

## Deploy (Netlify)

- Build command: `npm run build` · Publish dir: `dist` · Functions dir: `netlify/functions`
- Set `ANTHROPIC_API_KEY` in the Netlify site environment variables.
- `netlify.toml` wires the `/api/*` redirect and the SPA fallback.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Server-side only. |
| `SYNTHESIS_MODEL` | `claude-opus-4-8` | Section drafting. |
| `STRUCTURING_MODEL` | `claude-haiku-4-5` | Consensus → `[C#]` extraction. |
| `RETRIEVAL_MODEL` | `claude-opus-4-8` | Drives Consensus MCP searches. |
| `SYNTHESIS_EFFORT` | `medium` | Effort for section drafts (see streaming note). |
| `CONSENSUS_MCP_URL` | `https://mcp.consensus.app/mcp` | Consensus MCP endpoint. |

### Streaming (Phase 2)

Both endpoints respond with **Server-Sent Events**:

- `/api/section` streams markdown token-by-token (`delta` frames) plus `status`
  frames (`thinking` / `writing`) and a terminal `done` frame carrying the
  truncation flag. The browser renders each section live.
- `/api/consensus` streams `status` frames while the (potentially slow) MCP
  search loop runs, then a single `result` frame with the citations.

Streaming improves time-to-first-token and keeps the connection warm during long
retrievals/generations, so `SYNTHESIS_EFFORT` now defaults to `medium`. Raise it
toward `high` as your Netlify plan's function duration allows.

## Roadmap

- **Phase 1 (done):** runs live, key safe, end-to-end with current models.
- **Phase 2 (done):** stream sections token-by-token; streamed Consensus status.
- **Phase 3:** save & revisit packets (Supabase, shareable slug, no accounts).
- **Phase 4:** inline section editing + real DOCX/PDF export.
