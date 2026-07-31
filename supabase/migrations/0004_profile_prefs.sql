-- 0004_profile_prefs
-- Persist the profile's spoken languages and who they're looking for, so the
-- profile is complete across devices (e.g. signing in with Google on a second
-- device restores it instead of showing a blank form). Idempotent.
alter table public.profiles add column if not exists langs text[];
alter table public.profiles add column if not exists looking_for text;
