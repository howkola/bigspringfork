-- ============================================================
-- Correspondence — foundation schema
-- One data model, two lives: the writer's room and the archive.
-- Visibility is enforced HERE, at the database, not in clients.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type visibility_t as enum ('writer_only', 'archive');
create type letter_status_t as enum
  ('outlined', 'drafted', 'fair_copy', 'photographed', 'sealed', 'delivered', 'replied');
create type enclosure_kind_t as enum ('poem', 'clipping', 'austen', 'object');
create type library_status_t as enum ('available', 'reserved', 'used');
create type austen_tier_t as enum ('published', 'manuscript');
create type bible_category_t as enum
  ('fixed_canon', 'established_fact', 'promise', 'open_decision', 'name_workshop');
create type throughline_kind_t as enum
  ('ladder_salutation', 'ladder_closing', 'stella_barometer',
   'claire_ledger', 'wrong_direction', 'gigi_question');

-- ---------- role helpers ----------
-- Roles ride in auth JWT app_metadata.app_role: 'writer' | 'archive_reader'.
create or replace function app_role() returns text
language sql stable as $$
  select coalesce(
    ((current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'app_role'),
    ''
  );
$$;

create or replace function is_writer() returns boolean
language sql stable as $$ select app_role() = 'writer' $$;

create or replace function is_archive_reader() returns boolean
language sql stable as $$ select app_role() = 'archive_reader' $$;

-- ---------- app state (single row) ----------
create table app_state (
  id boolean primary key default true check (id),
  revealed boolean not null default false,
  revealed_at timestamptz,
  archive_include_concordance boolean not null default false,
  archive_include_journal boolean not null default false, -- default OFF: the physical journal is the endgame gift
  cadence_anchor_date date,
  updated_at timestamptz not null default now()
);
insert into app_state (id) values (true);

create or replace function is_revealed() returns boolean
language sql stable security definer set search_path = public as $$
  select revealed from app_state where id
$$;
create or replace function archive_concordance_on() returns boolean
language sql stable security definer set search_path = public as $$
  select revealed and archive_include_concordance from app_state where id
$$;
create or replace function archive_journal_on() returns boolean
language sql stable security definer set search_path = public as $$
  select revealed and archive_include_journal from app_state where id
$$;

-- ---------- updated_at ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- config (seeded JSON: ladder, glossary, rules, act notes) ----------
create table config (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger config_updated before update on config
  for each row execute function set_updated_at();

-- ---------- libraries ----------
create table poems (
  id uuid primary key default gen_random_uuid(),
  poet text not null,
  title text not null,
  date_str text,
  act int check (act between 1 and 5),
  theme text,
  why_it_fits text,
  deployment_note text,
  status library_status_t not null default 'available',
  reserved_for_letter_number int,
  used_in_letter_id uuid,
  her_reaction text,
  visibility visibility_t not null default 'writer_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poet, title)
);
create trigger poems_updated before update on poems
  for each row execute function set_updated_at();

create table clippings (
  id uuid primary key default gen_random_uuid(),
  number int unique,
  publication text,
  act int check (act between 1 and 5),
  body text not null,
  design_note text,
  status library_status_t not null default 'available',
  reserved_for_letter_number int,
  used_in_letter_id uuid,
  her_reaction text,
  visibility visibility_t not null default 'writer_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clippings_updated before update on clippings
  for each row execute function set_updated_at();

create table austen_items (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, -- A1..A16
  tier austen_tier_t not null,
  title text not null,
  deployment text,
  act int check (act between 1 and 5),
  planned_letter_number int,
  status library_status_t not null default 'available',
  reserved_for_letter_number int,
  used_in_letter_id uuid,
  her_reaction text,
  guardrails text,
  visibility visibility_t not null default 'writer_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger austen_items_updated before update on austen_items
  for each row execute function set_updated_at();

-- ---------- letters (the spine) ----------
create table letters (
  id uuid primary key default gen_random_uuid(),
  number int unique not null,
  act int not null check (act between 1 and 5),
  title text,
  status letter_status_t not null default 'outlined',
  in_story_date date, -- 1817; date type accepts it without complaint
  sent_date date,
  final_text text,
  summary text, -- one-paragraph summary fed to the Guardian for later letters
  salutation_rung int,
  closing_rung int,
  poem_id uuid references poems (id),
  photo_paths text[] not null default '{}',
  visibility visibility_t not null default 'archive', -- the letter itself belongs to the volume
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fts tsvector generated always as
    (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(final_text, ''))) stored
);
create index letters_fts on letters using gin (fts);
create trigger letters_updated before update on letters
  for each row execute function set_updated_at();

alter table poems add constraint poems_used_in_letter_fk
  foreign key (used_in_letter_id) references letters (id) on delete set null;
alter table clippings add constraint clippings_used_in_letter_fk
  foreign key (used_in_letter_id) references letters (id) on delete set null;
alter table austen_items add constraint austen_used_in_letter_fk
  foreign key (used_in_letter_id) references letters (id) on delete set null;

-- photographed requires at least one photograph; sealed locks the fair copy
create or replace function letters_guard() returns trigger
language plpgsql as $$
begin
  if new.status = 'photographed' and coalesce(array_length(new.photo_paths, 1), 0) < 1 then
    raise exception 'A letter cannot be marked photographed without at least one photograph.';
  end if;
  if old.status = 'sealed' and new.status = 'sealed'
     and new.final_text is distinct from old.final_text then
    raise exception 'The letter is sealed. Break the seal before editing the fair copy.';
  end if;
  return new;
end $$;
create trigger letters_guard_trg before update on letters
  for each row execute function letters_guard();

-- ---------- drafts (the sausage-making; never leaves the writer's room) ----------
create table letter_drafts (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references letters (id) on delete cascade,
  version int not null,
  body text not null default '',
  notes text,
  visibility visibility_t not null default 'writer_only'
    check (visibility = 'writer_only'), -- no exceptions, ever
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (letter_id, version)
);
create trigger letter_drafts_updated before update on letter_drafts
  for each row execute function set_updated_at();

-- ---------- enclosures ----------
create table enclosures (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references letters (id) on delete cascade,
  kind enclosure_kind_t not null,
  ref_id uuid, -- fk into poems/clippings/austen_items depending on kind
  description text,
  photo_path text,
  visibility visibility_t not null default 'writer_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger enclosures_updated before update on enclosures
  for each row execute function set_updated_at();

-- Attaching a library item marks it used; reserved items refuse the wrong letter.
create or replace function enclosures_attach() returns trigger
language plpgsql as $$
declare
  l_number int;
  l_reserved int;
begin
  select number into l_number from letters where id = new.letter_id;
  if new.ref_id is not null then
    if new.kind = 'poem' then
      select reserved_for_letter_number into l_reserved from poems where id = new.ref_id;
      if l_reserved is not null and l_reserved <> l_number then
        raise exception 'This poem is reserved for Letter %. Guard the crown jewels.', l_reserved;
      end if;
      update poems set status = 'used', used_in_letter_id = new.letter_id where id = new.ref_id;
    elsif new.kind = 'clipping' then
      select reserved_for_letter_number into l_reserved from clippings where id = new.ref_id;
      if l_reserved is not null and l_reserved <> l_number then
        raise exception 'This clipping is reserved for Letter %. Guard the crown jewels.', l_reserved;
      end if;
      update clippings set status = 'used', used_in_letter_id = new.letter_id where id = new.ref_id;
    elsif new.kind = 'austen' then
      select reserved_for_letter_number into l_reserved from austen_items where id = new.ref_id;
      if l_reserved is not null and l_reserved <> l_number then
        raise exception 'This item is reserved for Letter %. Guard the crown jewels.', l_reserved;
      end if;
      update austen_items set status = 'used', used_in_letter_id = new.letter_id where id = new.ref_id;
    end if;
  end if;
  return new;
end $$;
create trigger enclosures_attach_trg before insert on enclosures
  for each row execute function enclosures_attach();

create or replace function enclosures_detach() returns trigger
language plpgsql as $$
begin
  if old.ref_id is not null then
    if old.kind = 'poem' and not exists
       (select 1 from enclosures where ref_id = old.ref_id and id <> old.id) then
      update poems set
        status = case when reserved_for_letter_number is null then 'available'::library_status_t
                      else 'reserved'::library_status_t end,
        used_in_letter_id = null
      where id = old.ref_id;
    elsif old.kind = 'clipping' and not exists
       (select 1 from enclosures where ref_id = old.ref_id and id <> old.id) then
      update clippings set
        status = case when reserved_for_letter_number is null then 'available'::library_status_t
                      else 'reserved'::library_status_t end,
        used_in_letter_id = null
      where id = old.ref_id;
    elsif old.kind = 'austen' and not exists
       (select 1 from enclosures where ref_id = old.ref_id and id <> old.id) then
      update austen_items set
        status = case when reserved_for_letter_number is null then 'available'::library_status_t
                      else 'reserved'::library_status_t end,
        used_in_letter_id = null
      where id = old.ref_id;
    end if;
  end if;
  return old;
end $$;
create trigger enclosures_detach_trg after delete on enclosures
  for each row execute function enclosures_detach();

-- ---------- replies ----------
create table replies (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references letters (id) on delete cascade,
  received_date date not null default current_date,
  body_text text,
  photo_paths text[] not null default '{}',
  notes text,
  visibility visibility_t not null default 'writer_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger replies_updated before update on replies
  for each row execute function set_updated_at();

-- ---------- concordance (her sentences; the Act V exhibit) ----------
create table concordance_phrases (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid references replies (id) on delete set null,
  phrase text not null,
  context_note text,
  quoted_back_in_letter_id uuid references letters (id) on delete set null,
  visibility visibility_t not null default 'writer_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger concordance_updated before update on concordance_phrases
  for each row execute function set_updated_at();

-- ---------- continuity bible ----------
create table bible_facts (
  id uuid primary key default gen_random_uuid(),
  category bible_category_t not null,
  body text not null,
  established_in_letter_id uuid references letters (id) on delete set null,
  tags text[] not null default '{}',
  resolved boolean not null default false,
  visibility visibility_t not null default 'writer_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- the name workshop is permanently writer_only
  constraint name_workshop_secret
    check (category <> 'name_workshop' or visibility = 'writer_only'),
  fts tsvector generated always as (to_tsvector('english', body)) stored
);
create index bible_facts_fts on bible_facts using gin (fts);
create trigger bible_facts_updated before update on bible_facts
  for each row execute function set_updated_at();

-- ---------- through-line events ----------
create table throughline_events (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references letters (id) on delete cascade,
  kind throughline_kind_t not null,
  value text,
  numeric_value numeric,
  visibility visibility_t not null default 'writer_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger throughline_updated before update on throughline_events
  for each row execute function set_updated_at();

-- ---------- journal ----------
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  in_story_date date not null,
  body text not null,
  excerpt_marker boolean not null default false,
  sent_with_letter_id uuid references letters (id) on delete set null,
  visibility visibility_t not null default 'writer_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (in_story_date)
);
create trigger journal_updated before update on journal_entries
  for each row execute function set_updated_at();

-- ---------- guardian reviews (never leaves the writer's room) ----------
create table guardian_reviews (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references letters (id) on delete cascade,
  draft_version int,
  findings jsonb not null,
  model text not null,
  visibility visibility_t not null default 'writer_only'
    check (visibility = 'writer_only'),
  created_at timestamptz not null default now()
);

-- ---------- THE FLIP: archive content locks read-only after reveal ----------
create or replace function archive_lock_guard() returns trigger
language plpgsql as $$
begin
  if is_revealed() and old.visibility = 'archive' then
    -- Post-reveal, archive rows are immutable. (Flipping a writer_only row
    -- INTO the archive remains possible; that is the post-reveal toggle path.)
    raise exception 'The volume is bound. Archive content is read-only after the reveal.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger letters_archive_lock before update or delete on letters
  for each row execute function archive_lock_guard();
create trigger enclosures_archive_lock before update or delete on enclosures
  for each row execute function archive_lock_guard();
create trigger replies_archive_lock before update or delete on replies
  for each row execute function archive_lock_guard();
create trigger concordance_archive_lock before update or delete on concordance_phrases
  for each row execute function archive_lock_guard();
create trigger journal_archive_lock before update or delete on journal_entries
  for each row execute function archive_lock_guard();

-- ============================================================
-- ROW LEVEL SECURITY
-- The writer sees everything. The archive reader sees only
-- visibility='archive' rows on whitelisted tables, only after
-- the reveal. Anonymous sees nothing at all.
-- letter_drafts, guardian_reviews and bible_facts have NO
-- archive policies — unreachable regardless of toggles.
-- ============================================================

alter table app_state enable row level security;
alter table config enable row level security;
alter table poems enable row level security;
alter table clippings enable row level security;
alter table austen_items enable row level security;
alter table letters enable row level security;
alter table letter_drafts enable row level security;
alter table enclosures enable row level security;
alter table replies enable row level security;
alter table concordance_phrases enable row level security;
alter table bible_facts enable row level security;
alter table throughline_events enable row level security;
alter table journal_entries enable row level security;
alter table guardian_reviews enable row level security;

-- writer: full access
create policy writer_all_app_state on app_state
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_config on config
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_poems on poems
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_clippings on clippings
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_austen on austen_items
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_letters on letters
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_drafts on letter_drafts
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_enclosures on enclosures
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_replies on replies
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_concordance on concordance_phrases
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_bible on bible_facts
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_throughline on throughline_events
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_journal on journal_entries
  for all to authenticated using (is_writer()) with check (is_writer());
create policy writer_all_guardian on guardian_reviews
  for all to authenticated using (is_writer()) with check (is_writer());

-- archive reader: read-only, post-reveal, whitelisted tables, archive rows only
create policy archive_read_state on app_state
  for select to authenticated
  using (is_archive_reader() and revealed);
create policy archive_read_letters on letters
  for select to authenticated
  using (is_archive_reader() and is_revealed() and visibility = 'archive');
create policy archive_read_enclosures on enclosures
  for select to authenticated
  using (is_archive_reader() and is_revealed() and visibility = 'archive');
create policy archive_read_replies on replies
  for select to authenticated
  using (is_archive_reader() and is_revealed() and visibility = 'archive');
create policy archive_read_concordance on concordance_phrases
  for select to authenticated
  using (is_archive_reader() and archive_concordance_on() and visibility = 'archive');
create policy archive_read_journal on journal_entries
  for select to authenticated
  using (is_archive_reader() and archive_journal_on() and visibility = 'archive');
-- poems may be rendered inside the volume (text/attribution of used enclosures)
create policy archive_read_poems on poems
  for select to authenticated
  using (is_archive_reader() and is_revealed() and status = 'used');
create policy archive_read_clippings on clippings
  for select to authenticated
  using (is_archive_reader() and is_revealed() and status = 'used');
create policy archive_read_austen on austen_items
  for select to authenticated
  using (is_archive_reader() and is_revealed() and status = 'used');

-- ---------- storage: the photos bucket (letter & reply photographs) ----------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy writer_photos_all on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and is_writer())
  with check (bucket_id = 'photos' and is_writer());
-- Archive readers get photographs via server-signed URLs only; no direct policy.
