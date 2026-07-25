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
  created_at timestamptz not null default now()
);
alter table public.dates add column if not exists target uuid;
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
