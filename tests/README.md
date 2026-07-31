# Tests

| File | What it checks | Needs |
| --- | --- | --- |
| `smoke.spec.js` | Playwright UI smoke: onboarding → verification → discover, match/rounded-distance, date mini-game, video sheet, admin login. Blocks the Supabase CDN so the app runs its offline/demo path — also proving graceful degradation. | `npm install` (+ a browser) |
| `check-i18n.mjs` | Every locale has the same keys as `en` (no missing/extra translations). | node only |
| `rls.mjs` | Row-Level-Security invariants against a **real** Supabase project — verification rows and the crash log stay admin-only, users can't read/edit each other's data. Self-skips when staging creds are absent. | staging project + 2 test users |

## Running

```bash
npm install
npm test            # smoke tests (Playwright)
npm run check:i18n  # locale parity
npm run test:rls    # RLS tests (skips without staging creds)
```

Local Playwright can reuse a pre-installed browser:
`PW_EXECUTABLE=/path/to/chromium npm test`.

## RLS tests — staging setup

`rls.mjs` talks to a real project through the public anon API, exactly as the
app does — the only faithful way to exercise RLS. **Point it at staging, never
production** (see `../supabase/STAGING.md`). It is non-destructive: every row
it creates it deletes again.

1. In the staging project, create two throwaway users (Dashboard → Authentication
   → Add user), both **email-confirmed**, e.g. `rls-a@example.com` /
   `rls-b@example.com`. Neither should be an admin.
2. Export the env and run:

   ```bash
   export SUPABASE_URL="https://<staging-ref>.supabase.co"
   export SUPABASE_ANON_KEY="<staging anon/publishable key>"
   export RLS_A_EMAIL="rls-a@example.com"  RLS_A_PASSWORD="…"
   export RLS_B_EMAIL="rls-b@example.com"  RLS_B_PASSWORD="…"
   npm run test:rls
   ```

In CI these come from repo **secrets** (`STAGING_SUPABASE_URL`,
`STAGING_SUPABASE_ANON_KEY`, `RLS_A_EMAIL`, `RLS_A_PASSWORD`, `RLS_B_EMAIL`,
`RLS_B_PASSWORD`). Without them the step self-skips and the build stays green.
