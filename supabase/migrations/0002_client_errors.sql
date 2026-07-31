-- 0002_client_errors
-- Client-side crash monitoring (see js/errlog.js). Uncaught errors and
-- unhandled rejections from real devices are batched and inserted here.
-- Anyone (including anonymous visitors) may INSERT their own reports; only
-- admins may read or delete them.
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
