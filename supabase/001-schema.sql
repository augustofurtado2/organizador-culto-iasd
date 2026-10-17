-- Execute na ordem num projeto Supabase dedicado. Não apaga tabelas existentes.
begin;
create schema if not exists culto_private;
revoke all on schema culto_private from public;
create table public.culto_app_state (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0 check (revision >= 0)
);
insert into public.culto_app_state values (true, 0);
create table public.cultos (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  date date not null,
  title text not null check (length(trim(title)) between 1 and 200),
  start_time time not null,
  sabbath_start_time time not null,
  elder text not null default '',
  ceremony_lead text not null default '',
  sound_team jsonb not null default '[]' check (jsonb_typeof(sound_team) = 'array'),
  notes text not null default '',
  status text not null default 'planned' check (status in ('planned','live','finished')),
  real_started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cultos_single_live on public.cultos (status) where status = 'live';
create index cultos_date on public.cultos (date desc);
create index cultos_status on public.cultos (status);
create table public.culto_sections (
  id uuid primary key default gen_random_uuid(),
  culto_id uuid not null references public.cultos(id) on delete cascade,
  type text not null check (type ~ '^[a-z][a-z0-9_-]{0,63}$'),
  label text not null check (length(trim(label)) > 0),
  position integer not null check (position >= 0),
  start_time time not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (culto_id, id),
  unique (culto_id, type) deferrable initially deferred,
  unique (culto_id, position) deferrable initially deferred
);
create table public.culto_items (
  id uuid primary key default gen_random_uuid(),
  culto_id uuid not null references public.cultos(id) on delete cascade,
  section_id uuid not null,
  position integer not null check (position >= 0),
  type text not null default 'other', label text not null check (length(trim(label)) > 0),
  responsible text not null default '',
  duration_minutes integer not null check (duration_minutes between 0 and 999),
  enabled boolean not null default true, has_songs boolean not null default false,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','active','completed')),
  real_started_at timestamptz, real_finished_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (culto_id, id),
  unique (culto_id, position) deferrable initially deferred,
  foreign key (culto_id, section_id) references public.culto_sections(culto_id,id) on delete cascade
);
create index culto_items_section on public.culto_items (section_id);
create unique index culto_items_single_active on public.culto_items (culto_id) where status = 'active';
create table public.culto_item_songs (
  id uuid primary key default gen_random_uuid(),
  culto_item_id uuid not null references public.culto_items(id) on delete cascade,
  song_id text,
  song_title text not null check (length(trim(song_title)) > 0),
  position integer not null check (position >= 0),
  unique (culto_item_id, position) deferrable initially deferred
);
create table public.culto_live_state (
  culto_id uuid primary key references public.cultos(id) on delete cascade,
  active_item_id uuid not null,
  started_at timestamptz not null,
  active_item_started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  foreign key (culto_id,active_item_id) references public.culto_items(culto_id,id) on delete cascade
);
create table public.cerimonial_checklist (
  id uuid primary key default gen_random_uuid(),
  culto_id uuid not null references public.cultos(id) on delete cascade,
  item_id uuid not null,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (culto_id,item_id),
  foreign key (culto_id,item_id) references public.culto_items(culto_id,id) on delete cascade,
  check ((completed and completed_at is not null) or (not completed and completed_at is null))
);
create table culto_private.migration_imports (
  source_hash text primary key, source_snapshot jsonb not null,
  imported_at timestamptz not null default now(), culto_count integer not null
);
create function public.culto_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['cultos','culto_sections','culto_items','culto_live_state','cerimonial_checklist'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.culto_set_updated_at()',t);
  end loop;
end $$;
commit;
