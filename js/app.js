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
      langs: [], photo: null, verified: false,
      locale: detectLocale(), radiusKm: 10,
    },
    // dynamic per-person flags
    people: Object.fromEntries(DEMO_PEOPLE.map((p) => [p.id, {
      online: Math.random() > 0.25, likedMe: false, iLiked: false, declined: false, dateId: null,
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
    s.people = { ...d.people, ...(s.people || {}) };
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dyn = (id) => APP_STATE.people[id];
const base = (id) => DEMO_BY_ID[id];
const avatar = (p) => avatarDataURI(p.name, p.hues[0], p.hues[1]);
const myAvatar = () => APP_STATE.profile.photo || avatarDataURI(APP_STATE.profile.name || 'You', 330, 275);

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
    s.textContent = '♥';
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
  { x: 22, y: 9, s: 70 }, { x: 79, y: 12, s: 76 },
  { x: 9, y: 44, s: 82 }, { x: 92, y: 40, s: 66 },
  { x: 18, y: 84, s: 62 }, { x: 85, y: 79, s: 78 },
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
    <button class="fpill ${discoverFilter === 'all' ? 'on' : ''}" data-f="all">✦ ${esc(t('f_all'))}</button>
    <button class="fpill ${discoverFilter === 'near' ? 'on' : ''}" data-f="near">${esc(t('f_near'))}</button>
    <span class="fpill static"><i class="dot"></i>${onlineNearby()} ${esc(t('d_online'))}</span>`;
  $$('#fpills .fpill[data-f]').forEach((b) => {
    b.onclick = () => { discoverFilter = b.dataset.f; centralId = null; renderDiscover(); };
  });

  const deck = $('#deck');
  const list = orbitList();
  if (!list.length) {
    deck.innerHTML = `<div class="empty"><div class="eico">✦</div>
      <h3>${esc(t('d_empty_title'))}</h3><p>${esc(t('d_empty_sub', { km: APP_STATE.profile.radiusKm }))}</p></div>`;
    return;
  }
  const p = list.find((x) => x.id === centralId) || list[0];
  centralId = p.id;
  const sats = list.filter((x) => x.id !== p.id).slice(0, ORBIT_SLOTS.length);

  deck.innerHTML = `
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
            <div class="cname">${esc(p.name)}, ${p.age} <span class="vbadge">✓</span></div>
            <div class="ckm">${esc(t('d_km', { km: p.km.toFixed(1).replace('.0', '') }))} · ${esc(langList(p.langs))}</div>
          </div>
        </div>
      </article>
      ${sats.map((s, i) => {
        const sl = ORBIT_SLOTS[i];
        return `<button class="oav" data-id="${s.id}" aria-label="${esc(s.name)}"
          style="--x:${sl.x}%;--y:${sl.y}%;--s:${sl.s}px">
          <img src="${avatar(s)}" alt=""><i class="spark">✦</i>
        </button>`;
      }).join('')}
    </div>
    <div class="deck-actions">
      <button class="act skip" id="act-skip" aria-label="${esc(t('d_next'))}">✕</button>
      <button class="act like" id="act-like" aria-label="${esc(t('d_like'))}">♥</button>
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
  $$('.oav', deck).forEach((b) => {
    b.onclick = () => { centralId = b.dataset.id; renderDiscover(); };
  });

  if (!APP_STATE.introShown) {
    APP_STATE.introShown = true; save();
    setTimeout(() => toast(t('demo_toast')), 700);
  }
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

/* ---------------- likes ---------------- */
function renderLikes() {
  const grid = $('#lgrid');
  const list = likesList();
  $('#likes-free').textContent = t('l_free');
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="eico">✦</div>
      <h3>${esc(t('l_empty_title'))}</h3><p>${esc(t('l_empty_sub'))}</p></div>`;
    return;
  }
  grid.innerHTML = list.map((p) => `
    <div class="lcard" data-id="${p.id}">
      <img class="limg" src="${avatar(p)}" alt="${esc(p.name)}">
      <span class="lheart">♥</span>
      <div class="lbody">
        <div class="lname">${esc(p.name)}, ${p.age} <span class="vbadge" style="width:16px;height:16px;font-size:9px">✓</span></div>
        <div class="lsub">${esc(t('d_km', { km: p.km.toFixed(1).replace('.0', '') }))} · ${esc(langList(p.langs))}</div>
        <div class="lbtns">
          <button class="mini no" title="${esc(t('l_decline'))}">✕</button>
          <button class="mini yes" title="${esc(t('l_like_back'))}">♥</button>
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
      <div class="mm-heart">♥</div>
      <p class="mm-sub">${esc(t('m_sub', { name: p.name }))}</p>
      <div class="mm-btns">
        <button class="btn btn-primary" id="mm-go">${esc(t('m_schedule'))}</button>
        <button class="btn btn-ghost" id="mm-later">${esc(t('m_later'))}</button>
      </div>
    </div>`;
  w.classList.remove('hidden');
  heartBurst(innerWidth / 2, innerHeight / 3, 16);
  $('#mm-go').onclick = () => { w.classList.add('hidden'); openWizard(id); };
  $('#mm-later').onclick = () => { w.classList.add('hidden'); renderCurrentView(); };
}

/* ---------------- meet ---------------- */
function renderMeet() {
  const wrap = $('#mlist');
  const list = matchList();
  if (!list.length) {
    wrap.innerHTML = `<div class="empty"><div class="eico">✦</div>
      <h3>${esc(t('meet_empty_title'))}</h3><p>${esc(t('meet_empty_sub'))}</p></div>`;
    return;
  }
  wrap.innerHTML = list.map((p) => {
    const off = !dyn(p.id).online;
    return `
    <div class="mrow ${off ? 'offline' : ''}" data-id="${p.id}">
      <img class="mimg" src="${avatar(p)}" alt="">
      <div class="mtxt">
        <div class="mname">${esc(p.name)}, ${p.age} <span class="vbadge" style="width:16px;height:16px;font-size:9px">✓</span></div>
        <div class="msub">${off ? esc(t('meet_offline')) : `<i class="dot"></i> ${esc(t('d_online'))} · ${esc(t('d_km', { km: p.km }))}`}</div>
      </div>
      ${off ? '' : `<button class="go">${esc(t('meet_cta'))}</button>`}
    </div>`;
  }).join('');
  $$('.mrow .go', wrap).forEach((b) => {
    b.onclick = () => openWizard(b.closest('.mrow').dataset.id);
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
        <button class="icon-btn wz-x" id="wz-close">✕</button>
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
      <div class="wz-sugg">${suggestions.map((s) => `<button class="chip">${esc(s)}</button>`).join('')}</div>`;
    const done = (v) => { if (!v.trim()) return; zone.innerHTML = ''; res(v.trim()); };
    $('#wz-send').onclick = () => done($('#wz-in').value);
    $('#wz-in').onkeydown = (e) => { if (e.key === 'Enter') done($('#wz-in').value); };
    $$('.chip', zone).forEach((c) => { c.onclick = () => done(c.textContent); });
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
function askYesNo() {
  return new Promise((res) => {
    const zone = wzZone();
    zone.innerHTML = `
      <div class="wz-q" style="font-size:17px">${esc(t('w_you_sure'))}</div>
      <div class="seg">
        <button class="wz-opt" id="yn-no">✕ ${esc(t('w_no'))}</button>
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
async function partnerConfirm(w, name, pAccept, counterValue, applyCounter) {
  await partnerThinks(w);
  if (Math.random() < pAccept) { partnerSays(t('w_they_yes', { name }), 'ok'); await sleep(700); wzGuard(w); return; }
  partnerSays(t('w_they_no', { name }), 'nope');
  await partnerThinks(w, rnd(700, 1300));
  partnerSays(t('w_counter', { name, v: counterValue }));
  const ok = await askYesNo(); wzGuard(w);
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
  await partnerConfirm(w, name, 0.8, counterPlace, () => { w.place = counterPlace; });

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
async function theyPropose(w, name, values, applyValue, myPickFallback) {
  for (let i = 0; i < values.length; i++) {
    await partnerThinks(w);
    partnerSays(t('w_counter', { name, v: values[i] }));
    const ok = await askYesNo(); wzGuard(w);
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
  });

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
      <div class="big">♥</div>
      <h3>${esc(t('w_done_title'))}</h3>
      <p>${esc(t('w_done_sub'))}</p>
      <div class="wz-summary">
        <div class="srow"><span class="klabel">${esc(t('lbl_who'))}</span><b>${esc(p.name)}, ${p.age}</b></div>
        <div class="srow"><span class="klabel">${esc(t('lbl_where'))}</span><span><b>${esc(w.place)}</b> · ${esc(t(w.inside ? 'dt_place_in' : 'dt_place_out'))}</span></div>
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
    wrap.innerHTML = `<div class="empty"><div class="eico">✦</div>
      <h3>${esc(t('dt_empty_title'))}</h3><p>${esc(t('dt_empty_sub'))}</p></div>`;
    return;
  }

  const card = (d, isPast) => {
    const p = base(d.personId);
    return `
      <div class="dcard ${isPast ? 'past' : ''}" data-id="${d.id}">
        <img class="dimg" src="${avatar(p)}" alt="">
        <div class="dtxt">
          <div class="dname">${esc(p.name)}, ${p.age} <span class="vbadge" style="width:17px;height:17px;font-size:10px">✓</span></div>
          <div class="dline"><span class="klabel">${esc(t('lbl_where'))}</span><span><b>${esc(d.place)}</b> · ${esc(t(d.inside ? 'dt_place_in' : 'dt_place_out'))}</span></div>
          <div class="dline"><span class="klabel">${esc(t('lbl_day'))}</span><span>${esc(fmtDate(d.dateISO))} · <b>${esc(d.time)}</b></span></div>
          ${!isPast && dateWhenLabel(d) ? `<span class="dwhen">${esc(dateWhenLabel(d))}</span>` : ''}
        </div>
        ${isPast ? '' : `<button class="dx" title="${esc(t('dt_cancel'))}">✕</button>`}
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
        <button class="icon-btn" id="st-close">✕</button></div>

      <div class="me-card">
        <img src="${myAvatar()}" alt="">
        <div>
          <div class="mn">${esc(pr.name)}, ${pr.age} <span class="vbadge">✓</span></div>
          <div class="ml">${esc(langList(pr.langs))}</div>
        </div>
      </div>

      <button class="srow-btn" id="st-profile">${esc(t('s_profile'))}<span class="sv">→</span></button>

      <div class="srow-btn">${esc(t('s_lang'))}
        <select class="input" id="st-lang" style="max-width:150px;margin-left:auto;padding:9px 12px">
          ${['en', 'de', 'ru'].map((l) => `<option value="${l}" ${pr.locale === l ? 'selected' : ''}>${LANG_NAMES[l]}</option>`).join('')}
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
  $('#f-photo-img').src = pr.photo || avatarDataURI(pr.name || '?', 330, 275);
  $('#f-photo-btn').textContent = t(pr.photo ? 'ob_photo_change' : 'ob_photo_add');
  $('#f-submit').innerHTML = isFirstRun ? `✓ ${esc(t('ob_verify'))}` : esc(t('s_save'));
  $('#f-err').textContent = '';

  let photo = pr.photo;

  $$('#f-gender .chip').forEach((c) => {
    c.onclick = () => { $$('#f-gender .chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); };
  });
  $$('#f-looking .chip').forEach((c) => {
    c.onclick = () => { $$('#f-looking .chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); };
  });
  $('#f-photo-btn').onclick = () => $('#f-photo-file').click();
  $('#f-photo-file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    photo = await downscalePhoto(f);
    $('#f-photo-img').src = photo;
    $('#f-photo-btn').textContent = t('ob_photo_change');
  };

  $('#f-submit').onclick = async () => {
    const name = $('#f-name').value.trim();
    const age = +$('#f-age').value;
    const langs = $$('#f-langs .chip.on').map((c) => c.dataset.code);
    const err = $('#f-err');
    if (!name) { err.textContent = t('err_name'); return; }
    if (!age || age < 18 || age > 99) { err.textContent = t('err_age'); return; }
    if (!langs.length) { err.textContent = t('err_lang'); return; }

    Object.assign(pr, {
      name, age, langs, photo,
      gender: $('#f-gender .chip.on')?.dataset.v || 'm',
      lookingFor: $('#f-looking .chip.on')?.dataset.v || 'all',
    });

    if (isFirstRun) {
      await playVerification(photo || avatarDataURI(name, 330, 275));
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
      v.innerHTML = `<div><div class="vok">✓</div><div class="vtxt">${esc(t('ob_verified'))}</div></div>`;
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
