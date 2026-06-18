# Deploy — Evidence-to-Proposal Engine

The app lives in the **`evidence-to-proposal-engine/`** subfolder of this repo. It
is a Vite static frontend + Netlify Functions backend (so the Anthropic API key
never reaches the browser) + Supabase for save/revisit. Two paths below —
**Git-connected is recommended** (auto-deploys on push).

---

## Step 0 — Gather your secrets first

You need three values. Two are already provisioned; one you create.

| Var | Required? | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | console.anthropic.com → API keys |
| `SUPABASE_URL` | For save/revisit | `https://txdfrstzrlfsalqejoqj.supabase.co` (already provisioned) |
| `SUPABASE_SERVICE_ROLE_KEY` | For save/revisit | Supabase dashboard → Project Settings → API → `service_role` secret |

> Without the two Supabase vars the site still runs fine — Save/links just stay
> hidden. Without `ANTHROPIC_API_KEY` the functions return a clean 500.

**Optional overrides** (all have sane defaults — skip unless tuning):

| Var | Default |
|---|---|
| `SYNTHESIS_MODEL` | `claude-opus-4-8` |
| `STRUCTURING_MODEL` | `claude-haiku-4-5` |
| `RETRIEVAL_MODEL` | `claude-opus-4-8` |
| `SYNTHESIS_EFFORT` | `medium` |
| `CONSENSUS_MCP_URL` | public Consensus MCP endpoint (no key needed) |

---

## Path A — Git-connected (recommended)

1. **Netlify → Add new site → Import an existing project →** pick GitHub → this repo.
2. On the configure screen, set **Base directory** to:
   ```
   evidence-to-proposal-engine
   ```
   This is the key step, since the app is in a subfolder. Build command
   (`npm run build`), publish (`dist`), and functions (`netlify/functions`) are
   read automatically from the committed `netlify.toml` and resolve **relative to
   that base**.
3. **Add environment variables** (Step 0 table) — here, or later under Site
   configuration → Environment variables. Mark the two secrets as **secret**.
4. **Deploy site.** The first build runs `tsc -b && vite build`, bundles the three
   functions with esbuild, and publishes.
5. Confirm it's live: open the site, generate a packet (exercises `/api/section`
   + `/api/consensus`), then **Save & get link** (exercises `/api/packets` +
   Supabase).

Every push now auto-deploys. Point the production branch at whatever you merge into.

---

## Path B — Netlify CLI (one-off / manual)

From inside the app folder:

```bash
cd evidence-to-proposal-engine
npm i -g netlify-cli        # if not installed
netlify login
netlify init                # link to a new or existing site

# set env vars
netlify env:set ANTHROPIC_API_KEY "sk-ant-..."
netlify env:set SUPABASE_URL "https://txdfrstzrlfsalqejoqj.supabase.co"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "<service_role secret>"

netlify deploy --build --prod
```

Local smoke test before deploying (serves frontend + functions together on
`:8888`, per the `[dev]` block in `netlify.toml`):

```bash
netlify dev
```

---

## Database (already done — here for completeness)

The `packets` table is already created in the provisioned Supabase project, with
**RLS on, service-role-only access**. For a *fresh* project, apply the migration
in `supabase/` and re-point `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

---

## How the pieces wire up at runtime

- `netlify.toml` redirects `/api/*` → `/.netlify/functions/:splat`, so the
  frontend calls clean paths (`/api/section`, `/api/consensus`, `/api/packets`).
- `included_files = ["shared/**"]` ensures the functions' shared TS (anchors,
  types) gets bundled.
- The SPA fallback redirect sends all other routes to `index.html`, so
  `/p/<slug>` revisit links resolve client-side.
- The `service_role` key is server-only in function env — the browser never sees it.

---

## Verification checklist

- [ ] Site loads, styling intact
- [ ] Generating a packet streams sections (functions + Anthropic key OK)
- [ ] Consensus citations appear (MCP reachable)
- [ ] **Save & get link** returns a `/p/<slug>` URL, and revisiting it restores the packet (Supabase OK)
- [ ] **Word .docx** downloads; **PDF** opens the print dialog (allow pop-ups)

If Save is hidden, the two Supabase vars aren't set/propagated — re-check them and
redeploy (env changes need a new deploy to take effect).
