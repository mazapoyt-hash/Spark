# DATE ME — Supabase setup (Phase 2)

The app is wired to Supabase. Do these steps **once** in the Supabase
dashboard, then the admin panel and verification run on the real backend
(not demo).

Project: `https://tuhzhghwsontzmseatgj.supabase.co`

## 1. Create the schema
Dashboard → **SQL Editor** → **New query** → paste all of
[`schema.sql`](./schema.sql) → **Run**.
This creates `profiles`, `verifications`, `admins`, the `is_admin()` function,
the private **`selfies`** storage bucket and all Row-Level-Security policies.

## 2. Allow your site URL (auth redirects)
Dashboard → **Authentication → URL Configuration**:
- **Site URL**: your deployed URL (e.g. `https://<user>.github.io/<repo>/`)
- **Redirect URLs**: add the same URL **and** the admin path, e.g.
  - `https://<user>.github.io/<repo>/`
  - `https://<user>.github.io/<repo>/adminka6582/`
  - (add `http://localhost:8642/` too if you test locally)

## 3. Enable sign-in methods
Dashboard → **Authentication → Providers**:
- **Email** — enable (magic link works out of the box; no secrets needed).
- **Google** — enable, then paste an OAuth **Client ID + Secret** from
  Google Cloud Console (Credentials → OAuth client → Web). Put Supabase's
  callback URL (shown on the provider page,
  `…/auth/v1/callback`) into Google's "Authorized redirect URIs".
- **Apple / Phone (SMS)** — later (not wired in the UI yet).

## 4. Make yourself an admin
1. Open the site (or `/adminka6582/`) and **sign in once** with your email so
   your account exists.
2. Dashboard → **Authentication → Users** → copy your user's **UID**.
3. Dashboard → **SQL Editor** → run:
   ```sql
   insert into public.admins (user_id) values ('<your-user-uuid>');
   ```
4. Reload `/adminka6582/` — you now have the real moderation queue.

## How it works
- A user signs in (email/Google/Apple) to get verified. Their selfie is
  uploaded to the **private** `selfies` bucket (`selfies/<uid>/<id>.jpg`) and a
  row is written to `verifications`.
- RLS makes selfies readable **only by their owner or an admin** — so
  verification requests can't be viewed anywhere except the admin panel.
- The admin approves/rejects (with a comment); the user sees the result and
  the comment in the app.
- The demo discovery feed (nearby people, likes, dates) still runs locally for
  now — only auth + verification are on the real backend.
