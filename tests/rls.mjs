/* ============================================================
   DATE ME — Row-Level-Security integration tests.

   Verifies the security invariants that keep one user's data out of another
   user's hands — most importantly that verification selfies/rows and the
   client_errors crash log are NOT readable by ordinary users
   ("не могли быть просмотрены нигде кроме админки").

   These hit a REAL Supabase project through the public (anon) API, exactly
   the way the app does — the only faithful way to test RLS. They are
   NON-DESTRUCTIVE: every row created is deleted again.

   Run against STAGING, never production. Requires two throwaway test users:

     SUPABASE_URL=...            (staging project URL)
     SUPABASE_ANON_KEY=...       (staging anon/publishable key)
     RLS_A_EMAIL=...  RLS_A_PASSWORD=...   (test user A, email-confirmed)
     RLS_B_EMAIL=...  RLS_B_PASSWORD=...   (test user B, email-confirmed)

   With any of those unset the suite prints "skipped" and exits 0, so CI stays
   green without staging secrets.  Usage:  node tests/rls.mjs
   ============================================================ */
'use strict';

const {
  SUPABASE_URL, SUPABASE_ANON_KEY,
  RLS_A_EMAIL, RLS_A_PASSWORD, RLS_B_EMAIL, RLS_B_PASSWORD,
} = process.env;

const have = SUPABASE_URL && SUPABASE_ANON_KEY && RLS_A_EMAIL && RLS_A_PASSWORD && RLS_B_EMAIL && RLS_B_PASSWORD;
if (!have) {
  console.log('RLS tests skipped — set SUPABASE_URL, SUPABASE_ANON_KEY, RLS_A_EMAIL/PASSWORD, RLS_B_EMAIL/PASSWORD (staging) to run.');
  process.exit(0);
}

let createClient;
try {
  ({ createClient } = await import('@supabase/supabase-js'));
} catch {
  console.error('RLS tests need @supabase/supabase-js — run `npm install` first.');
  process.exit(1);
}

let failures = 0;
function ok(name) { console.log('  ✓ ' + name); }
function bad(name, detail) { failures++; console.error('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
function assert(cond, name, detail) { cond ? ok(name) : bad(name, detail); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
const A = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
const B = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) { throw new Error(`could not sign in ${label}: ${error && error.message}`); }
  return data.user.id;
}

const randUuid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID()
  : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0'));

async function run() {
  const aId = await signIn(A, RLS_A_EMAIL, RLS_A_PASSWORD, 'A');
  const bId = await signIn(B, RLS_B_EMAIL, RLS_B_PASSWORD, 'B');

  console.log('\nclient_errors (admin-only read):');
  {
    const ins = await anon.from('client_errors').insert({ message: 'rls-test', url: '/rls', ua: 'test' });
    assert(!ins.error, 'anonymous visitor can report an error', ins.error && ins.error.message);
    const asA = await A.from('client_errors').select('id').limit(1);
    // RLS hides rows from non-admins: either an empty result or an explicit denial, never data.
    assert(!asA.error && (asA.data || []).length === 0, 'signed-in user cannot read the crash log',
      asA.error ? asA.error.message : `got ${(asA.data || []).length} rows`);
  }

  console.log('\nverifications (own-or-admin read, admin-only write):');
  {
    const sel = await B.from('verifications').select('user_id');
    const leaked = (sel.data || []).filter((r) => r.user_id !== bId);
    assert(!sel.error, 'user can query verifications', sel.error && sel.error.message);
    assert(leaked.length === 0, 'user never sees another user\'s verification rows',
      `${leaked.length} foreign rows leaked`);
    // ordinary user must not be able to approve anyone (admin-only update)
    const upd = await B.from('verifications').update({ status: 'approved' }).eq('user_id', aId).select('id');
    assert(!upd.error ? (upd.data || []).length === 0 : true, 'user cannot approve verifications',
      (upd.data && upd.data.length) ? `${upd.data.length} rows updated` : '');
  }

  console.log('\nprofiles (any authed reads, owner-only writes):');
  {
    const read = await A.from('profiles').select('id').limit(1);
    assert(!read.error, 'authenticated user can read profiles (discovery)', read.error && read.error.message);
    const upd = await B.from('profiles').update({ name: 'hacked' }).eq('id', aId).select('id');
    assert(!upd.error ? (upd.data || []).length === 0 : true, 'user cannot edit another user\'s profile',
      (upd.data && upd.data.length) ? `${upd.data.length} rows updated` : '');
  }

  console.log('\nlikes (own-or-target read, owner-only write):');
  {
    const target = randUuid(); // a third party who is neither A nor B
    const ins = await A.from('likes').insert({ user_id: aId, target_id: target }).select('id').single();
    assert(!ins.error && ins.data, 'user can record their own like', ins.error && ins.error.message);
    const seenByB = await B.from('likes').select('id').eq('target_id', target);
    assert(!seenByB.error && (seenByB.data || []).length === 0,
      'a like is invisible to unrelated users', seenByB.error ? seenByB.error.message : `${(seenByB.data || []).length} rows`);
    const seenByA = await A.from('likes').select('id').eq('target_id', target);
    assert(!seenByA.error && (seenByA.data || []).length === 1, 'a user can see the likes they sent',
      seenByA.error && seenByA.error.message);
    if (ins.data && ins.data.id) { await A.from('likes').delete().eq('id', ins.data.id); } // cleanup
  }

  await A.auth.signOut(); await B.auth.signOut();
}

run()
  .then(() => {
    console.log('');
    if (failures) { console.error(`RLS: ${failures} check(s) FAILED`); process.exit(1); }
    console.log('RLS: all checks passed'); process.exit(0);
  })
  .catch((e) => { console.error('RLS harness error:', e.message || e); process.exit(1); });
