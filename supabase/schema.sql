-- ============================================================
-- DATE ME — Supabase schema (Phase 2)
-- Run this once in the Supabase dashboard → SQL Editor → New query → Run.
-- Safe to re-run (idempotent).
-- ============================================================

-- ---------- profiles (real users) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  age        int,
  gender     text,
  photos     text[],   -- storage paths of the applicant's profile photos
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists photos text[];
alter table public.profiles add column if not exists lat double precision;
alter table public.profiles add column if not exists lng double precision;
alter table public.profiles add column if not exists geo_updated_at timestamptz;
alter table public.profiles enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);
-- any signed-in user can read profiles (needed for discovery of nearby people)
drop policy if exists "profiles read authed" on public.profiles;
create policy "profiles read authed" on public.profiles
  for select using (auth.uid() is not null);
-- admins can read and edit any profile (to moderate / fix applicant data)
drop policy if exists "profiles read admin" on public.profiles;
create policy "profiles read admin" on public.profiles
  for select using (public.is_admin());
drop policy if exists "profiles insert admin" on public.profiles;
create policy "profiles insert admin" on public.profiles
  for insert with check (public.is_admin());
drop policy if exists "profiles update admin" on public.profiles;
create policy "profiles update admin" on public.profiles
  for update using (public.is_admin());

-- ---------- admins ----------
-- A user is an admin iff they have a row here. Add yourself AFTER signing in
-- once (get your id from Authentication → Users):
--   insert into public.admins (user_id) values ('<your-user-uuid>');
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
drop policy if exists "admins read own" on public.admins;
create policy "admins read own" on public.admins
  for select using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ---------- verifications (moderation queue) ----------
create table if not exists public.verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text,
  age         int,
  gesture_id  text not null,
  selfie_path text not null,             -- object path inside the private 'selfies' bucket
  status      text not null default 'pending',  -- pending | approved | rejected
  comment     text default '',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer    uuid
);
alter table public.verifications enable row level security;

-- a user sees their own rows; admins see everything
drop policy if exists "verif read own or admin" on public.verifications;
create policy "verif read own or admin" on public.verifications
  for select using (auth.uid() = user_id or public.is_admin());
-- a user can file their own request
drop policy if exists "verif insert own" on public.verifications;
create policy "verif insert own" on public.verifications
  for insert with check (auth.uid() = user_id);
-- only admins can approve / reject
drop policy if exists "verif update admin" on public.verifications;
create policy "verif update admin" on public.verifications
  for update using (public.is_admin());

-- ---------- likes (real discovery) ----------
create table if not exists public.likes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,   -- who liked
  target_id  uuid not null references auth.users(id) on delete cascade,   -- who was liked
  created_at timestamptz not null default now(),
  unique (user_id, target_id)
);
alter table public.likes enable row level security;
-- you can see the likes you sent and the likes you received (to know matches)
drop policy if exists "likes read own or target" on public.likes;
create policy "likes read own or target" on public.likes
  for select using (auth.uid() = user_id or auth.uid() = target_id);
drop policy if exists "likes insert own" on public.likes;
create policy "likes insert own" on public.likes
  for insert with check (auth.uid() = user_id);
drop policy if exists "likes delete own" on public.likes;
create policy "likes delete own" on public.likes
  for delete using (auth.uid() = user_id);

-- ---------- dates (scheduled meetings) ----------
create table if not exists public.dates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  person     text,     -- who the date is with (demo partner name for now)
  place      text,
  inside     boolean,
  date_iso   text,
  time       text,
  target     uuid,     -- the other real user (when applicable)
  place_lat  double precision,
  place_lng  double precision,
  created_at timestamptz not null default now()
);
alter table public.dates add column if not exists target uuid;
alter table public.dates add column if not exists place_lat double precision;
alter table public.dates add column if not exists place_lng double precision;
alter table public.dates enable row level security;
drop policy if exists "dates read own or admin" on public.dates;
create policy "dates read own or admin" on public.dates
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "dates insert own" on public.dates;
create policy "dates insert own" on public.dates
  for insert with check (auth.uid() = user_id);
drop policy if exists "dates delete own or admin" on public.dates;
create policy "dates delete own or admin" on public.dates
  for delete using (auth.uid() = user_id or public.is_admin());

-- ---------- messages (one video each way, per match) ----------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null,          -- real user (bots don't receive) — no FK so bot ids are allowed
  video_path  text not null,
  created_at  timestamptz not null default now(),
  unique (sender_id, receiver_id)     -- one active video per direction
);
alter table public.messages enable row level security;
drop policy if exists "msg read participant" on public.messages;
create policy "msg read participant" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
drop policy if exists "msg write own" on public.messages;
create policy "msg write own" on public.messages
  for insert with check (auth.uid() = sender_id);
drop policy if exists "msg update own" on public.messages;
create policy "msg update own" on public.messages
  for update using (auth.uid() = sender_id);
drop policy if exists "msg delete own" on public.messages;
create policy "msg delete own" on public.messages
  for delete using (auth.uid() = sender_id);

insert into storage.buckets (id, name, public)
  values ('messages', 'messages', false) on conflict (id) do nothing;
drop policy if exists "msgfile read participant" on storage.objects;
create policy "msgfile read participant" on storage.objects
  for select using (
    bucket_id = 'messages' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.messages m where m.video_path = name and m.receiver_id = auth.uid())
    ));
drop policy if exists "msgfile write own" on storage.objects;
create policy "msgfile write own" on storage.objects
  for insert with check (bucket_id = 'messages' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "msgfile update own" on storage.objects;
create policy "msgfile update own" on storage.objects
  for update using (bucket_id = 'messages' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "msgfile delete own" on storage.objects;
create policy "msgfile delete own" on storage.objects
  for delete using (bucket_id = 'messages' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- private storage bucket for selfies ----------
insert into storage.buckets (id, name, public)
  values ('selfies', 'selfies', false)
  on conflict (id) do nothing;

-- a user can upload only into their own folder: selfies/<uid>/...
drop policy if exists "selfie upload own" on storage.objects;
create policy "selfie upload own" on storage.objects
  for insert with check (
    bucket_id = 'selfies' and (storage.foldername(name))[1] = auth.uid()::text
  );
-- a user can read their own selfies; admins can read all (for moderation)
drop policy if exists "selfie read own or admin" on storage.objects;
create policy "selfie read own or admin" on storage.objects
  for select using (
    bucket_id = 'selfies'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
-- a user can overwrite their own files (re-uploading profile photos)
drop policy if exists "selfie update own" on storage.objects;
create policy "selfie update own" on storage.objects
  for update using (
    bucket_id = 'selfies' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- public bucket for profile photos (shown to other users) ----------
insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
  on conflict (id) do nothing;
drop policy if exists "photos read all" on storage.objects;
create policy "photos read all" on storage.objects
  for select using (bucket_id = 'photos');
drop policy if exists "photos write own" on storage.objects;
create policy "photos write own" on storage.objects
  for insert with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos update own" on storage.objects;
create policy "photos update own" on storage.objects
  for update using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- let users delete their own files (account deletion) and admins manage bot photos
drop policy if exists "selfie delete own" on storage.objects;
create policy "selfie delete own" on storage.objects
  for delete using (bucket_id = 'selfies' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos delete own" on storage.objects;
create policy "photos delete own" on storage.objects
  for delete using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "photos write admin" on storage.objects;
create policy "photos write admin" on storage.objects
  for insert with check (bucket_id = 'photos' and public.is_admin());
drop policy if exists "photos update admin" on storage.objects;
create policy "photos update admin" on storage.objects
  for update using (bucket_id = 'photos' and public.is_admin());

-- ---------- account deletion ----------
-- Deletes the caller's auth user; all their rows cascade (profiles,
-- verifications, dates; likes.user_id). Storage files are removed client-side
-- first. SECURITY DEFINER so it can touch auth.users.
create or replace function public.delete_account()
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

-- ---------- bots (admin-created fake profiles for discovery) ----------
create table if not exists public.bots (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  age        int,
  gender     text,
  city       text,
  lat        double precision,
  lng        double precision,
  langs      text[],
  photos     text[],
  verified   boolean not null default true,
  active     boolean not null default true,
  behavior   text not null default 'passive',   -- 'passive' | 'autolike'
  created_at timestamptz not null default now()
);
alter table public.bots enable row level security;
drop policy if exists "bots read active or admin" on public.bots;
create policy "bots read active or admin" on public.bots
  for select using (active = true or public.is_admin());
drop policy if exists "bots admin write" on public.bots;
create policy "bots admin write" on public.bots
  for all using (public.is_admin()) with check (public.is_admin());

-- allow likes to target a bot (not only auth users)
alter table public.likes drop constraint if exists likes_target_id_fkey;

-- ---------- client_errors (crash monitoring, see js/errlog.js) ----------
-- Uncaught errors from real devices land here so admins can see production
-- crashes instead of relying on screenshots. Anyone (incl. anon) may INSERT
-- their own reports; only admins may read them.
create table if not exists public.client_errors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  message    text,
  stack      text,
  url        text,
  ua         text,
  created_at timestamptz not null default now()
);
alter table public.client_errors enable row level security;
drop policy if exists "client_errors insert any" on public.client_errors;
create policy "client_errors insert any" on public.client_errors
  for insert with check (true);
drop policy if exists "client_errors read admin" on public.client_errors;
create policy "client_errors read admin" on public.client_errors
  for select using (public.is_admin());
drop policy if exists "client_errors delete admin" on public.client_errors;
create policy "client_errors delete admin" on public.client_errors
  for delete using (public.is_admin());
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);

-- ---------- data validation (defence in depth at the DB layer) ----------
-- The client already validates, but bad/legacy writes shouldn't reach the DB.
-- Added NOT VALID so existing rows are never rescanned/rejected — only new and
-- updated rows are checked. Each guard is idempotent.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_age_chk') then
    alter table public.profiles add constraint profiles_age_chk
      check (age is null or (age between 18 and 120)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_name_len_chk') then
    alter table public.profiles add constraint profiles_name_len_chk
      check (name is null or char_length(name) <= 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_gender_chk') then
    alter table public.profiles add constraint profiles_gender_chk
      check (gender is null or gender in ('m','w')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bots_age_chk') then
    alter table public.bots add constraint bots_age_chk
      check (age is null or (age between 18 and 120)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bots_gender_chk') then
    alter table public.bots add constraint bots_gender_chk
      check (gender is null or gender in ('m','w')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bots_behavior_chk') then
    alter table public.bots add constraint bots_behavior_chk
      check (behavior in ('passive','autolike')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'verifications_status_chk') then
    alter table public.verifications add constraint verifications_status_chk
      check (status in ('pending','approved','rejected')) not valid;
  end if;
end $$;
