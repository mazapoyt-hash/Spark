'use strict';
/* ============================================================
   DATE ME — client-side crypto for verification selfies.
   Selfies are hybrid-encrypted to the admin's RSA-OAEP public key, so
   they are unreadable anywhere (app UI, localStorage, devtools) without
   the admin's password — only the admin panel can decrypt them.
   (A static site can't hide the login check itself; confidentiality of
   the photos is what the encryption actually enforces. Real roles + a
   private store come in Phase 2 with Supabase.)
   ============================================================ */

/* RSA-OAEP public key (SPKI, base64). The matching private key is shipped
   ONLY wrapped by the admin password (see adminka6582/admin.js). */
const VERIF_PUB = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxYKmw88AxUdCbgzOZB0hWNJCLT4/1BC1nBQNgqo6FIfNB+UGdrV6EeB5NfhFXqOsiNdKPp7l9eXe/3osvgkun0CsOkbuRCj7YvOd7EBKYQ0xe3erLApicttHOQEL34lYPYKwEt2SypyxFQwy7YLKIiu2FVHdrMxyOpFF/VHvTJokRuQfl5stKKQ8ZSFrBNnIae0Q9h78WZRc8aD2lkU4lft7wd9H5lOUZKcBK/oK943IIjApuBdeLiQBQ31mux+SUg1/SugmP9lzw2IUyXQQjMap/eAJVMkF+s422G4ofs30GDVVqHiiKfHkDKlNk79TYNTU1zKnzPcXVu4nuGH1vwIDAQAB';

function _b64(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function _ub64(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }

async function sha256hex(str) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let _pubKeyPromise = null;
function _pubKey() {
  return _pubKeyPromise || (_pubKeyPromise = crypto.subtle.importKey(
    'spki', _ub64(VERIF_PUB), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']));
}

/** Encrypt a selfie data-URL → { v, k, i, d } (RSA-wrapped AES key + AES-GCM ciphertext). */
async function encryptSelfie(dataUrl) {
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(dataUrl));
  const raw = await crypto.subtle.exportKey('raw', aes);
  const k = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, await _pubKey(), raw);
  return { v: 1, k: _b64(k), i: _b64(iv), d: _b64(ct) };
}

/** Admin only: unwrap the RSA private key with the admin password (throws if wrong). */
async function deriveAdminKey(password, wrappedB64, saltB64, ivB64) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const aes = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: _ub64(saltB64), iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _ub64(ivB64) }, aes, _ub64(wrappedB64));
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
}

/** Admin only: decrypt a selfie with the unwrapped private key → data-URL. */
async function decryptSelfie(enc, privKey) {
  const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privKey, _ub64(enc.k));
  const aes = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _ub64(enc.i) }, aes, _ub64(enc.d));
  return new TextDecoder().decode(pt);
}
