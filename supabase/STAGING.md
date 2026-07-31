# Staging environment

Right now there is **one** Supabase project and it is production. Every schema
change, bot, and test verification you make touches real user data. A staging
project gives you a throwaway copy to try changes against before they reach
real users — this is step 1.4 of the stability plan.

## Why

- Run a new `schema.sql` / migration against staging first; if it errors or
  breaks the app, production is untouched.
- Click through registration → verification → admin on a database you can wipe.
- Point the deployed preview / a local build at staging so QA never creates
  noise in production.

## One-time setup

1. **Create a second project** in the Supabase dashboard, e.g.
   `date-me-staging`. It has its own URL and keys.
2. **Apply the schema**: SQL Editor → paste [`schema.sql`](./schema.sql) → Run.
3. **Add your admin row** (same as production — see [`SETUP.md`](./SETUP.md)),
   using a test account you don't mind resetting.
4. **Auth providers**: enable email; add Google only if you want to test the
   OAuth flow (its redirect URLs must include the staging origin).

## Pointing the app at staging

The app reads its backend URL/key from
[`js/supabase-config.js`](../js/supabase-config.js). Do **not** commit staging
keys over the production ones. Instead, when running a staging build, serve a
`supabase-config.js` that holds the staging project's URL + publishable key.
Two low-effort options:

- **Local**: keep a `supabase-config.staging.js` (git-ignored) and copy it over
  `supabase-config.js` while testing, then restore.
- **Separate deploy**: host a second copy of the site (e.g. a `staging`
  branch / preview deploy) whose `supabase-config.js` carries the staging keys.

The publishable/anon key is safe to expose in the client; the **service_role**
key must never be placed in `supabase-config.js` or any committed file.

## Promoting a change

1. Apply the migration to **staging**, run the smoke tests / click through the
   flows.
2. Only then apply the same migration to **production** (SQL Editor).
3. Because `schema.sql` and everything in [`migrations/`](./migrations/) is
   idempotent, re-running on production is safe.
