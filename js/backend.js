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
    async upsertProfile({ name, age, gender, lookingFor, langs, photoItems }) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('not signed in');
      // Core profile first, on its own — so the user always lands in the admin
      // even if the photo upload (storage policy / column) isn't ready.
      const { error } = await client.from('profiles').upsert({ id: user.id, name, age, gender });
      if (error) throw error;
      // Preferences (langs / who they're looking for) — best-effort so an older
      // schema without these columns doesn't drop the whole profile.
      try { await client.from('profiles').update({ langs: langs || null, looking_for: lookingFor || null }).eq('id', user.id); }
      catch (e) { try { console.warn('profile prefs update failed:', e.message || e); } catch { /* no console */ } }
      // Photos are best-effort; a failure here must not drop the profile row.
      // `photoItems` preserves order and mixes already-uploaded photos ({url})
      // with newly picked ones ({blob}); only the blobs are uploaded. They go in
      // the PUBLIC 'photos' bucket so other users see them in discovery.
      if (photoItems && photoItems.length) {
        try {
          const urls = [];
          for (let i = 0; i < photoItems.length; i++) {
            const it = photoItems[i];
            if (it && it.url) { urls.push(it.url); continue; } // keep existing
            const path = `${user.id}/photo-${i}.jpg`;
            const up = await client.storage.from('photos').upload(path, it.blob, { contentType: 'image/jpeg', upsert: true });
            if (up.error) throw up.error;
            urls.push(client.storage.from('photos').getPublicUrl(path).data.publicUrl);
          }
          await client.from('profiles').update({ photos: urls }).eq('id', user.id);
        } catch (e) { try { console.warn('profile photos upload failed:', e.message || e); } catch { /* no console */ } }
      }
    },
    async updateMyGeo(lat, lng) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      await client.from('profiles').update({ lat, lng, geo_updated_at: new Date().toISOString() }).eq('id', user.id);
    },
    async nearbyUsers(myGeo, radiusKm) {
      const { data: { user } } = await client.auth.getUser();
      const me = user ? user.id : '00000000-0000-0000-0000-000000000000';
      const [pr, bt] = await Promise.all([
        client.from('profiles').select('id,name,age,gender,photos,lat,lng').neq('id', me),
        client.from('bots').select('id,name,age,gender,photos,lat,lng,behavior').eq('active', true),
      ]);
      if (pr.error) throw pr.error;
      const hav = (a, b) => { const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180, la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
      const rows = [...(pr.data || []), ...((bt.data || []).map((b) => ({ ...b, is_bot: true })))]; // bots table may not exist yet → bt.error ignored
      let list = rows.map((u) => ({ ...u, km: (myGeo && u.lat != null && u.lng != null) ? hav(myGeo, { lat: u.lat, lng: u.lng }) : null }));
      if (myGeo) list = list.filter((u) => u.km == null || u.km <= radiusKm);
      return list.sort((a, b) => (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km));
    },
    async like(targetId) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('not signed in');
      const { error } = await client.from('likes').upsert({ user_id: user.id, target_id: targetId }, { onConflict: 'user_id,target_id' });
      if (error) throw error;
    },
    async myLikes() {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return [];
      const { data, error } = await client.from('likes').select('target_id').eq('user_id', user.id);
      if (error) throw error;
      return (data || []).map((x) => x.target_id);
    },
    async likesOfMe() {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return [];
      const { data, error } = await client.from('likes').select('user_id').eq('target_id', user.id);
      if (error) throw error;
      return (data || []).map((x) => x.user_id);
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

    /* ---- dates ---- */
    async saveDate({ person, place, inside, dateISO, time, target, placeLat, placeLng }) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return; // only synced for real signed-in users
      const { error } = await client.from('dates')
        .insert({ user_id: user.id, person, place, inside, date_iso: dateISO, time, target: target || null, place_lat: placeLat ?? null, place_lng: placeLng ?? null });
      if (error) throw error;
    },
    async listDates() {
      const { data, error } = await client.from('dates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    /* ---- video messages (one each way per match) ---- */
    async sendVideo(receiverId, blob) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('not signed in');
      const path = `${user.id}/${receiverId}.mp4`;
      const up = await client.storage.from('messages').upload(path, blob, { contentType: blob.type || 'video/mp4', upsert: true });
      if (up.error) throw up.error;
      const { error } = await client.from('messages').upsert({ sender_id: user.id, receiver_id: receiverId, video_path: path, created_at: new Date().toISOString() }, { onConflict: 'sender_id,receiver_id' });
      if (error) throw error;
    },
    async myVideoTo(receiverId) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return null;
      const { data } = await client.from('messages').select('*').eq('sender_id', user.id).eq('receiver_id', receiverId).maybeSingle();
      return data || null;
    },
    async videoFrom(senderId) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return null;
      const { data } = await client.from('messages').select('*').eq('sender_id', senderId).eq('receiver_id', user.id).maybeSingle();
      return data || null;
    },
    async videoUrl(path) {
      const { data, error } = await client.storage.from('messages').download(path);
      if (error) throw error;
      return URL.createObjectURL(data);
    },
    async deleteVideo(receiverId) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      try { await client.storage.from('messages').remove([`${user.id}/${receiverId}.mp4`]); } catch { /* ignore */ }
      await client.from('messages').delete().eq('sender_id', user.id).eq('receiver_id', receiverId);
    },

    /* ---- account deletion ---- */
    async deleteAccount() {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      for (const b of ['selfies', 'photos']) {
        try { const { data } = await client.storage.from(b).list(user.id); if (data && data.length) await client.storage.from(b).remove(data.map((f) => `${user.id}/${f.name}`)); } catch { /* ignore */ }
      }
      const { error } = await client.rpc('delete_account');
      if (error) throw error;
      try { await client.auth.signOut(); } catch { /* ignore */ }
    },

    /* ---- bots (admin) ---- */
    async createBot(bot) {
      const { data, error } = await client.from('bots').insert(bot).select().single();
      if (error) throw error;
      return data;
    },
    async listBots() {
      const { data, error } = await client.from('bots').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async updateBot(id, patch) {
      const { error } = await client.from('bots').update(patch).eq('id', id);
      if (error) throw error;
    },
    async deleteBot(id) {
      try { const { data } = await client.storage.from('photos').list('bots/' + id); if (data && data.length) await client.storage.from('photos').remove(data.map((f) => `bots/${id}/${f.name}`)); } catch { /* ignore */ }
      const { error } = await client.from('bots').delete().eq('id', id);
      if (error) throw error;
    },
    async uploadBotPhoto(botId, blob) {
      const path = `bots/${botId}/photo-0.jpg`;
      const up = await client.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      return client.storage.from('photos').getPublicUrl(path).data.publicUrl;
    },

    /* ---- client error monitoring (see js/errlog.js) ---- */
    async logErrors(rows) {
      if (!client || !rows || !rows.length) return;
      let uid = null;
      try { const { data } = await client.auth.getUser(); uid = data && data.user ? data.user.id : null; } catch { /* anon */ }
      const payload = rows.map((r) => ({
        user_id: uid,
        message: r.message,
        stack: r.stack,
        url: r.url,
        ua: r.ua,
      }));
      const { error } = await client.from('client_errors').insert(payload);
      if (error) throw error;
    },
    async listClientErrors(limit) {
      const { data, error } = await client.from('client_errors')
        .select('*').order('created_at', { ascending: false }).limit(limit || 200);
      if (error) throw error;
      return data || [];
    },
  };

  window.Backend = Backend;
})();
