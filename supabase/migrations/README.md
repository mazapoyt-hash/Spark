# Migrations

`schema.sql` (one directory up) is the **full, idempotent snapshot** of the
database — running it on a fresh project creates everything, and re-running it
on an existing project is safe (every statement is `if not exists` /
`drop policy if exists` / `create or replace`).

This folder holds the **ordered, incremental** changes, so an existing
database can be brought up to date without re-reading the whole schema. Each
file:

- is prefixed with a zero-padded sequence number (`0001_`, `0002_`, …);
- is itself idempotent (safe to run more than once);
- is also folded into `schema.sql`, which stays the source of truth for fresh
  setups.

## Applying

**Fresh database** → run `../schema.sql` once (SQL Editor → New query → paste →
Run). You do not need the files here.

**Existing database** → in the SQL Editor, run each migration you haven't
applied yet, in ascending order. Because every file is idempotent, running one
you've already applied is a no-op.

## Adding a migration

1. Add the change to `../schema.sql` (keeping it idempotent).
2. Copy just that change into a new `NNNN_short_name.sql` file here.
3. Note it in this README's changelog below.

## Changelog

| File | What it adds |
| --- | --- |
| `0001_baseline.sql` | Pointer to `../schema.sql` — the initial full schema (profiles, verifications, likes, dates, messages, admins, bots, `is_admin()`, `delete_account()`, storage buckets + RLS). |
| `0002_client_errors.sql` | `client_errors` table for client-side crash monitoring (see `js/errlog.js`): anyone may insert, only admins may read/delete. |
| `0003_validation.sql` | DB-layer CHECK constraints (age 18–120, name length, gender, bot behavior, verification status). Added `NOT VALID` so existing rows are never rejected — only new/updated writes are checked. |
| `0004_profile_prefs.sql` | `profiles.langs` + `profiles.looking_for` so a profile is complete across devices (sign in on another device restores it instead of showing a blank form). |
