'use strict';
/* ============================================================
   DATE ME — Supabase backend wrapper (Phase 2).
   Thin, defensive layer over supabase-js. Everything is async and throws on
   error so callers can surface a clear message. When Supabase isn't loaded
   (offline / library blocked) `Backend.enabled` is false and the app falls
   back to its local demo behaviour.
   Data model + RLS: see supabase/schema.sql.
   ============================================================ */
(function () {
  const lib = window.supabase;
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_KEY;
  const client = (lib && url && key)
    ? lib.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;

  const redirect = () => location.href.split('#')[0].split('?')[0];

  const Backend = {
    enabled: !!client,
    client,

    /* ---- auth ---- */
    async user() { if (!client) return null; const { data } = await client.auth.getUser(); return data && data.user; },
    onAuth(cb) { if (client) client.auth.onAuthStateChange((_e, s) => cb(s ? s.user : null)); },
    async signInEmail(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
      if (error) throw error;
    },
    async signInOAuth(provider) { // 'google' | 'apple'
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: redirect() } });
      if (error) throw error;
    },
    async signOut() { if (client) await client.auth.signOut(); },
    async isAdmin() {
      if (!client) return false;
      const { data, error } = await client.rpc('is_admin');
      if (error) return false;
      return !!data;
    },

    /* ---- profiles ---- */
    async upsertProfile({ name, age, gender, photoBlobs }) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('not signed in');
      const row = { id: user.id, name, age, gender };
      if (photoBlobs && photoBlobs.length) {
        const paths = [];
        for (let i = 0; i < photoBlobs.length; i++) {
          const path = `${user.id}/photo-${i}.jpg`;
          const up = await client.storage.from('selfies').upload(path, photoBlobs[i], { contentType: 'image/jpeg', upsert: true });
          if (up.error) throw up.error;
          paths.push(path);
        }
        row.photos = paths;
      }
      const { error } = await client.from('profiles').upsert(row);
      if (error) throw error;
    },
    async mediaUrl(path) { // download any object from the selfies bucket → object URL
      const { data, error } = await client.storage.from('selfies').download(path);
      if (error) throw error;
      return URL.createObjectURL(data);
    },
    async getProfile(userId) {
      const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async listUsers() { // admins can read every profile
      const { data, error } = await client.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async updateProfileAsAdmin(userId, patch) { // admin edits an applicant's profile
      const { error } = await client.from('profiles').upsert({ id: userId, ...patch });
      if (error) throw error;
    },
    async updateVerificationMeta(id, patch) {
      const { error } = await client.from('verifications').update(patch).eq('id', id);
      if (error) throw error;
    },

    /* ---- verifications ---- */
    async submitVerification({ userId, name, age, gestureId, blob }) {
      const path = `${userId}/${(crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2))}.jpg`;
      const up = await client.storage.from('selfies').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
      if (up.error) throw up.error;
      const ins = await client.from('verifications')
        .insert({ user_id: userId, name, age, gesture_id: gestureId, selfie_path: path, status: 'pending', comment: '' })
        .select().single();
      if (ins.error) throw ins.error;
      return ins.data;
    },
    async myVerification(userId) {
      const { data, error } = await client.from('verifications')
        .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
      if (error) throw error;
      return (data && data[0]) || null;
    },

    /* ---- admin ---- */
    async listVerifications() {
      const { data, error } = await client.from('verifications').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async selfieUrl(path) {
      const { data, error } = await client.storage.from('selfies').download(path);
      if (error) throw error;
      return URL.createObjectURL(data);
    },
    async decide(id, status, comment, reviewerId) {
      const { error } = await client.from('verifications')
        .update({ status, comment: comment || '', reviewed_at: new Date().toISOString(), reviewer: reviewerId })
        .eq('id', id);
      if (error) throw error;
    },
  };

  window.Backend = Backend;
})();
