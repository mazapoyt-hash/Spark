'use strict';
/* ============================================================
   DATE ME — client error logging.
   Captures uncaught errors and unhandled promise rejections on real devices
   and ships them to Supabase (table `client_errors`, admin-readable) so we
   see production crashes instead of finding them by screenshot. Deduped,
   buffered, and best-effort — never throws, never blocks the app.
   ============================================================ */
(function () {
  const buf = [];
  const seen = new Set();

  function record(message, stack) {
    try {
      const msg = String(message || '').slice(0, 500);
      const stk = String(stack || '').slice(0, 2000);
      const key = msg + '|' + stk.slice(0, 160);
      if (seen.has(key)) return; // dedupe repeats
      seen.add(key);
      buf.push({ message: msg, stack: stk, url: location.pathname, ua: (navigator.userAgent || '').slice(0, 300) });
      if (buf.length > 30) buf.shift();
    } catch { /* never throw from the logger */ }
  }

  addEventListener('error', (e) => record(e.message, e.error && e.error.stack));
  addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    record((r && (r.message || r)) || 'unhandledrejection', r && r.stack);
  });

  async function flush() {
    if (!buf.length) return;
    const B = window.Backend;
    if (!B || !B.enabled || typeof B.logErrors !== 'function') return; // offline/demo → keep in console only
    const batch = buf.splice(0, buf.length);
    try { await B.logErrors(batch); }
    catch { batch.forEach((x) => buf.push(x)); } // put back, retry next tick
  }

  setInterval(flush, 8000);
  addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.__flushErrors = flush;
})();
