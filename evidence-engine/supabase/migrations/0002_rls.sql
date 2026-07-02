-- Row Level Security: every table is restricted to active grants-team members.
-- The app is not public; anonymous and non-team authenticated users see nothing.

alter table public.team_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.corpus_entries enable row level security;
alter table public.grant_opportunities enable row level security;
alter table public.pipeline_runs enable row level security;
alter table public.generated_sections enable row level security;
alter table public.citation_claims enable row level security;
alter table public.review_checkpoints enable row level security;
alter table public.section_revisions enable row level security;
alter table public.audit_log enable row level security;

-- Allowlist: only admins may read or manage it.
create policy allowlist_admin_all on public.team_allowlist
  for all using (public.is_team_admin()) with check (public.is_team_admin());

-- Profiles: users always see their own profile (needed to render the
-- "not authorized" state); team members see the whole team; admins manage.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_select_team on public.profiles
  for select using (public.is_grants_team());
create policy profiles_admin_update on public.profiles
  for update using (public.is_team_admin()) with check (public.is_team_admin());

-- Working tables: full access for active team members.
create policy corpus_team_all on public.corpus_entries
  for all using (public.is_grants_team()) with check (public.is_grants_team());

create policy grants_team_all on public.grant_opportunities
  for all using (public.is_grants_team()) with check (public.is_grants_team());

create policy runs_team_all on public.pipeline_runs
  for all using (public.is_grants_team()) with check (public.is_grants_team());

create policy sections_team_all on public.generated_sections
  for all using (public.is_grants_team()) with check (public.is_grants_team());

create policy claims_team_all on public.citation_claims
  for all using (public.is_grants_team()) with check (public.is_grants_team());

create policy checkpoints_team_all on public.review_checkpoints
  for all using (public.is_grants_team()) with check (public.is_grants_team());

create policy revisions_team_all on public.section_revisions
  for all using (public.is_grants_team()) with check (public.is_grants_team());

-- Audit log: append-only for team members; no update/delete policies exist,
-- so history cannot be rewritten through the API.
create policy audit_team_select on public.audit_log
  for select using (public.is_grants_team());
create policy audit_team_insert on public.audit_log
  for insert with check (public.is_grants_team());
