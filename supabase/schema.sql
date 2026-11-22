-- LibriMind database
-- Run this entire file once in the Supabase SQL editor (New query → paste → Run).
-- It creates the catalogue, circulation, digital library, agent log, row-level security,
-- and the three storage buckets.
--
-- After a person has registered, promote a librarian with:
--   update public.profiles set role = 'admin' where email = 'librarian@example.edu';
--
-- New accounts are always students. A student cannot change that role.
-- Approved external sites are seeded here. The application cannot insert a new site.

create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.user_role as enum ('student', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.copy_status as enum ('available', 'borrowed', 'reserved', 'lost', 'maintenance');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reservation_status as enum ('pending', 'ready', 'fulfilled', 'cancelled', 'expired');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.fine_status as enum ('open', 'paid', 'waived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.asset_scope as enum ('institutional', 'personal');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.asset_format as enum ('pdf', 'epub');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_kind as enum ('due_soon', 'overdue', 'reservation_ready', 'fine');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.agent_status as enum ('running', 'succeeded', 'failed');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role public.user_role not null default 'student',
  programme text,
  reading_interests text[] not null default '{}',
  preferred_category_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  -- The SQL editor has no user JWT, so a librarian can be promoted from there.
  if auth.uid() is null and coalesce(auth.role(), '') = '' then
    return new;
  end if;
  raise exception 'Only an administrator can change a role';
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue and circulation
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  category_id uuid references public.categories (id) on delete restrict,
  isbn13 text,
  isbn10 text,
  description text not null default '',
  language text not null default 'en',
  publication_year integer,
  publisher text,
  page_count integer,
  cover_path text,
  embedding extensions.vector(1536),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_year_check check (publication_year is null or publication_year between 1 and 3000),
  constraint books_pages_check check (page_count is null or page_count > 0)
);

create unique index if not exists books_isbn13_key on public.books (isbn13) where isbn13 is not null;
create index if not exists books_category_idx on public.books (category_id);
create index if not exists books_title_idx on public.books (title);

-- array_to_string is immutable, but text concatenation in an index can resolve to a
-- stable operator. A declared-immutable wrapper is what Postgres accepts here.
create or replace function public.book_search_vector(title text, authors text[], description text)
returns tsvector
language sql
immutable
as $$
  select to_tsvector(
    'english'::regconfig,
    coalesce(title, '') || ' ' || coalesce(array_to_string(authors, ' '), '') || ' ' || coalesce(description, '')
  );
$$;

create index if not exists books_search_idx
  on public.books
  using gin (public.book_search_vector(title, authors, description));
do $$ begin
  create index if not exists books_embedding_idx
    on public.books
    using hnsw (embedding vector_cosine_ops);
exception when others then
  raise notice 'Semantic search index was not created: %', sqlerrm;
end $$;

drop trigger if exists books_touch on public.books;
create trigger books_touch
  before update on public.books
  for each row execute function public.touch_updated_at();

create table if not exists public.book_copies (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  accession text not null unique,
  status public.copy_status not null default 'available',
  condition text not null default 'good',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_copies_book_idx on public.book_copies (book_id);

drop trigger if exists book_copies_touch on public.book_copies;
create trigger book_copies_touch
  before update on public.book_copies
  for each row execute function public.touch_updated_at();

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references public.book_copies (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  issued_by uuid references public.profiles (id) on delete set null,
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  returned_at timestamptz,
  constraint loans_due_after_issue check (due_at > issued_at),
  constraint loans_return_after_issue check (returned_at is null or returned_at >= issued_at)
);

create index if not exists loans_user_idx on public.loans (user_id);
create index if not exists loans_due_idx on public.loans (due_at) where returned_at is null;
create unique index if not exists loans_one_open_copy
  on public.loans (copy_id)
  where returned_at is null;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.reservation_status not null default 'pending',
  placed_at timestamptz not null default now(),
  ready_at timestamptz,
  expires_at timestamptz,
  fulfilled_loan_id uuid references public.loans (id) on delete set null
);

create index if not exists reservations_user_idx on public.reservations (user_id);
create unique index if not exists reservations_one_open
  on public.reservations (user_id, book_id)
  where status in ('pending', 'ready');

create table if not exists public.fines (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  amount_cents integer not null check (amount_cents >= 0),
  reason text not null default '',
  status public.fine_status not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists fines_user_idx on public.fines (user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Digital library
-- ---------------------------------------------------------------------------

create table if not exists public.digital_assets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete cascade,
  scope public.asset_scope not null,
  format public.asset_format not null default 'pdf',
  storage_path text not null unique,
  file_size bigint not null check (file_size > 0),
  checksum text,
  mime_type text not null,
  source text not null default 'upload',
  source_url text,
  license_note text,
  title text not null default '',
  authors text[] not null default '{}',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_owner_matches_scope check (
    (scope = 'institutional' and owner_id is null)
    or (scope = 'personal' and owner_id is not null)
  )
);

create unique index if not exists digital_institutional_checksum
  on public.digital_assets (checksum)
  where scope = 'institutional' and checksum is not null;

create unique index if not exists digital_personal_checksum
  on public.digital_assets (owner_id, checksum)
  where scope = 'personal' and checksum is not null;

drop trigger if exists digital_assets_touch on public.digital_assets;
create trigger digital_assets_touch
  before update on public.digital_assets
  for each row execute function public.touch_updated_at();

create table if not exists public.personal_shelf_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid references public.books (id) on delete cascade,
  digital_asset_id uuid references public.digital_assets (id) on delete cascade,
  note text,
  added_at timestamptz not null default now(),
  constraint shelf_has_target check (book_id is not null or digital_asset_id is not null)
);

create index if not exists shelf_user_idx on public.personal_shelf_items (user_id);

create table if not exists public.reading_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid references public.books (id) on delete cascade,
  event text not null check (event in ('view', 'read_progress', 'download', 'reserve', 'loan', 'add_shelf')),
  progress double precision check (progress is null or (progress >= 0 and progress <= 1)),
  created_at timestamptz not null default now()
);

create index if not exists reading_events_user_idx on public.reading_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- System configuration
-- ---------------------------------------------------------------------------

create table if not exists public.system_settings (
  id integer primary key default 1 check (id = 1),
  loan_period_days integer not null default 14 check (loan_period_days > 0),
  max_active_loans integer not null default 5 check (max_active_loans > 0),
  daily_fine_cents integer not null default 50 check (daily_fine_cents >= 0),
  reservation_hold_days integer not null default 3 check (reservation_hold_days > 0),
  updated_at timestamptz not null default now()
);

insert into public.system_settings (id)
values (1)
on conflict (id) do nothing;

drop trigger if exists system_settings_touch on public.system_settings;
create trigger system_settings_touch
  before update on public.system_settings
  for each row execute function public.touch_updated_at();

create table if not exists public.external_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_url text not null,
  download_policy text not null check (download_policy in ('metadata_only', 'permitted_open_access')),
  enabled boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);

insert into public.external_sources (name, base_url, download_policy, notes)
values
  (
    'Project Gutenberg',
    'https://www.gutenberg.org',
    'permitted_open_access',
    'Public-domain texts. A file may be saved only when Gutenberg offers that file for download.'
  ),
  (
    'Open Library',
    'https://openlibrary.org',
    'metadata_only',
    'Use for metadata and lawful access links. Do not treat a catalogue record as a downloadable file.'
  ),
  (
    'Internet Archive',
    'https://archive.org',
    'permitted_open_access',
    'Save a file only when the item rights are explicitly public domain or an open license.'
  )
on conflict (name) do nothing;

create or replace function public.protect_external_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if auth.uid() is null and coalesce(auth.role(), '') = '' then
    return new;
  end if;
  if new.name is distinct from old.name
     or new.base_url is distinct from old.base_url
     or new.download_policy is distinct from old.download_policy
     or new.notes is distinct from old.notes then
    raise exception 'Approved sources are system configuration. Only the enabled flag can change.';
  end if;
  return new;
end;
$$;

drop trigger if exists external_sources_protect on public.external_sources;
create trigger external_sources_protect
  before update on public.external_sources
  for each row execute function public.protect_external_source();

-- ---------------------------------------------------------------------------
-- Agent trace and recommendations
-- ---------------------------------------------------------------------------

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  workflow text not null,
  status public.agent_status not null default 'running',
  request text not null default '',
  response text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists agent_runs_user_idx on public.agent_runs (user_id, started_at desc);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  agent text not null,
  tool text not null,
  success boolean not null,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_events_run_idx on public.agent_events (run_id, created_at);

create table if not exists public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  score double precision not null,
  explanation text not null default '',
  model_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_logs_user_idx on public.recommendation_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Seeded subjects. Fixed ids so later imports can refer to them.
-- ---------------------------------------------------------------------------

insert into public.categories (id, name, slug, sort_order)
values
  ('11111111-1111-4111-8111-111111111101', 'Design', 'design', 1),
  ('11111111-1111-4111-8111-111111111102', 'Computing', 'computing', 2),
  ('11111111-1111-4111-8111-111111111103', 'Literature', 'literature', 3),
  ('11111111-1111-4111-8111-111111111104', 'History', 'history', 4),
  ('11111111-1111-4111-8111-111111111105', 'Philosophy', 'philosophy', 5)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.book_copies enable row level security;
alter table public.loans enable row level security;
alter table public.reservations enable row level security;
alter table public.fines enable row level security;
alter table public.notifications enable row level security;
alter table public.digital_assets enable row level security;
alter table public.personal_shelf_items enable row level security;
alter table public.reading_events enable row level security;
alter table public.system_settings enable row level security;
alter table public.external_sources enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_events enable row level security;
alter table public.recommendation_logs enable row level security;

grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Profiles: a person reads and edits their own row. Librarians read and edit every row.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'student');

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Catalogue is readable by any signed-in person. Writes are librarian-only.
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated
  using (true);

drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists books_select on public.books;
create policy books_select on public.books
  for select to authenticated
  using (true);

drop policy if exists books_write on public.books;
create policy books_write on public.books
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists copies_select on public.book_copies;
create policy copies_select on public.book_copies
  for select to authenticated
  using (true);

drop policy if exists copies_write on public.book_copies;
create policy copies_write on public.book_copies
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Students see their own loans. Only a librarian issues or returns a copy.
drop policy if exists loans_select on public.loans;
create policy loans_select on public.loans
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists loans_write on public.loans;
create policy loans_write on public.loans
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists reservations_insert on public.reservations;
create policy reservations_insert on public.reservations
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists reservations_update on public.reservations;
create policy reservations_update on public.reservations
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (public.is_admin() or (user_id = auth.uid() and status = 'cancelled'));

drop policy if exists fines_select on public.fines;
create policy fines_select on public.fines
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists fines_write on public.fines;
create policy fines_write on public.fines
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (public.is_admin());

-- Institutional files are readable by signed-in readers. Personal files stay with the owner.
drop policy if exists assets_select on public.digital_assets;
create policy assets_select on public.digital_assets
  for select to authenticated
  using (scope = 'institutional' or owner_id = auth.uid() or public.is_admin());

drop policy if exists assets_insert on public.digital_assets;
create policy assets_insert on public.digital_assets
  for insert to authenticated
  with check (
    (scope = 'personal' and owner_id = auth.uid())
    or (scope = 'institutional' and owner_id is null and public.is_admin())
  );

drop policy if exists assets_update on public.digital_assets;
create policy assets_update on public.digital_assets
  for update to authenticated
  using (public.is_admin() or (scope = 'personal' and owner_id = auth.uid()))
  with check (public.is_admin() or (scope = 'personal' and owner_id = auth.uid()));

drop policy if exists assets_delete on public.digital_assets;
create policy assets_delete on public.digital_assets
  for delete to authenticated
  using (public.is_admin() or (scope = 'personal' and owner_id = auth.uid()));

drop policy if exists shelf_all on public.personal_shelf_items;
create policy shelf_all on public.personal_shelf_items
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists reading_select on public.reading_events;
create policy reading_select on public.reading_events
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists reading_insert on public.reading_events;
create policy reading_insert on public.reading_events
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists settings_select on public.system_settings;
create policy settings_select on public.system_settings
  for select to authenticated
  using (true);

drop policy if exists settings_update on public.system_settings;
create policy settings_update on public.system_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Sources can be read, and a librarian can flip enabled. Inserts stay in this file.
drop policy if exists sources_select on public.external_sources;
create policy sources_select on public.external_sources
  for select to authenticated
  using (true);

drop policy if exists sources_update on public.external_sources;
create policy sources_update on public.external_sources
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists agent_runs_select on public.agent_runs;
create policy agent_runs_select on public.agent_runs
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists agent_events_select on public.agent_events;
create policy agent_events_select on public.agent_events
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.agent_runs
      where agent_runs.id = agent_events.run_id
        and agent_runs.user_id = auth.uid()
    )
  );

drop policy if exists recommendations_select on public.recommendation_logs;
create policy recommendations_select on public.recommendation_logs
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Agent writes and recommendation writes go through the API service role, which bypasses RLS.

revoke all on function public.handle_new_user() from public, anon, authenticated;
do $$ begin
  grant execute on function public.handle_new_user() to supabase_auth_admin;
exception when undefined_object then null;
end $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.protect_external_source() from public, anon, authenticated;
grant execute on function public.touch_updated_at() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('covers', 'covers', true),
  ('institutional', 'institutional', false),
  ('personal', 'personal', false)
on conflict (id) do nothing;

drop policy if exists covers_read on storage.objects;
create policy covers_read on storage.objects
  for select to public
  using (bucket_id = 'covers');

drop policy if exists covers_write on storage.objects;
create policy covers_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and public.is_admin());

drop policy if exists covers_update on storage.objects;
create policy covers_update on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and public.is_admin())
  with check (bucket_id = 'covers' and public.is_admin());

drop policy if exists covers_delete on storage.objects;
create policy covers_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and public.is_admin());

drop policy if exists institutional_read on storage.objects;
create policy institutional_read on storage.objects
  for select to authenticated
  using (bucket_id = 'institutional');

drop policy if exists institutional_write on storage.objects;
create policy institutional_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'institutional' and public.is_admin());

drop policy if exists institutional_delete on storage.objects;
create policy institutional_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'institutional' and public.is_admin());

drop policy if exists personal_read on storage.objects;
create policy personal_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'personal'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists personal_insert on storage.objects;
create policy personal_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'personal'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists personal_delete on storage.objects;
create policy personal_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'personal'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
