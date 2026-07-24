/* ============================================================
   DATE ME — app logic
   No swipes. No chats. See who's online nearby, like or pass,
   see who liked you (free), plan a real date in 5 questions.
   Demo mode: the people around you are simulated locally.
   ============================================================ */
'use strict';

/* ---------------- state ---------------- */
const LS_KEY = 'dateme.v1';

const DEMO_BY_ID = Object.fromEntries(DEMO_PEOPLE.map((p) => [p.id, p]));

function defaultState() {
  return {
    onboarded: false,
    introShown: false,
    profile: {
      name: '', age: null, gender: 'm', lookingFor: 'w',
      langs: [], photos: [], verified: false,
      locale: detectLocale(), radiusKm: 10,
    },
    // dynamic per-person flags
    people: Object.fromEntries(DEMO_PEOPLE.map((p) => [p.id, {
      online: Math.random() > 0.25, likedMe: false, iLiked: false, declined: false, dateId: null, note: null,
    }])),
    dates: [],
    unseen: { likes: 0, meet: 0 },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const d = defaultState();
    // merge so new demo people / fields appear after updates
    s.profile = { ...d.profile, ...(s.profile || {}) };
    // migrate single photo -> photos[]
    if (!Array.isArray(s.profile.photos)) s.profile.photos = [];
    if (s.profile.photo && !s.profile.photos.length) s.profile.photos = [s.profile.photo];
    delete s.profile.photo;
    s.people = Object.fromEntries(Object.entries(d.people).map(([id, base]) => [id, { ...base, ...(s.people?.[id] || {}) }]));
    s.unseen = { ...d.unseen, ...(s.unseen || {}) };
    s.dates = s.dates || [];
    return { ...d, ...s };
  } catch {
    return defaultState();
  }
}

let APP_STATE = loadState();
window.APP_STATE = APP_STATE;

const save = () => localStorage.setItem(LS_KEY, JSON.stringify(APP_STATE));

/* ---------------- utils ---------------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- inline SVG icons (no emoji) ---------------- */
const ICONS = {
  x: ['o', '<path d="M6 6l12 12M18 6L6 18"/>'],
  check: ['o', '<path d="M4.5 12.5l5 5 10-11"/>'],
  heart: ['s', '<path d="M12 21C5.6 16.6 3 12.5 3 8.9 3 6.1 5.2 4 7.7 4c1.7 0 3.2.9 4.3 2.5C13.1 4.9 14.6 4 16.3 4 18.8 4 21 6.1 21 8.9c0 3.6-2.6 7.7-9 12.1z"/>'],
  sparkle: ['s', '<path d="M12 2l1.7 6.1c.2.6.6 1 1.2 1.2L21 11l-6.1 1.7c-.6.2-1 .6-1.2 1.2L12 20l-1.7-6.1c-.2-.6-.6-1-1.2-1.2L3 11l6.1-1.7c.6-.2 1-.6 1.2-1.2z"/>'],
  pin: ['s', '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2a7 7 0 00-7 7c0 4.7 5.4 10.6 6.3 11.5a1 1 0 001.4 0C13.6 19.6 19 13.7 19 9a7 7 0 00-7-7zm0 4.6A2.4 2.4 0 1012 11.4 2.4 2.4 0 0012 6.6z"/>'],
  globe: ['o', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3.3 2.8 14.7 0 18M12 3c-2.8 3.3-2.8 14.7 0 18"/>'],
  route: ['o', '<circle cx="6.5" cy="17.5" r="2.2"/><circle cx="17.5" cy="6.5" r="2.2"/><path d="M8.2 15.8 15.8 8.2" stroke-dasharray="2 2.4"/>'],
  compass: ['o', '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z"/>'],
  walk: ['o', '<circle cx="13" cy="4.3" r="1.7"/><path d="M13 8.6l-2.4 4.2 2.9 2 1.1 5M10.6 12.8 7.4 14.6M15.5 14.8l2.9 1"/>'],
  bike: ['o', '<circle cx="5.6" cy="16.4" r="3.2"/><circle cx="18.4" cy="16.4" r="3.2"/><path d="M5.6 16.4l4.6-6.4h4.2M12 7.6h3.6l2.8 8.8M9 10h6"/>'],
  transit: ['o', '<rect x="6" y="3.5" width="12" height="13.5" rx="3"/><path d="M6.5 11.5h11M9 3.7V2.6h6v1.1M8.5 21l2-3.6M15.5 21l-2-3.6"/>'],
  car: ['o', '<path d="M3.6 14.6l1.6-4.7A2.5 2.5 0 017.6 8.2h8.8a2.5 2.5 0 012.4 1.7l1.6 4.7M4 14.6h16v3.4H4z"/><circle cx="7.6" cy="18" r="1.5"/><circle cx="16.4" cy="18" r="1.5"/>'],
  envelope: ['o', '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>'],
  expand: ['o', '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>'],
  info: ['o', '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.4"/><circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none"/>'],
  shuffle: ['o', '<path d="M17 4l3 3-3 3M17 14l3 3-3 3M4 7h4.5c3.5 0 5 10 8.5 10H20M4 17h4.5c1.6 0 2.8-2 3.7-4.2"/>'],
  plus: ['o', '<path d="M12 5v14M5 12h14"/>'],
};
function svgIcon(name, cls = '') {
  const ic = ICONS[name];
  if (!ic) return '';
  const [kind, body] = ic;
  const paint = kind === 's'
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" ${paint} aria-hidden="true">${body}</svg>`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dyn = (id) => APP_STATE.people[id];
const base = (id) => DEMO_BY_ID[id];
const avatar = (p) => avatarDataURI(p.name, p.hues[0], p.hues[1]);
const myPhotos = () => (APP_STATE.profile.photos || []);
const myAvatar = () => myPhotos()[0] || avatarDataURI(APP_STATE.profile.name || 'You', 330, 275);
/** photos to show for a person (demo people have one generated portrait) */
const personPhotos = (p) => [avatar(p)];

function fmtDate(iso) {
  const loc = APP_STATE.profile.locale;
  const d = new Date(iso + 'T12:00');
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const diff = Math.round((d - today) / 864e5);
  if (diff === 0) return t('dt_today');
  if (diff === 1) return t('dt_tomorrow');
  return d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' });
}
function isoPlusDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function langList(codes) { return codes.map((c) => LANG_NAMES[c] || c).join(' · '); }

function toast(text, img) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = (img ? `<img src="${img}" alt="">` : '') + `<span>${esc(text)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function heartBurst(x, y, n = 12) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'burst' + (i % 3 === 2 ? ' ink' : '');
    s.innerHTML = svgIcon('heart');
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.setProperty('--dx', rnd(-130, 130) + 'px');
    s.style.setProperty('--dy', rnd(-190, -40) + 'px');
    s.style.setProperty('--rot', rnd(-90, 90) + 'deg');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }
}

/* ---------------- filters ---------------- */
function matchesPref(p) {
  const lf = APP_STATE.profile.lookingFor;
  return lf === 'all' || p.gender === (lf === 'w' ? 'w' : 'm');
}
const inRadius = (p) => p.km <= APP_STATE.profile.radiusKm;

const deckList = () => DEMO_PEOPLE.filter((p) => {
  const d = dyn(p.id);
  return matchesPref(p) && inRadius(p) && d.online && !d.iLiked && !d.declined && !d.likedMe;
}).sort((a, b) => a.km - b.km);

const likesList = () => DEMO_PEOPLE.filter((p) => {
  const d = dyn(p.id);
  return d.likedMe && !d.iLiked && !d.declined && d.online;
}).sort((a, b) => a.km - b.km);

const matchList = () => DEMO_PEOPLE.filter((p) => {
  const d = dyn(p.id);
  return d.likedMe && d.iLiked && !d.declined && !d.dateId;
});

const onlineNearby = () => DEMO_PEOPLE.filter((p) => dyn(p.id).online && inRadius(p) && matchesPref(p)).length;

/* ---------------- static i18n ---------------- */
function renderStatic() {
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.documentElement.lang = APP_STATE.profile.locale;
}

/* ---------------- header & tabs ---------------- */
let currentTab = 'discover';

function renderHeader() {
  $('#online-count').innerHTML = `<b>${onlineNearby()}</b>&nbsp;${esc(t('online_nearby'))}`;
  $('#me-avatar').src = myAvatar();
}

function renderBadges() {
  const set = (id, n) => {
    const el = $(id);
    el.textContent = n;
    el.classList.toggle('hidden', n <= 0);
  };
  set('#badge-likes', APP_STATE.unseen.likes);
  set('#badge-meet', APP_STATE.unseen.meet);
}

function switchTab(tab) {
  currentTab = tab;
  if (tab === 'likes') APP_STATE.unseen.likes = 0;
  if (tab === 'meet') APP_STATE.unseen.meet = 0;
  save();
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + tab));
  renderBadges();
  renderCurrentView();
}

function renderCurrentView() {
  renderHeader();
  if (currentTab === 'discover') renderDiscover();
  if (currentTab === 'likes') renderLikes();
  if (currentTab === 'meet') renderMeet();
  if (currentTab === 'dates') renderDates();
}

/* ---------------- discover: the orbit ---------------- */
let discoverFilter = 'all'; // 'all' | 'near'
let centralId = null;       // person currently in the middle of the orbit

const NEAR_KM = 3;

/* satellite slots around the central card (percent + size px) */
const ORBIT_SLOTS = [
  { x: 20, y: 8, s: 66 }, { x: 80, y: 10, s: 72 },
  { x: 7, y: 42, s: 74 }, { x: 94, y: 38, s: 60 },
  { x: 16, y: 86, s: 58 }, { x: 86, y: 82, s: 70 },
];
const ORBIT_STARS = [
  [8, 18], [30, 4], [55, 7], [88, 24], [96, 62],
  [70, 94], [40, 96], [3, 70], [62, 27], [34, 60],
];

function orbitList() {
  const list = deckList();
  return discoverFilter === 'near' ? list.filter((p) => p.km <= NEAR_KM) : list;
}

function renderDiscover() {
  $('#d-head').innerHTML = esc(t('d_head')).replace('{', '<em>').replace('}', '</em>');
  $('#fpills').innerHTML = `
    <button class="fpill ${discoverFilter === 'all' ? 'on' : ''}" data-f="all">${svgIcon('sparkle')} ${esc(t('f_all'))}</button>
    <button class="fpill ${discoverFilter === 'near' ? 'on' : ''}" data-f="near">${esc(t('f_near'))}</button>
    <span class="fpill static"><i class="dot"></i>${onlineNearby()} ${esc(t('d_online'))}</span>`;
  $$('#fpills .fpill[data-f]').forEach((b) => {
    b.onclick = () => { discoverFilter = b.dataset.f; centralId = null; renderDiscover(); };
  });

  const deck = $('#deck');
  const list = orbitList();
  if (!list.length) {
    deck.innerHTML = `<div class="empty"><div class="eico">${svgIcon('sparkle')}</div>
      <h3>${esc(t('d_empty_title'))}</h3><p>${esc(t('d_empty_sub', { km: APP_STATE.profile.radiusKm }))}</p></div>`;
    return;
  }
  const p = list.find((x) => x.id === centralId) || list[0];
  centralId = p.id;
  const sats = list.filter((x) => x.id !== p.id).slice(0, ORBIT_SLOTS.length);

  deck.innerHTML = `
    <div class="orbit-wrap">
    <div class="orbit">
      <div class="halo"></div>
      <div class="ring r1"></div>
      <div class="ring r2"></div>
      <div class="stars">${ORBIT_STARS.map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('')}</div>
      <article class="ccard" data-id="${p.id}">
        <div class="cph">
          <img src="${avatar(p)}" alt="${esc(p.name)}">
          <div class="cfade"></div>
          <div class="cinfo">
            <div class="cname">${esc(p.name)}, ${p.age} <span class="vbadge">${svgIcon('check')}</span></div>
            <div class="ckm"><i class="dot"></i> ${esc(t('d_km', { km: p.km.toFixed(1).replace('.0', '') }))} ${esc(t('map_from_you'))}</div>
            <div class="cbtns">
              <button class="cbtn" id="cc-info" aria-label="${esc(t('info_view'))}">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11.2v4.6"/><circle cx="12" cy="8" r="1.05" fill="currentColor" stroke="none"/></svg>
              </button>
            </div>
          </div>
        </div>
      </article>
      ${sats.map((s, i) => {
        const sl = ORBIT_SLOTS[i];
        return `<button class="oav" data-id="${s.id}" aria-label="${esc(s.name)}"
          style="--x:${sl.x}%;--y:${sl.y}%;--s:${sl.s}px">
          <img src="${avatar(s)}" alt=""><i class="spark">${svgIcon('sparkle')}</i>
        </button>`;
      }).join('')}
    </div>
    </div>
    <div class="deck-actions">
      <button class="act skip" id="act-skip" aria-label="${esc(t('d_next'))}">${svgIcon('x')}</button>
      <button class="act like" id="act-like" aria-label="${esc(t('d_like'))}">${svgIcon('heart')}</button>
      <button class="act shuf" id="act-shuf" aria-label="${esc(t('d_shuffle'))}">
        <svg viewBox="0 0 24 24"><path d="M20 5v5h-5"/><path d="M20 10a8 8 0 10 2 5.3"/></svg>
      </button>
    </div>`;

  $('#act-like').onclick = (e) => { heartBurst(e.clientX, e.clientY); deckAction(p.id, true); };
  $('#act-skip').onclick = () => deckAction(p.id, false);
  $('#act-shuf').onclick = () => {
    const others = list.filter((x) => x.id !== p.id);
    if (others.length) { centralId = pickOf(others).id; renderDiscover(); }
  };
  $('#cc-info').onclick = () => openProfileSheet(p.id);
  $$('.oav', deck).forEach((b) => {
    b.onclick = () => { centralId = b.dataset.id; renderDiscover(); };
  });

  sizeOrbit();
  requestAnimationFrame(sizeOrbit);
  bindOrbitResize();

  if (!APP_STATE.introShown) {
    APP_STATE.introShown = true; save();
    setTimeout(() => toast(t('demo_toast')), 700);
  }
}

/* size the orbit to fit its deck exactly — static, never scrolls/overflows */
function sizeOrbit() {
  const wrap = $('#deck .orbit-wrap');
  const orbit = wrap && $('.orbit', wrap);
  if (!orbit) return;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (!w || !h) return;
  const width = Math.min(w, h * (39 / 46));
  orbit.style.width = Math.floor(width) + 'px';
}
let orbitResizeBound = false;
function bindOrbitResize() {
  if (orbitResizeBound) return;
  orbitResizeBound = true;
  addEventListener('resize', () => { if (currentTab === 'discover') sizeOrbit(); });
}

function deckAction(id, liked) {
  const card = $('#deck .ccard');
  if (card) card.classList.add(liked ? 'leave-like' : 'leave-skip');
  const d = dyn(id);
  if (liked) { d.iLiked = true; scheduleLikeBack(id); } else { d.declined = true; }
  centralId = null;
  save();
  setTimeout(() => { renderDiscover(); renderHeader(); }, 420);
}

/* they may like you back a bit later */
function scheduleLikeBack(id) {
  setTimeout(() => {
    const d = dyn(id);
    if (!d || d.likedMe || d.declined) return;
    if (Math.random() < 0.6) {
      d.likedMe = true; d.online = true;
      onMutualLike(id);
    }
  }, rnd(12000, 45000));
}

/* ---------------- photo viewer ---------------- */
function openGallery(images, start = 0) {
  images = (images || []).filter(Boolean);
  if (!images.length) return;
  let i = Math.max(0, Math.min(start, images.length - 1));
  const v = $('#viewer');
  const close = () => { v.classList.add('hidden'); v.innerHTML = ''; v.ontouchstart = v.ontouchend = null; };
  const draw = () => {
    v.innerHTML = `
      <div class="vtop">
        <span class="vcount">${i + 1} / ${images.length}</span>
        <button class="icon-btn" id="gv-close">${svgIcon('x')}</button>
      </div>
      <div class="vstage">
        ${images.length > 1 ? '<button class="vnav prev" id="gv-prev">‹</button>' : ''}
        <img src="${images[i]}" alt="">
        ${images.length > 1 ? '<button class="vnav next" id="gv-next">›</button>' : ''}
      </div>
      <div class="vdots">${images.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>`;
    $('#gv-close').onclick = close;
    const pv = $('#gv-prev'), nx = $('#gv-next');
    if (pv) pv.onclick = () => { i = (i - 1 + images.length) % images.length; draw(); };
    if (nx) nx.onclick = () => { i = (i + 1) % images.length; draw(); };
  };
  v.classList.remove('hidden');
  v.onclick = (e) => { if (e.target === v) close(); };
  let sx = 0;
  v.ontouchstart = (e) => { sx = e.touches[0].clientX; };
  v.ontouchend = (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 45 && images.length > 1) { i = (i + (dx < 0 ? 1 : -1) + images.length) % images.length; draw(); }
  };
  draw();
}

/* ---------------- profile / info sheet ---------------- */
function openProfileSheet(pid) {
  const p = base(pid);
  const d = dyn(pid);
  const photos = personPhotos(p);
  const s = $('#sheet-profile');
  s.innerHTML = `
    <div class="sheet-card">
      <div class="grab"></div>
      <div class="sheet-head">
        <div class="sheet-title">${esc(t('info_view'))}</div>
        <button class="icon-btn" id="ps-close">${svgIcon('x')}</button>
      </div>
      <div class="psheet-hero" id="ps-hero">
        <img src="${photos[0]}" alt="">
        <div class="pfade"></div>
        ${photos.length > 1 ? `<div class="pthumbs">${photos.map((_, k) => `<i class="${k === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}
        <div class="pexpand">${svgIcon('expand')}</div>
        <div class="pcap"><div class="pn">${esc(p.name)}, ${p.age} <span class="vbadge">${svgIcon('check')}</span></div></div>
      </div>
      <div class="pmeta-row">
        <span class="mtag ${d.online ? 'on' : ''}"><i class="dot"></i>${esc(d.online ? t('d_online') : t('meet_offline'))}</span>
        <span class="mtag">${svgIcon('pin')} ${esc(t('d_km', { km: p.km.toFixed(1).replace('.0', '') }))} ${esc(t('map_from_you'))}</span>
      </div>
      <div class="pmeta-row">
        ${p.langs.map((c) => `<span class="mtag">${svgIcon('globe')} ${esc(LANG_NAMES[c] || c)}</span>`).join('')}
      </div>
    </div>`;
  s.classList.remove('hidden');
  const close = () => s.classList.add('hidden');
  $('#ps-close').onclick = close;
  s.onclick = (e) => { if (e.target === s) close(); };
  $('#ps-hero').onclick = () => openGallery(photos, 0);
}

/* ---------------- place map + travel time ---------------- */
function haversineKm(a, b) {
  const R = 6371, toR = (x) => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/* real device location (once granted); falls back to the demo anchor */
let USER_GEO = null;
let geoAsked = false;
function ensureGeo(cb) {
  if (USER_GEO) return cb(USER_GEO);
  if (!navigator.geolocation) return cb(null);
  navigator.geolocation.getCurrentPosition(
    (pos) => { USER_GEO = { lat: pos.coords.latitude, lng: pos.coords.longitude }; cb(USER_GEO); },
    () => cb(null),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
  );
}
const myLoc = () => USER_GEO || MY_LOCATION;
/** demo places are anchored around Berlin; when we know the real location
 *  we shift them by the same vector so distances stay realistic AND the
 *  route opened in Maps matches the in-app estimate. */
function placeGeo(name) {
  const g = PLACE_GEO[name];
  if (!g) return null;
  if (!USER_GEO) return { lat: g.lat, lng: g.lng };
  return { lat: g.lat + (USER_GEO.lat - MY_LOCATION.lat), lng: g.lng + (USER_GEO.lng - MY_LOCATION.lng) };
}

const routeKm = (geo) => haversineKm(myLoc(), geo) * 1.3; // rough road factor
function etaMin(km, mode) {
  let m = km / mode.kmh * 60;
  if (mode.id === 'transit') m += 5; // wait / transfer
  return Math.max(1, Math.round(m));
}
/** directions link with explicit origin so the opened route matches our ETA */
function mapsLink(place, me, mode, name) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) return `https://maps.apple.com/?saddr=${me.lat},${me.lng}&daddr=${place.lat},${place.lng}&dirflg=${mode.a}&q=${encodeURIComponent(name)}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${me.lat},${me.lng}&destination=${place.lat},${place.lng}&travelmode=${mode.g}`;
}
/** view (not route) link — lets the user open & zoom the place in Maps */
function mapsViewLink(place, name) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) return `https://maps.apple.com/?ll=${place.lat},${place.lng}&q=${encodeURIComponent(name)}`;
  return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
}
function project(lat, lng, z) {
  const n = 2 ** z, rad = lat * Math.PI / 180;
  return {
    x: (lng + 180) / 360 * n * 256,
    y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n * 256,
  };
}
/** Static OSM tile map fitted to show BOTH the place (pin) and you (dot).
 *  Logical 300×200 canvas (matches .map-wrap 3/2) → percentage positions.
 *  <img> onerror gives a reliable fallback when tiles can't load. */
function staticMap(place, me) {
  const W = 300, H = 200;
  let z = 16;
  for (; z >= 3; z--) {
    const a = project(place.lat, place.lng, z), b = project(me.lat, me.lng, z);
    if (Math.abs(a.x - b.x) < W * 0.6 && Math.abs(a.y - b.y) < H * 0.6) break;
  }
  const pp = project(place.lat, place.lng, z), pm = project(me.lat, me.lng, z);
  const originX = (pp.x + pm.x) / 2 - W / 2, originY = (pp.y + pm.y) / 2 - H / 2;
  const t0x = Math.floor(originX / 256), t1x = Math.floor((originX + W) / 256);
  const t0y = Math.floor(originY / 256), t1y = Math.floor((originY + H) / 256);
  const wpct = (256 / W * 100).toFixed(3), hpct = (256 / H * 100).toFixed(3);
  let tiles = '';
  for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
    const left = ((tx * 256 - originX) / W * 100).toFixed(3);
    const top = ((ty * 256 - originY) / H * 100).toFixed(3);
    tiles += `<img class="mtile" style="left:${left}%;top:${top}%;width:${wpct}%;height:${hpct}%" src="https://tile.openstreetmap.org/${z}/${tx}/${ty}.png" alt="" loading="lazy">`;
  }
  const mark = (p, cls, inner) => {
    const px = project(p.lat, p.lng, z);
    const l = ((px.x - originX) / W * 100).toFixed(2), t = ((px.y - originY) / H * 100).toFixed(2);
    return `<div class="${cls}" style="left:${l}%;top:${t}%">${inner}</div>`;
  };
  return `<div class="map-tiles">${tiles}${mark(me, 'memark', '')}${mark(place, 'mmarker', svgIcon('pin'))}</div>`;
}

/* ---- real routing via a keyless public service ----
   Uses the FOSSGIS Valhalla demo server for real walk/bike/car times
   (road distance, elevation-aware) so the in-app number matches Maps —
   no API key, works for every user. It is a public fair-use server, so
   swap ROUTER_URL for your own backend before scaling. Transit has no
   costing here, so it stays a distance estimate. Offline → estimate. */
const ROUTER_URL = 'https://valhalla1.openstreetmap.de/route';
const ROUTE_COSTING = { walk: 'pedestrian', bike: 'bicycle', car: 'auto' };
const routeCache = new Map();   // `${sig}|${mode}` -> { km, min }
const routeSettled = new Set(); // signatures whose fetch has finished
const routeReq = new Set();     // signatures currently/already requested
const routeSig = (name, me) => `${name}|${me.lat.toFixed(4)},${me.lng.toFixed(4)}`;
const cachedRoute = (name, me, mode) => routeCache.get(`${routeSig(name, me)}|${mode}`);
async function fetchRoutes(name, me, geo) {
  const sig = routeSig(name, me);
  if (!navigator.onLine || routeReq.has(sig)) return false;
  routeReq.add(sig);
  await Promise.allSettled(Object.entries(ROUTE_COSTING).map(async ([mode, costing]) => {
    try {
      const body = {
        locations: [{ lat: me.lat, lon: me.lng }, { lat: geo.lat, lon: geo.lng }],
        costing, units: 'kilometers', directions_type: 'none',
      };
      // GET with ?json= avoids a CORS preflight (simple request)
      const r = await fetch(ROUTER_URL + '?json=' + encodeURIComponent(JSON.stringify(body)));
      if (!r.ok) return;
      const sum = (await r.json())?.trip?.summary;
      if (sum && sum.time != null) {
        routeCache.set(`${sig}|${mode}`, { km: sum.length, min: Math.max(1, Math.round(sum.time / 60)) });
      }
    } catch { /* keep estimate */ }
  }));
  routeSettled.add(sig);
  return true;
}
function fmtEta(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60), m = min % 60;
    return '~' + h + ' ' + t('u_h') + (m ? ' ' + m + ' ' + t('u_min') : '');
  }
  return '~' + min + ' ' + t('u_min');
}

let mapMode = 'transit';
function placeTag(name) {
  return `<span class="ptag" data-map="${esc(name)}">${svgIcon('pin')} ${esc(name)}</span>`;
}
function openPlaceMap(name) {
  const geo = placeGeo(name);
  const me = myLoc();
  const s = $('#sheet-map');
  const km = geo ? routeKm(geo) : null;
  const sig = geo ? routeSig(name, me) : '';
  const loading = geo && navigator.onLine && !routeSettled.has(sig);
  const curMode = TRAVEL_MODES.find((m) => m.id === mapMode) || TRAVEL_MODES[0];
  const carRoute = geo ? cachedRoute(name, me, 'car') : null;
  const metFor = (m) => {
    const c = ROUTE_COSTING[m.id] ? cachedRoute(name, me, m.id) : null;
    if (c) return fmtEta(c.min);
    if (ROUTE_COSTING[m.id] && loading) return '<span class="tdots"><i></i><i></i><i></i></span>';
    const baseKm = (m.id === 'transit' && carRoute) ? carRoute.km : km;
    return fmtEta(etaMin(baseKm, m));
  };
  const modesHTML = geo ? `<div class="modes">${TRAVEL_MODES.map((m) => `
      <button class="mode ${m.id === mapMode ? 'on' : ''}" data-m="${m.id}">
        <span class="mi">${svgIcon(m.icon)}</span>
        <span class="met">${metFor(m)}</span>
        <span class="ml">${esc(t('mode_' + m.id))}</span>
      </button>`).join('')}</div>` : '';
  const curRoute = geo && ROUTE_COSTING[mapMode] ? cachedRoute(name, me, mapMode) : null;
  const distKm = curRoute ? curRoute.km : km;
  const openHref = geo ? mapsLink(geo, me, curMode, name)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  s.innerHTML = `
    <div class="sheet-card">
      <div class="grab"></div>
      <div class="sheet-head"><div class="sheet-title">${svgIcon('pin')} ${esc(name)}</div>
        <button class="icon-btn" id="mp-close">${svgIcon('x')}</button></div>
      <div class="map-wrap" id="mp-wrap">
        <div class="map-fallback"><div class="mpin">${svgIcon('pin')}</div><div>${esc(geo ? t('map_offline') : name)}</div></div>
        ${geo ? staticMap(geo, me) : ''}
        ${geo ? `<div class="map-expand">${svgIcon('expand')}</div>` : ''}
      </div>
      ${geo ? `<div class="map-legend"><span><i class="lg-you"></i>${esc(t('map_you'))}</span><span><i class="lg-place"></i>${esc(name)}</span></div>` : ''}
      ${geo ? `<div class="map-dist">${svgIcon('route')} <b>${esc(t('d_km', { km: distKm.toFixed(1).replace('.0', '') }))}</b> ${esc(t('map_from_you'))}</div>` : ''}
      <div class="section-sub" style="margin-bottom:8px">${esc(t('map_title'))}</div>
      ${modesHTML}
      <a class="btn btn-primary" id="mp-open" href="${openHref}" target="_blank" rel="noopener">${svgIcon('compass')} ${esc(t('map_open'))}</a>
    </div>`;
  s.classList.remove('hidden');
  const close = () => s.classList.add('hidden');
  $('#mp-close').onclick = close;
  s.onclick = (e) => { if (e.target === s) close(); };
  $$('.mode', s).forEach((b) => { b.onclick = () => { mapMode = b.dataset.m; openPlaceMap(name); }; });
  // tap the preview to open & zoom the place in the real Maps app
  const wrap = $('#mp-wrap');
  if (wrap && geo) wrap.onclick = () => window.open(mapsViewLink(geo, name), '_blank', 'noopener');
  // if any tile fails to load (offline), drop the tile layer -> styled fallback shows
  const tilesEl = $('.map-tiles', s);
  if (tilesEl) $$('.mtile', tilesEl).forEach((im) => { im.onerror = () => tilesEl.classList.add('hide'); });
  // fetch real routes once and re-render with the results
  if (geo && navigator.onLine && !routeSettled.has(sig)) {
    fetchRoutes(name, me, geo).then((did) => {
      if (did && !$('#sheet-map').classList.contains('hidden')) openPlaceMap(name);
    });
  }
  // ask for real location once; re-render with it so ETA & route match reality
  if (!geoAsked) {
    geoAsked = true;
    ensureGeo((g) => { if (g && !$('#sheet-map').classList.contains('hidden')) openPlaceMap(name); });
  }
}

/* delegate: any element with data-map opens the place map */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-map]');
  if (el) { e.preventDefault(); e.stopPropagation(); openPlaceMap(el.dataset.map); }
});

/* ---------------- icebreaker note ---------------- */
function notePresets() {
  const loc = APP_STATE.profile.locale;
  return (I18N[loc] && I18N[loc].note_presets) || I18N.en.note_presets;
}
function openNote(pid) {
  const p = base(pid);
  const d = dyn(pid);
  const s = $('#sheet-note');
  const draw = () => {
    const n = d.note;
    s.innerHTML = `
      <div class="sheet-card">
        <div class="grab"></div>
        <div class="wz-head">
          <img src="${avatar(p)}" alt="">
          <div><div class="wname">${esc(p.name)}, ${p.age}</div><div class="wstep">${esc(t('note_title'))}</div></div>
          <button class="icon-btn wz-x" id="nt-close">${svgIcon('x')}</button>
        </div>
        <p class="section-sub" style="margin-bottom:14px">${esc(t('note_sub'))}</p>
        ${n && n.mine ? `<div class="note-log">
            <div class="pb me"><img src="${myAvatar()}" alt=""><div class="bub">${esc(n.mine)}</div></div>
            ${n.theirs ? `<div class="pb"><img src="${avatar(p)}" alt=""><div class="bub ok">${esc(n.theirs)}</div></div>` : '<div class="pb"><img src="' + avatar(p) + '" alt=""><div class="bub"><span class="tdots"><i></i><i></i><i></i></span></div></div>'}
          </div>` : ''}
        <div class="note-presets">${notePresets().map((x) => `<button class="chip npreset">${esc(x)}</button>`).join('')}</div>
        <div class="note-in">
          <input class="input" id="nt-in" maxlength="120" placeholder="${esc(t('note_ph', { name: p.name }))}">
          <button class="btn btn-primary btn-sm" id="nt-send">${esc(n && n.mine ? t('note_edit') : t('note_send'))}</button>
        </div>
      </div>`;
    $('#nt-close').onclick = () => s.classList.add('hidden');
    s.onclick = (e) => { if (e.target === s) s.classList.add('hidden'); };
    $$('.npreset', s).forEach((b) => { b.onclick = () => { $('#nt-in').value = b.textContent; $('#nt-in').focus(); }; });
    $('#nt-send').onclick = () => {
      const val = $('#nt-in').value.trim();
      if (!val) return;
      const firstTime = !(d.note && d.note.mine);
      d.note = { mine: val, theirs: null, at: Date.now() };
      save();
      draw();
      toast(t('note_sent', { name: p.name }), avatar(p));
      if (currentTab === 'meet') renderMeet();
      if (firstTime) setTimeout(() => {
        if (dyn(pid).note && !dyn(pid).note.theirs) {
          dyn(pid).note.theirs = t('note_reply');
          save();
          if (!$('#sheet-note').classList.contains('hidden')) draw();
          if (currentTab === 'meet') renderMeet();
        }
      }, rnd(2500, 5000));
    };
  };
  s.classList.remove('hidden');
  draw();
}

/* ---------------- likes ---------------- */
function renderLikes() {
  const grid = $('#lgrid');
  const list = likesList();
  $('#likes-free').textContent = t('l_free');
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="eico">${svgIcon('sparkle')}</div>
      <h3>${esc(t('l_empty_title'))}</h3><p>${esc(t('l_empty_sub'))}</p></div>`;
    return;
  }
  grid.innerHTML = list.map((p) => `
    <div class="lcard" data-id="${p.id}">
      <img class="limg" src="${avatar(p)}" alt="${esc(p.name)}">
      <span class="lheart">${svgIcon('heart')}</span>
      <div class="lbody">
        <div class="lname">${esc(p.name)}, ${p.age} <span class="vbadge" style="width:16px;height:16px;font-size:9px">${svgIcon('check')}</span></div>
        <div class="lsub">${esc(t('d_km', { km: p.km.toFixed(1).replace('.0', '') }))} · ${esc(langList(p.langs))}</div>
        <div class="lbtns">
          <button class="mini no" title="${esc(t('l_decline'))}">${svgIcon('x')}</button>
          <button class="mini yes" title="${esc(t('l_like_back'))}">${svgIcon('heart')}</button>
        </div>
      </div>
    </div>`).join('');
  $$('.lcard', grid).forEach((card) => {
    const id = card.dataset.id;
    $('.yes', card).onclick = (e) => { heartBurst(e.clientX, e.clientY); dyn(id).iLiked = true; save(); onMutualLike(id, true); renderLikes(); };
    $('.no', card).onclick = () => { dyn(id).declined = true; save(); renderLikes(); renderHeader(); };
  });
}

/* ---------------- match ---------------- */
function onMutualLike(id, instant = false) {
  APP_STATE.unseen.meet++;
  save();
  renderBadges();
  const p = base(id);
  if (instant || document.visibilityState === 'visible') showMatchModal(id);
  else toast(t('match_toast', { name: p.name }), avatar(p));
  if (currentTab === 'meet') renderMeet();
}

function showMatchModal(id) {
  const p = base(id);
  const w = $('#match-modal');
  w.innerHTML = `
    <div>
      <div class="mm-title">${esc(t('m_title'))}</div>
      <div class="mm-avs"><img src="${myAvatar()}" alt=""><img src="${avatar(p)}" alt=""></div>
      <div class="mm-heart">${svgIcon('heart')}</div>
      <p class="mm-sub">${esc(t('m_sub', { name: p.name }))}</p>
      <div class="mm-btns">
        <button class="btn btn-primary" id="mm-go">${esc(t('m_schedule'))}</button>
        <button class="btn btn-ghost" id="mm-msg">${svgIcon('envelope')} ${esc(t('note_open'))}</button>
        <button class="btn btn-ghost" id="mm-later">${esc(t('m_later'))}</button>
      </div>
    </div>`;
  w.classList.remove('hidden');
  heartBurst(innerWidth / 2, innerHeight / 3, 16);
  $('#mm-go').onclick = () => { w.classList.add('hidden'); openWizard(id); };
  $('#mm-msg').onclick = () => { w.classList.add('hidden'); openNote(id); };
  $('#mm-later').onclick = () => { w.classList.add('hidden'); renderCurrentView(); };
}

/* ---------------- meet ---------------- */
function renderMeet() {
  const wrap = $('#mlist');
  const list = matchList();
  if (!list.length) {
    wrap.innerHTML = `<div class="empty"><div class="eico">${svgIcon('sparkle')}</div>
      <h3>${esc(t('meet_empty_title'))}</h3><p>${esc(t('meet_empty_sub'))}</p></div>`;
    return;
  }
  wrap.innerHTML = list.map((p) => {
    const d = dyn(p.id);
    const off = !d.online;
    const sent = d.note && d.note.mine;
    const unread = d.note && d.note.theirs;
    return `
    <div class="mrow ${off ? 'offline' : ''}" data-id="${p.id}">
      <img class="mimg" src="${avatar(p)}" alt="">
      <div class="mtxt">
        <div class="mname">${esc(p.name)}, ${p.age} <span class="vbadge" style="width:16px;height:16px;font-size:9px">${svgIcon('check')}</span></div>
        <div class="msub">${off ? esc(t('meet_offline')) : `<i class="dot"></i> ${esc(t('d_online'))} · ${esc(t('d_km', { km: p.km }))}`}</div>
      </div>
      ${off ? '' : `<div class="macts">
        <button class="mbtn msg ${sent ? 'sent' : ''}" aria-label="${esc(t('note_open'))}">${svgIcon('envelope')}${unread ? '<i class="ndot"></i>' : ''}</button>
        <button class="go">${esc(t('meet_cta'))}</button>
      </div>`}
    </div>`;
  }).join('');
  $$('.mrow', wrap).forEach((row) => {
    const id = row.dataset.id;
    $('.mimg', row).onclick = () => openProfileSheet(id);
    const go = $('.go', row); if (go) go.onclick = () => openWizard(id);
    const msg = $('.msg', row); if (msg) msg.onclick = () => openNote(id);
  });
}

/* ---------------- wizard: 5 questions, no chat ---------------- */
let wiz = null;

function openWizard(pid) {
  const p = base(pid);
  dyn(pid).online = true; // partner stays online while planning
  wiz = { pid, alive: true, chooser: null, inside: null, place: '', dateISO: null, time: null };
  const sheet = $('#sheet-wizard');
  sheet.innerHTML = `
    <div class="sheet-card">
      <div class="grab"></div>
      <div class="wz-head">
        <img src="${avatar(p)}" alt="">
        <div><div class="wname">${esc(p.name)}, ${p.age}</div><div class="wstep" id="wz-step"></div></div>
        <button class="icon-btn wz-x" id="wz-close">${svgIcon('x')}</button>
      </div>
      <div class="wz-dots" id="wz-dots">${'<i></i>'.repeat(5)}</div>
      <div class="wz-body" id="wz-body"></div>
      <div class="wz-log" id="wz-log"></div>
    </div>`;
  sheet.classList.remove('hidden');
  $('#wz-close').onclick = closeWizard;
  sheet.onclick = (e) => { if (e.target === sheet) closeWizard(); };
  runWizard().catch(() => {});
}

function closeWizard() {
  if (wiz) wiz.alive = false;
  $('#sheet-wizard').classList.add('hidden');
  renderCurrentView();
}

const wzGuard = (w) => { if (!w.alive || w !== wiz) throw new Error('wizard-closed'); };

function wzStep(n) {
  $('#wz-step').textContent = t('w_step', { n });
  $$('#wz-dots i').forEach((el, i) => el.classList.toggle('done', i < n));
}
function wzQ(text) { $('#wz-body').innerHTML = `<div class="wz-q">${esc(text)}</div><div id="wz-zone"></div>`; }
function wzZone() { return $('#wz-zone'); }

function wzOptions(opts) {
  return new Promise((res) => {
    const zone = wzZone();
    zone.innerHTML = `<div class="wz-opts">${opts.map((o, i) =>
      `<button class="wz-opt ${o.hot ? 'hot' : ''}" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`;
    $$('.wz-opt', zone).forEach((b) => { b.onclick = () => { zone.innerHTML = ''; res(+b.dataset.i); }; });
  });
}

function wzInput(placeholder, suggestions) {
  return new Promise((res) => {
    const zone = wzZone();
    zone.innerHTML = `
      <div class="wz-inline">
        <input class="input" id="wz-in" maxlength="40" placeholder="${esc(placeholder)}">
        <button class="btn btn-primary btn-sm" id="wz-send">${esc(t('w_q3_send'))}</button>
      </div>
      <div class="wz-sugg">${suggestions.map((sname) => `<span class="chip pchip" data-pick="${esc(sname)}">${esc(sname)}<span class="pmap" data-map="${esc(sname)}">${svgIcon('pin')}</span></span>`).join('')}</div>`;
    const done = (v) => { if (!v.trim()) return; zone.innerHTML = ''; res(v.trim()); };
    $('#wz-send').onclick = () => done($('#wz-in').value);
    $('#wz-in').onkeydown = (e) => { if (e.key === 'Enter') done($('#wz-in').value); };
    $$('.pchip', zone).forEach((c) => { c.onclick = (e) => { if (e.target.closest('[data-map]')) return; done(c.dataset.pick); }; });
  });
}

function wzDatePick() {
  return new Promise((res) => {
    const zone = wzZone();
    zone.innerHTML = `
      <div class="wz-opts">
        <button class="wz-opt" data-v="${isoPlusDays(0)}">${esc(t('w_today'))}</button>
        <button class="wz-opt" data-v="${isoPlusDays(1)}">${esc(t('w_tomorrow'))}</button>
      </div>
      <div class="spacer"></div>
      <input class="input" type="date" id="wz-date" min="${isoPlusDays(0)}" value="${isoPlusDays(2)}">`;
    $$('.wz-opt', zone).forEach((b) => { b.onclick = () => { zone.innerHTML = ''; res(b.dataset.v); }; });
    $('#wz-date').onchange = (e) => { if (e.target.value) { zone.innerHTML = ''; res(e.target.value); } };
  });
}

/** times still reachable today; all of them for future days */
function futureTimes(dateISO) {
  if (dateISO !== isoPlusDays(0)) return TIME_IDEAS;
  const now = new Date();
  const cut = now.getHours() + now.getMinutes() / 60 + 0.75;
  const left = TIME_IDEAS.filter((s) => { const [h, m] = s.split(':').map(Number); return h + m / 60 >= cut; });
  return left.length ? left : ['23:00'];
}

function wzTimePick(dateISO) {
  return new Promise((res) => {
    const zone = wzZone();
    const chips = futureTimes(dateISO).slice(0, 4);
    zone.innerHTML = `
      <div class="wz-sugg">${chips.map((s) => `<button class="chip">${s}</button>`).join('')}</div>
      <div class="spacer"></div>
      <input class="input" type="time" id="wz-time" value="${chips[0]}">
      <div class="spacer"></div>
      <button class="btn btn-primary" id="wz-tok">OK</button>`;
    $$('.chip', zone).forEach((c) => { c.onclick = () => { zone.innerHTML = ''; res(c.textContent); }; });
    $('#wz-tok').onclick = () => { const v = $('#wz-time').value; if (v) { zone.innerHTML = ''; res(v); } };
  });
}

function wzLogClear() { $('#wz-log').innerHTML = ''; }
function meSays(text) {
  $('#wz-log').insertAdjacentHTML('beforeend',
    `<div class="pb me"><img src="${myAvatar()}" alt=""><div class="bub">${esc(text)}</div></div>`);
}
function partnerBubble(html, kind = '') {
  $('#wz-log').insertAdjacentHTML('beforeend',
    `<div class="pb"><img src="${avatar(base(wiz.pid))}" alt=""><div class="bub ${kind}">${html}</div></div>`);
  $('#wz-log').lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
}
async function partnerThinks(w, ms) {
  partnerBubble(`<span class="tdots"><i></i><i></i><i></i></span>`);
  await sleep(ms || rnd(1000, 2200));
  wzGuard(w);
  $('#wz-log').lastElementChild.remove();
}
function partnerSays(text, kind) { partnerBubble(esc(text), kind); }

/** my Yes/No decision on partner's counter-proposal */
function askYesNo(mapName) {
  return new Promise((res) => {
    const zone = wzZone();
    zone.innerHTML = `
      ${mapName && PLACE_GEO[mapName] ? `<button class="btn btn-ghost btn-sm" data-map="${esc(mapName)}" style="margin-bottom:14px">${svgIcon('pin')} ${esc(t('map_view'))}</button>` : ''}
      <div class="wz-q" style="font-size:17px">${esc(t('w_you_sure'))}</div>
      <div class="seg">
        <button class="wz-opt" id="yn-no">${svgIcon('x')} ${esc(t('w_no'))}</button>
        <button class="wz-opt hot" id="yn-yes">${esc(t('w_yes'))}</button>
      </div>`;
    $('#yn-yes').onclick = () => { zone.innerHTML = ''; res(true); };
    $('#yn-no').onclick = () => { zone.innerHTML = ''; res(false); };
  });
}

async function runWizard() {
  const w = wiz;
  const p = base(w.pid);
  const name = p.name;

  /* ---- Q1: who picks the spot ---- */
  wzStep(1);
  wzQ(t('w_q1'));
  const my = (await wzOptions([
    { label: t('w_q1_me'), hot: true },
    { label: t('w_q1_them', { name }) },
  ])) === 0 ? 'self' : 'other';
  wzGuard(w);
  meSays(my === 'self' ? t('w_q1_me') : t('w_q1_them', { name }));
  await partnerThinks(w);
  const their = Math.random() < 0.5 ? 'self' : 'other'; // partner's own wish
  if (my === 'self' && their === 'other') w.chooser = 'me';
  else if (my === 'other' && their === 'self') w.chooser = 'them';
  else {
    partnerSays(t('w_coin'));
    wzZone().innerHTML = `<div class="coin">?</div>`;
    await sleep(1700); wzGuard(w);
    w.chooser = Math.random() < 0.5 ? 'me' : 'them';
    wzZone().innerHTML = '';
  }
  partnerSays(w.chooser === 'me' ? t('w_coin_me') : t('w_coin_them', { name }), 'ok');
  await sleep(900); wzGuard(w);
  wzLogClear();

  if (w.chooser === 'me') await wizardIChoose(w, name);
  else await wizardTheyChoose(w, name);

  wzGuard(w);
  await wizardDone(w, p);
}

/* partner accepts / counters helper (me-chooser mode) */
async function partnerConfirm(w, name, pAccept, counterValue, applyCounter, mapName) {
  await partnerThinks(w);
  if (Math.random() < pAccept) { partnerSays(t('w_they_yes', { name }), 'ok'); await sleep(700); wzGuard(w); return; }
  partnerSays(t('w_they_no', { name }), 'nope');
  await partnerThinks(w, rnd(700, 1300));
  partnerSays(t('w_counter', { name, v: counterValue }));
  const ok = await askYesNo(mapName); wzGuard(w);
  if (ok) { meSays(t('w_yes')); applyCounter(); }
  else { meSays(t('w_no')); await partnerThinks(w, rnd(600, 1100)); partnerSays(t('w_they_yes', { name }), 'ok'); }
  await sleep(600); wzGuard(w);
}

async function wizardIChoose(w, name) {
  /* Q2 inside/outside */
  wzStep(2); wzLogClear();
  wzQ(t('w_q2'));
  w.inside = (await wzOptions([
    { label: t('w_inside'), hot: true },
    { label: t('w_outside') },
  ])) === 0;
  wzGuard(w);
  meSays(w.inside ? t('w_inside') : t('w_outside'));
  await partnerConfirm(w, name, 0.85, w.inside ? t('w_outside') : t('w_inside'), () => { w.inside = !w.inside; });

  /* Q3 where exactly */
  wzStep(3); wzLogClear();
  wzQ(t('w_q3'));
  const pool = PLACE_IDEAS[w.inside ? 'inside' : 'outside'];
  w.place = await wzInput(t('w_q3_ph'), pool.slice(0, 3));
  wzGuard(w);
  meSays(w.place);
  const counterPlace = pickOf(pool.filter((x) => x !== w.place));
  await partnerConfirm(w, name, 0.8, counterPlace, () => { w.place = counterPlace; }, counterPlace);

  /* Q4 date */
  wzStep(4); wzLogClear();
  wzQ(t('w_q4'));
  w.dateISO = await wzDatePick();
  wzGuard(w);
  meSays(fmtDate(w.dateISO));
  const counterDate = isoPlusDays(Math.max(1, Math.round((new Date(w.dateISO) - Date.now()) / 864e5) + 1));
  await partnerConfirm(w, name, 0.9, fmtDate(counterDate), () => { w.dateISO = counterDate; });

  /* Q5 time */
  wzStep(5); wzLogClear();
  wzQ(t('w_q5'));
  w.time = await wzTimePick(w.dateISO);
  wzGuard(w);
  meSays(w.time);
  const timePool = futureTimes(w.dateISO).filter((x) => x !== w.time);
  const counterTime = timePool.length ? pickOf(timePool) : w.time;
  await partnerConfirm(w, name, timePool.length ? 0.9 : 1, counterTime, () => { w.time = counterTime; });
}

/* partner proposes, I answer yes/no (them-chooser mode) */
async function theyPropose(w, name, values, applyValue, myPickFallback, mapable) {
  for (let i = 0; i < values.length; i++) {
    await partnerThinks(w);
    partnerSays(t('w_counter', { name, v: values[i] }));
    const ok = await askYesNo(mapable ? values[i] : null); wzGuard(w);
    if (ok) { meSays(t('w_yes')); applyValue(values[i], i); await sleep(500); wzGuard(w); return; }
    meSays(t('w_no'));
  }
  // I rejected everything → I pick, partner agrees
  await myPickFallback();
  await partnerThinks(w, rnd(700, 1200));
  partnerSays(t('w_they_yes', { name }), 'ok');
  await sleep(600); wzGuard(w);
}

async function wizardTheyChoose(w, name) {
  /* Q2 */
  wzStep(2); wzLogClear();
  wzQ(t('w_q2_ask', { name }));
  const firstInside = Math.random() < 0.6;
  await theyPropose(w, name,
    [firstInside ? t('w_inside') : t('w_outside'), firstInside ? t('w_outside') : t('w_inside')],
    (v, i) => { w.inside = i === 0 ? firstInside : !firstInside; },
    async () => { // can't reject both meaningfully → take the second
      w.inside = !firstInside; meSays(w.inside ? t('w_inside') : t('w_outside'));
    });

  /* Q3 */
  wzStep(3); wzLogClear();
  wzQ(t('w_q3_ask', { name }));
  const pool = PLACE_IDEAS[w.inside ? 'inside' : 'outside'];
  const offers = [pickOf(pool)];
  offers.push(pickOf(pool.filter((x) => x !== offers[0])));
  await theyPropose(w, name, offers, (v) => { w.place = v; }, async () => {
    wzQ(t('w_q3'));
    w.place = await wzInput(t('w_q3_ph'), pool.slice(0, 3)); wzGuard(w);
    meSays(w.place);
  }, true);

  /* Q4 */
  wzStep(4); wzLogClear();
  wzQ(t('w_q4_ask', { name }));
  const d1 = isoPlusDays(1), d2 = isoPlusDays(2);
  await theyPropose(w, name, [fmtDate(d1), fmtDate(d2)], (v, i) => { w.dateISO = i === 0 ? d1 : d2; }, async () => {
    wzQ(t('w_q4'));
    w.dateISO = await wzDatePick(); wzGuard(w);
    meSays(fmtDate(w.dateISO));
  });

  /* Q5 */
  wzStep(5); wzLogClear();
  wzQ(t('w_q5_ask', { name }));
  const tPool = futureTimes(w.dateISO);
  const t1 = pickOf(tPool), t2 = pickOf(tPool.filter((x) => x !== t1)) || t1;
  await theyPropose(w, name, t1 === t2 ? [t1] : [t1, t2], (v) => { w.time = v; }, async () => {
    wzQ(t('w_q5'));
    w.time = await wzTimePick(w.dateISO); wzGuard(w);
    meSays(w.time);
  });
}

async function wizardDone(w, p) {
  const d = {
    id: 'd' + Date.now(),
    personId: w.pid,
    place: w.place, inside: w.inside,
    dateISO: w.dateISO, time: w.time,
    createdAt: Date.now(),
  };
  APP_STATE.dates.push(d);
  dyn(w.pid).dateId = d.id;
  save();

  wzLogClear();
  wzStep(5);
  $('#wz-body').innerHTML = `
    <div class="wz-done">
      <div class="big">${svgIcon('heart')}</div>
      <h3>${esc(t('w_done_title'))}</h3>
      <p>${esc(t('w_done_sub'))}</p>
      <div class="wz-summary">
        <div class="srow"><span class="klabel">${esc(t('lbl_who'))}</span><b>${esc(p.name)}, ${p.age}</b></div>
        <div class="srow"><span class="klabel">${esc(t('lbl_where'))}</span><span>${placeTag(w.place)} · ${esc(t(w.inside ? 'dt_place_in' : 'dt_place_out'))}</span></div>
        <div class="srow"><span class="klabel">${esc(t('lbl_day'))}</span><b>${esc(fmtDate(w.dateISO))}</b></div>
        <div class="srow"><span class="klabel">${esc(t('lbl_time'))}</span><b>${esc(w.time)}</b></div>
      </div>
      <button class="btn btn-primary" id="wz-finish">${esc(t('w_done_btn'))}</button>
    </div>`;
  heartBurst(innerWidth / 2, innerHeight / 2.4, 18);
  toast(t('dt_saved', { name: p.name }), avatar(p));
  $('#wz-finish').onclick = () => { closeWizard(); switchTab('dates'); };
}

/* ---------------- dates ---------------- */
function dateWhenLabel(d) {
  const dt = new Date(d.dateISO + 'T' + d.time);
  const diffMs = dt - Date.now();
  if (diffMs < 0) return null;
  const h = Math.round(diffMs / 36e5);
  if (h < 1) return t('dt_soon');
  if (h < 24) return t('dt_in_hours', { n: h });
  return t('dt_in_days', { n: Math.round(h / 24) });
}

function renderDates() {
  const wrap = $('#dlists');
  const dates = [...APP_STATE.dates].sort((a, b) => (a.dateISO + a.time).localeCompare(b.dateISO + b.time));
  const upcoming = dates.filter((d) => new Date(d.dateISO + 'T' + d.time) >= Date.now());
  const past = dates.filter((d) => new Date(d.dateISO + 'T' + d.time) < Date.now());

  if (!dates.length) {
    wrap.innerHTML = `<div class="empty"><div class="eico">${svgIcon('sparkle')}</div>
      <h3>${esc(t('dt_empty_title'))}</h3><p>${esc(t('dt_empty_sub'))}</p></div>`;
    return;
  }

  const card = (d, isPast) => {
    const p = base(d.personId);
    return `
      <div class="dcard ${isPast ? 'past' : ''}" data-id="${d.id}">
        <img class="dimg" src="${avatar(p)}" alt="">
        <div class="dtxt">
          <div class="dname">${esc(p.name)}, ${p.age} <span class="vbadge" style="width:17px;height:17px;font-size:10px">${svgIcon('check')}</span></div>
          <div class="dline"><span class="klabel">${esc(t('lbl_where'))}</span><span>${placeTag(d.place)} · ${esc(t(d.inside ? 'dt_place_in' : 'dt_place_out'))}</span></div>
          <div class="dline"><span class="klabel">${esc(t('lbl_day'))}</span><span>${esc(fmtDate(d.dateISO))} · <b>${esc(d.time)}</b></span></div>
          ${!isPast && dateWhenLabel(d) ? `<span class="dwhen">${esc(dateWhenLabel(d))}</span>` : ''}
        </div>
        ${isPast ? '' : `<button class="dx" title="${esc(t('dt_cancel'))}">${svgIcon('x')}</button>`}
      </div>`;
  };

  wrap.innerHTML =
    (upcoming.length ? `<div class="dgroup"><h3>${esc(t('dt_upcoming'))}</h3>${upcoming.map((d) => card(d, false)).join('')}</div>` : '') +
    (past.length ? `<div class="dgroup"><h3>${esc(t('dt_past'))}</h3>${past.map((d) => card(d, true)).join('')}</div>` : '');

  $$('.dcard .dx', wrap).forEach((b) => {
    b.onclick = () => {
      const id = b.closest('.dcard').dataset.id;
      const d = APP_STATE.dates.find((x) => x.id === id);
      if (!d) return;
      const p = base(d.personId);
      APP_STATE.dates = APP_STATE.dates.filter((x) => x.id !== id);
      if (dyn(d.personId).dateId === id) dyn(d.personId).dateId = null;
      save();
      toast(t('dt_canceled', { name: p.name }), avatar(p));
      renderDates();
    };
  });
}

/* ---------------- settings ---------------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function openSettings() {
  const s = $('#sheet-settings');
  const pr = APP_STATE.profile;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  s.innerHTML = `
    <div class="sheet-card">
      <div class="grab"></div>
      <div class="sheet-head"><div class="sheet-title">${esc(t('s_title'))}</div>
        <button class="icon-btn" id="st-close">${svgIcon('x')}</button></div>

      <div class="me-card">
        <img src="${myAvatar()}" alt="" id="st-me-photo">
        <div>
          <div class="mn">${esc(pr.name)}, ${pr.age} <span class="vbadge">${svgIcon('check')}</span></div>
          <div class="ml">${esc(langList(pr.langs))}${myPhotos().length > 1 ? ` · ${myPhotos().length} ${esc(t('ph_title')).toLowerCase()}` : ''}</div>
        </div>
      </div>

      <button class="srow-btn" id="st-profile">${esc(t('s_profile'))}<span class="sv">→</span></button>

      <div class="srow-btn">${esc(t('s_lang'))}
        <select class="input" id="st-lang" style="max-width:160px;margin-left:auto;padding:9px 12px">
          ${['en', 'de', 'ru', 'uk'].map((l) => `<option value="${l}" ${pr.locale === l ? 'selected' : ''}>${LANG_NAMES[l]}</option>`).join('')}
        </select>
      </div>

      <div class="srow-btn" style="flex-wrap:wrap">${esc(t('s_radius'))}
        <div class="range-wrap" style="flex-basis:100%">
          <input type="range" id="st-radius" min="1" max="10" step="0.5" value="${pr.radiusKm}">
          <span class="range-val" id="st-radius-val">${pr.radiusKm} km</span>
        </div>
      </div>

      ${isStandalone()
        ? `<div class="srow-btn">${esc(t('s_installed'))}</div>`
        : `<button class="srow-btn" id="st-install">${esc(t('s_install'))}
             <span class="sv" style="max-width:170px;text-align:right;font-size:11px">${esc(isIOS ? t('s_ios_hint') : t('s_install_hint'))}</span></button>`}

      <button class="srow-btn" id="st-reset" style="color:var(--accent)">${esc(t('s_reset'))}</button>

      <div class="about-box">${esc(t('s_about'))}</div>
    </div>`;
  s.classList.remove('hidden');

  $('#st-close').onclick = () => s.classList.add('hidden');
  s.onclick = (e) => { if (e.target === s) s.classList.add('hidden'); };
  $('#st-me-photo').onclick = () => openGallery(myPhotos().length ? myPhotos() : [myAvatar()], 0);
  $('#st-profile').onclick = () => { s.classList.add('hidden'); openProfileEditor(); };
  $('#st-lang').onchange = (e) => {
    APP_STATE.profile.locale = e.target.value; save();
    renderStatic(); renderCurrentView(); openSettings();
  };
  const rr = $('#st-radius');
  rr.oninput = () => { $('#st-radius-val').textContent = rr.value + ' km'; };
  rr.onchange = () => { APP_STATE.profile.radiusKm = +rr.value; save(); renderCurrentView(); };
  const inst = $('#st-install');
  if (inst) inst.onclick = async () => {
    if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; openSettings(); }
    else toast(isIOS ? t('s_ios_hint') : t('s_install_hint'));
  };
  $('#st-reset').onclick = () => {
    if (confirm(t('s_reset_confirm'))) {
      localStorage.removeItem(LS_KEY);
      location.reload();
    }
  };
}

/* ---------------- onboarding / profile editor ---------------- */
function renderLangChips(container, selected) {
  container.innerHTML = Object.entries(LANG_NAMES).map(([code, name]) =>
    `<button type="button" class="chip ${selected.includes(code) ? 'on' : ''}" data-code="${code}">${name}</button>`).join('');
  $$('.chip', container).forEach((c) => {
    c.onclick = () => c.classList.toggle('on');
  });
}

async function downscalePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    const max = 640;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

function openProfileEditor(isFirstRun = false) {
  const pr = APP_STATE.profile;
  $('#ob-welcome').classList.add('hidden');
  $('#ob-form').classList.remove('hidden');
  $('#onboarding').classList.remove('hidden');
  $('#main').classList.add('hidden');

  $('#f-name').value = pr.name || '';
  $('#f-age').value = pr.age || '';
  $$('#f-gender .chip').forEach((c) => c.classList.toggle('on', c.dataset.v === pr.gender));
  $$('#f-looking .chip').forEach((c) => c.classList.toggle('on', c.dataset.v === pr.lookingFor));
  renderLangChips($('#f-langs'), pr.langs);
  $('#f-submit').innerHTML = isFirstRun ? `${svgIcon('check')} ${esc(t('ob_verify'))}` : esc(t('s_save'));
  $('#f-err').textContent = '';

  let photos = [...(pr.photos || [])];
  const MAXP = 5;
  const drawPhotos = () => {
    const gal = $('#f-pgal');
    gal.innerHTML =
      photos.map((src, k) => `
        <div class="pslot" data-k="${k}">
          <img src="${src}" alt="">
          ${k === 0 ? `<span class="pmain">${esc(t('ph_main'))}</span>` : ''}
          <button type="button" class="prem" data-rem="${k}" aria-label="remove">${svgIcon('x')}</button>
        </div>`).join('') +
      (photos.length < MAXP ? `<button type="button" class="padd" id="p-add"><span class="plus">+</span>${esc(t('ob_photo_add'))}</button>` : '');
    $('#f-pcount').textContent = `${t('ph_max')} · ${photos.length}/${MAXP}`;
    const add = $('#p-add'); if (add) add.onclick = () => $('#f-photo-file').click();
    $$('.pslot img', gal).forEach((im) => { im.onclick = () => openGallery(photos, +im.closest('.pslot').dataset.k); });
    $$('.prem', gal).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); photos.splice(+b.dataset.rem, 1); drawPhotos(); }; });
  };
  drawPhotos();

  $$('#f-gender .chip').forEach((c) => {
    c.onclick = () => { $$('#f-gender .chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); };
  });
  $$('#f-looking .chip').forEach((c) => {
    c.onclick = () => { $$('#f-looking .chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); };
  });
  $('#f-photo-file').onchange = async (e) => {
    for (const f of [...e.target.files]) {
      if (photos.length >= MAXP) break;
      photos.push(await downscalePhoto(f));
    }
    e.target.value = '';
    drawPhotos();
  };

  $('#f-submit').onclick = async () => {
    const name = $('#f-name').value.trim();
    const age = +$('#f-age').value;
    const langs = $$('#f-langs .chip.on').map((c) => c.dataset.code);
    const err = $('#f-err');
    if (!name) { err.textContent = t('err_name'); return; }
    if (!age || age < 18 || age > 99) { err.textContent = t('err_age'); return; }
    if (!langs.length) { err.textContent = t('err_lang'); return; }
    if (!photos.length) { err.textContent = t('err_photo'); return; }

    Object.assign(pr, {
      name, age, langs, photos,
      gender: $('#f-gender .chip.on')?.dataset.v || 'm',
      lookingFor: $('#f-looking .chip.on')?.dataset.v || 'all',
    });

    if (isFirstRun) {
      await playVerification(photos[0] || avatarDataURI(name, 330, 275));
      pr.verified = true;
      APP_STATE.onboarded = true;
      seedInitialLikes();
    }
    save();
    enterMain();
  };
}

function playVerification(img) {
  return new Promise((res) => {
    const v = $('#verify');
    v.innerHTML = `
      <div>
        <div class="vph"><img src="${img}" alt=""><div class="scan"></div></div>
        <div class="vtxt">${esc(t('ob_checking'))}</div>
        <div class="section-sub" style="margin:6px auto 0">${esc(t('ob_geo'))}</div>
      </div>`;
    v.classList.remove('hidden');
    setTimeout(() => {
      v.innerHTML = `<div><div class="vok">${svgIcon('check')}</div><div class="vtxt">${esc(t('ob_verified'))}</div></div>`;
      setTimeout(() => { v.classList.add('hidden'); res(); }, 1100);
    }, 2300);
  });
}

function seedInitialLikes() {
  const candidates = DEMO_PEOPLE.filter((p) => matchesPref(p));
  const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, 3);
  shuffled.forEach((p) => { const d = dyn(p.id); d.likedMe = true; d.online = true; });
  APP_STATE.unseen.likes = shuffled.length;
}

/* ---------------- simulation loops ---------------- */
function startSimulation() {
  // presence: someone goes online/offline
  setInterval(() => {
    const p = pickOf(DEMO_PEOPLE);
    const d = dyn(p.id);
    if (d.dateId || (wiz && wiz.alive && wiz.pid === p.id)) return;
    d.online = !d.online;
    save();
    if (!document.hidden) { renderHeader(); if (currentTab !== 'dates') renderCurrentView(); }
  }, 26000);

  // incoming likes over time
  const nextLike = () => {
    setTimeout(() => {
      const pool = DEMO_PEOPLE.filter((p) => {
        const d = dyn(p.id);
        return matchesPref(p) && !d.likedMe && !d.declined && !d.iLiked;
      });
      if (pool.length && Math.random() < 0.65) {
        const p = pickOf(pool);
        const d = dyn(p.id);
        d.likedMe = true; d.online = true;
        APP_STATE.unseen.likes++;
        save();
        toast(t('l_toast', { name: p.name }), avatar(p));
        renderBadges();
        if (currentTab === 'likes') renderLikes();
        renderHeader();
      }
      nextLike();
    }, rnd(35000, 80000));
  };
  nextLike();
}

/* ---------------- boot ---------------- */
function enterMain() {
  $('#onboarding').classList.add('hidden');
  $('#main').classList.remove('hidden');
  renderStatic();
  const urlTab = new URLSearchParams(location.search).get('tab');
  switchTab(['discover', 'likes', 'meet', 'dates'].includes(urlTab) ? urlTab : 'discover');
}

function boot() {
  renderStatic();

  $$('.tab').forEach((b) => { b.onclick = () => switchTab(b.dataset.tab); });
  $('#btn-settings').onclick = openSettings;
  $('#ob-start').onclick = () => openProfileEditor(true);

  if (APP_STATE.onboarded) {
    enterMain();
  } else {
    $('#onboarding').classList.remove('hidden');
    $('#main').classList.add('hidden');
    $('#ob-welcome').classList.remove('hidden');
    $('#ob-form').classList.add('hidden');
  }

  startSimulation();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

document.addEventListener('DOMContentLoaded', boot);
