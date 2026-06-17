-- Evidence-to-Proposal Engine — packets table (Phase 3)
--
-- Saved packets are addressed by an unguessable short slug. There are no user
-- accounts: anyone with the slug URL can view/edit the packet. All access goes
-- through the server function using the service-role key, which bypasses RLS.
-- RLS is enabled with NO policies so the anon/public key cannot read or write
-- the table directly — defense in depth if the anon key is ever exposed.

create table if not exists public.packets (
  slug        text primary key,
  request     text not null default '',
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists packets_updated_at_idx
  on public.packets (updated_at desc);

alter table public.packets enable row level security;
-- Intentionally no policies: only the service role may touch this table.
