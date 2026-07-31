-- 0003_validation
-- Defence-in-depth: reject malformed writes at the DB layer, matching the
-- client's own validation. Constraints are NOT VALID so existing/legacy rows
-- are never rescanned or rejected — only new and updated rows are checked.
-- Idempotent: each guard is skipped if the constraint already exists.
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
