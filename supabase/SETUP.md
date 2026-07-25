# DATE ME — Supabase setup (Phase 2)

The app is wired to Supabase. Do these steps **once** in the Supabase
dashboard, then the admin panel and verification run on the real backend
(not demo).

Project: `https://tuhzhghwsontzmseatgj.supabase.co`

## 1. Create the schema
Dashboard → **SQL Editor** → **New query** → paste all of
[`schema.sql`](./schema.sql) → **Run**.
This creates `profiles` (incl. location + photo URLs), `verifications`,
`likes`, `dates`, `admins`, the `is_admin()` function, the private
**`selfies`** bucket, the public **`photos`** bucket (profile pictures shown
to other users), and all Row-Level-Security policies. The script is
**idempotent — re-run it whenever `schema.sql` changes** (e.g. after pulling an
update that adds a table or column).

**Discovery** shows real nearby users: the app stores each user's location on
their profile (with permission) and lists others within the search radius,
with real distances. Likes are stored in `likes`; a mutual like is a match.
Grant the browser **location permission** or distances fall back to "рядом".

**Meeting places** are real: the date planner pulls actual cafes / parks /
cinemas near the two people from keyless **OpenStreetMap Overpass**, and travel
time comes from the keyless Valhalla router — no API key. No setup needed.

**Bots**: the admin **Боты** section creates fake profiles (name, age, city →
geocoded via keyless OSM Nominatim, languages, photo) that appear in discovery
as verified people. Behavior `autolike` makes a bot like everyone nearby (so a
real user gets an instant match on like-back). Toggle active / delete anytime.

**Delete account**: the profile screen's button removes all of a user's data
(profile, verifications, likes, dates, storage) and their auth user via the
`delete_account()` function — make sure `schema.sql` has been re-run so that
function and the storage-delete policies exist.

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
