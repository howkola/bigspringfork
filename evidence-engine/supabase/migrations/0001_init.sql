-- Evidence-to-Proposal Engine — initial schema
-- Multi-tenant (org-scoped), team-shared, RLS-enforced.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- One profile per auth user. Carries org membership + role.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'member' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now()
);
create index profiles_org_id_idx on public.profiles (org_id);

create table public.proposals (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  title       text not null,
  funder      text,
  program     text,
  status      text not null default 'draft'
              check (status in ('draft', 'in_review', 'submitted', 'awarded', 'declined')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index proposals_org_id_idx on public.proposals (org_id);

create table public.proposal_sections (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.proposals (id) on delete cascade,
  org_id       uuid not null references public.organizations (id) on delete cascade,
  heading      text not null default 'Untitled section',
  body         text not null default '',
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index proposal_sections_proposal_id_idx on public.proposal_sections (proposal_id);
create index proposal_sections_org_id_idx on public.proposal_sections (org_id);

create table public.claims (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references public.proposal_sections (id) on delete cascade,
  org_id       uuid not null references public.organizations (id) on delete cascade,
  text         text not null,
  status       text not null default 'needs_evidence'
               check (status in ('needs_evidence', 'supported', 'rejected')),
  created_at   timestamptz not null default now()
);
create index claims_section_id_idx on public.claims (section_id);
create index claims_org_id_idx on public.claims (org_id);

create table public.citations (
  id                uuid primary key default gen_random_uuid(),
  claim_id          uuid not null references public.claims (id) on delete cascade,
  org_id            uuid not null references public.organizations (id) on delete cascade,
  title             text not null,
  authors           text,
  year              integer,
  venue             text,
  doi               text,
  url               text,
  abstract_snippet  text,
  relevance         real,
  verdict           text check (verdict in ('supports', 'weak', 'contradicts')),
  verdict_rationale text,
  openalex_id       text,
  created_at        timestamptz not null default now()
);
create index citations_claim_id_idx on public.citations (claim_id);
create index citations_org_id_idx on public.citations (org_id);

-- Optional cache for OpenAlex lookups (org-scoped so RLS stays uniform).
create table public.research_cache (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  query_hash  text not null,
  results     jsonb not null,
  created_at  timestamptz not null default now(),
  unique (org_id, query_hash)
);
create index research_cache_lookup_idx on public.research_cache (org_id, query_hash);

-- ---------------------------------------------------------------------------
-- Helper: current user's org_id (SECURITY DEFINER avoids recursive RLS on profiles)
-- ---------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- New-user trigger: create an org (if none supplied) + a profile.
-- Reads optional org_name / org_id from raw_user_meta_data.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  -- Join an existing org if a valid org_id was provided at signup, else create one.
  v_org_id := nullif(new.raw_user_meta_data ->> 'org_id', '')::uuid;

  if v_org_id is null or not exists (select 1 from public.organizations where id = v_org_id) then
    insert into public.organizations (name)
    values (coalesce(nullif(new.raw_user_meta_data ->> 'org_name', ''), 'My Organization'))
    returning id into v_org_id;
  end if;

  insert into public.profiles (id, org_id, email, full_name, role)
  values (
    new.id,
    v_org_id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    case when (new.raw_user_meta_data ->> 'org_id') is null then 'owner' else 'member' end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger proposals_touch before update on public.proposals
  for each row execute function public.touch_updated_at();
create trigger proposal_sections_touch before update on public.proposal_sections
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — everything scoped to the caller's org.
-- ---------------------------------------------------------------------------
alter table public.organizations     enable row level security;
alter table public.profiles          enable row level security;
alter table public.proposals         enable row level security;
alter table public.proposal_sections enable row level security;
alter table public.claims            enable row level security;
alter table public.citations         enable row level security;
alter table public.research_cache    enable row level security;

-- organizations: members can read their own org.
create policy org_select on public.organizations
  for select using (id = public.current_org_id());

-- profiles: a user can read profiles in their org; can update only their own row.
create policy profiles_select on public.profiles
  for select using (org_id = public.current_org_id());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Generic org-scoped policies for the content tables.
create policy proposals_all on public.proposals
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy proposal_sections_all on public.proposal_sections
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy claims_all on public.claims
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy citations_all on public.citations
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy research_cache_all on public.research_cache
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
