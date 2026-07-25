'use strict';
/* ============================================================
   DATE ME — admin panel (Phase 1, client-side).
   Operates on the same-origin localStorage the app uses:
     dateme.v1            — app state (profile, people, dates, unseen)
     dateme.verifications — moderation queue (selfies stored ENCRYPTED)

   Security model (honest for a static site):
   • Admin accounts are hardcoded below by username + SHA-256 password
     hash — not just anyone can log in, and the plaintext password is not
     in the code.
   • Verification selfies are hybrid-encrypted (RSA-OAEP + AES-GCM) to the
     admin key. The private key ships ONLY wrapped by the admin password,
     so photos are decryptable NOWHERE except here, after a correct login.
     The key lives only in memory for the session (no sessionStorage), so
     a page reload requires logging in again.
   Real server-side roles + a private store come in Phase 2 (Supabase).
   ============================================================ */

/* Hardcoded admin accounts: username + SHA-256(password) hex. To add/rotate
   an admin, regenerate the hash (and, if the password changes, re-wrap the
   private key below). */
const ADMIN_ACCOUNTS = [
  { user: 'admin', hash: 'fc403bfc489b147487576f0a0a6ef1c4cf540ad69476fd210d702e8de39a2ceb' },
];
/* Admin RSA private key, wrapped with a key derived (PBKDF2) from the admin
   password. Useless without the password. */
const WRAPPED_B64 = 'TP17eRwXLenUN3VjZ3E3GI/P95FZyHAe0SJT0hsh0h0IL1R9ZSEH/BhMq6XjJecl2Y6RkFdu8NKJM0S0INLPXztenHdYh2TAq8CCrTKEVdj8pNlRBlrTAz1bBlGWnRn/pFJCfYX7o6km1yqJF+T/1wHVC+9Xmquh9ArgUd5I3nikrOPoEAQ78PPAruVSIexxkUQFu5KT7OqU35M1OirTg2OGY0viooAU7o8/jDZyaELNDW9D1aAr8uzugfALob/Bl0fWoncU6FU9/sJVAw3d4jAqnKYvB4mi1WPKHUIISwzglyyGFfRQDx8mRqW1+Ogqz4tZDCTr6BFxm55bjKzOmvDtMrpEmGgby+VLV6fgjmbmf7vINbujTRgaJ8E3pVPgtWC3spTIHLAULAUyYmZQlQWJwWbjas6FY+29sBjcBNUF5PVXgEADzGnzIzr1pJkyBRdi/tUx8dmzfJdWRmzFMdbfRDANiPNfDA5xyVKygJbdMKIr2QL8emH7z+pIbh2kWkc4epQifFBYFg9zWwyS8NxkyrhHkG38GApS9FtZGLZz6b00HLQRkZO08B7WFd7t3eeLE8Rn07Z7asOxdM08Q5qL9cxdI2DwdUkf7052mHQKyRD9v9q+VxrMvGcMTgEVf0TLrEYJRUGOt4pi4/zWWCzgvemFWC/N9AQ1zhYi3+uhXL5zjOcwH9wwqdPF4ofaaT8eDrTM5vOcRVMiC8WLmbiMbxKiCst+LGwr+C2QRGqtsW5Gt9iqPvmKL2WoGNgYP9rnZSiohcTo+Voc+Up7GZRCkWzXWFyNikbzRh97Y9w+XChx8Xjxa3F7IP48kmsEDam7GrAoNk99Pngz3jWeNBDCtVhozrf1dqLkm5y0mZ19idJtp6tIFBnZIlloDRVjeGjPu6+WAtv2/jkD+h2y1F7vJcq2dOF/ckEun0VT8C67pIwp85qsf1LX8XIaoEOTODZ33dRkTueqoK1U7AIFX06CKYSoBBhkmHVehZy1XTkcTKPGFweVvmNVs7QWa/ydyvKeIxg404v9flTgSIRxZ0NfWqMuNyZsjTJchWqMLpsUCC6MDGuukPg0AxU2ZcYyqLveGuJ4US3j3sC+jho75QsNCEKGIYk8MYmZNnd/vvxzUYqO0WgvBNMjFdnaORaBFySXIQumLdj0ogwnZlu5o8vxn2fgSZFN0a51zzg/FUTNzmTUaemDc9f8NskMmbSHAl/F5MpJ56w5/XqZxdkJyTV//exnRohBFPj0bnlMEyfswehexwdyLclED4n69yLUJfQ6DJFs6KqIM5mbMyrSjQMqjeqw7/jQSblDULdszozEdOnRb4jCmvusT0Azw/JLaFB0gLffFGNXH5ahthXt5un1hNSlTVMhImASIfkgP66jHY2jWziMhOXGNFAwGwcFpNevhQgV8oeJMqxExbD9T4lWzs1OxREJUG9PvAh4gmOXAKwLxMkL75YJMvU2NHF11AJ4fMA7G/WEpqX1ncsHCG3a4fLSAhlPZ72odqRNl/dcnnVogTRnk3+PkLmJjbW1wsKeCYY9of/IDRr8Ly/xdCzO4Lvei6iUMAjnHXFCo+Vhp4AYzTiZduB0o5zJHv11R6ZTJw2fEKcWeLnntP1OqmnZfPIj/fdJhsC9Ta37fx7F';
const SALT_B64 = 'f1cDLSbJXj5mkrOg1cDfQQ==';
const IV_B64 = '6i+y1mSzimkDJjnI';

const LS_KEY = 'dateme.v1';
const VKEY = 'dateme.verifications';
let ADMIN_PRIV = null;        // unwrapped RSA private key, in-memory only
const selfieCache = new Map(); // verifId → decrypted data-URL (this session)

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const loadState = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; } };
const saveState = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* quota */ } };
const loadVerifs = () => { try { return JSON.parse(localStorage.getItem(VKEY)) || []; } catch { return []; } };
const saveVerifs = (l) => { try { localStorage.setItem(VKEY, JSON.stringify(l)); } catch { /* quota */ } };
const fmtTime = (ts) => (ts ? new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const langList = (codes) => (codes || []).map((c) => (typeof LANG_NAMES !== 'undefined' && LANG_NAMES[c]) || c).join(' · ');
const gname = (id) => ({ palm: 'Открытая ладонь', peace: 'Знак мира', three: 'Три пальца', thumb: 'Палец вверх' }[id] || id);
const stName = (st) => ({ pending: 'На проверке', approved: 'Подтверждён', rejected: 'Отклонён' }[st] || 'нет');

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function zoom(src) {
  const m = $('#modal');
  m.innerHTML = `<button class="x">✕</button><img src="${src}" alt="">`;
  m.classList.remove('hidden');
  m.onclick = () => m.classList.add('hidden');
}

/* ---------------- auth gate ----------------
   Login = correct username + password. The password both (a) matches a
   hardcoded account hash and (b) unwraps the RSA private key. Only when the
   key unwraps successfully is access granted — so a wrong password can never
   reveal selfies even if the hash check were bypassed. */
const isAuthed = () => !!ADMIN_PRIV;

function renderLogin() {
  $('#app').innerHTML = `
    <div class="login">
      <form class="login-card" id="lf">
        <div class="brand">DATE&nbsp;ME <span>ADMIN</span></div>
        <p class="muted">Вход только для администраторов</p>
        <input id="us" type="text" placeholder="Логин" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus>
        <input id="pw" type="password" placeholder="Пароль" autocomplete="off">
        <div class="err" id="le"></div>
        <button class="btn primary block" id="lb" type="submit">Войти</button>
        <p class="note">Аккаунты администраторов заданы жёстко. Заявки на верификацию (селфи) зашифрованы и расшифровываются только здесь, после входа. Полноценные роли и общая база — в Фазе 2 (Supabase).</p>
      </form>
    </div>`;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const user = $('#us').value.trim();
    const pass = $('#pw').value;
    const btn = $('#lb'); const err = $('#le');
    err.textContent = '';
    const acc = ADMIN_ACCOUNTS.find((a) => a.user === user);
    btn.disabled = true; btn.textContent = 'Проверка…';
    try {
      const ok = acc && (await sha256hex(pass)) === acc.hash;
      // Unwrapping the private key is the real gate: it only succeeds with the
      // correct password, independent of the hash check above.
      ADMIN_PRIV = ok ? await deriveAdminKey(pass, WRAPPED_B64, SALT_B64, IV_B64) : null;
      if (!ADMIN_PRIV) throw new Error('bad');
      renderApp();
    } catch {
      ADMIN_PRIV = null;
      err.textContent = 'Неверный логин или пароль';
      btn.disabled = false; btn.textContent = 'Войти';
    }
  };
}

/* ---------------- shell ---------------- */
let section = 'dash';
const SECTIONS = [['dash', 'Дашборд'], ['verif', 'Верификации'], ['users', 'Пользователи'], ['dates', 'Свидания'], ['ctrl', 'Управление']];

function renderApp() {
  $('#app').innerHTML = `
    <div class="admin">
      <aside class="side">
        <div class="brand">DATE&nbsp;ME <span>ADMIN</span></div>
        ${SECTIONS.map(([k, l]) => `<button class="nav ${section === k ? 'on' : ''}" data-s="${k}">${l}${k === 'verif' ? pendingBadge() : ''}</button>`).join('')}
        <button class="nav logout" id="logout">Выйти</button>
      </aside>
      <main class="content" id="content"></main>
    </div>`;
  $$('.nav[data-s]').forEach((b) => { b.onclick = () => { section = b.dataset.s; renderApp(); }; });
  $('#logout').onclick = () => { ADMIN_PRIV = null; selfieCache.clear(); renderLogin(); };
  renderSection();
}
function pendingBadge() {
  const n = loadVerifs().filter((r) => r.status === 'pending').length;
  return n ? ` <span class="tag pending" style="margin-left:6px">${n}</span>` : '';
}
function renderSection() {
  ({ dash: renderDash, verif: renderVerif, users: renderUsers, dates: renderDates, ctrl: renderCtrl }[section] || renderDash)();
}

/* ---------------- dashboard ---------------- */
function renderDash() {
  const st = loadState();
  const vs = loadVerifs();
  const people = (st && st.people) || {};
  const demo = typeof DEMO_PEOPLE !== 'undefined' ? DEMO_PEOPLE : [];
  const online = demo.filter((p) => people[p.id] && people[p.id].online).length;
  const likedMe = demo.filter((p) => people[p.id] && people[p.id].likedMe).length;
  const matches = demo.filter((p) => people[p.id] && people[p.id].likedMe && people[p.id].iLiked).length;
  const dates = (st && st.dates) || [];
  const cnt = (s) => vs.filter((r) => r.status === s).length;
  const stat = (n, l, hot) => `<div class="stat ${hot ? 'hot' : ''}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  $('#content').innerHTML = `
    <div class="h1">Дашборд</div>
    <div class="sub">Обзор состояния приложения (демо-данные этого браузера).</div>
    <div class="stats">
      ${stat(vs.filter((r) => r.status === 'pending').length, 'Заявок на проверке', true)}
      ${stat(cnt('approved'), 'Подтверждено')}
      ${stat(cnt('rejected'), 'Отклонено')}
      ${stat(demo.length + (st && st.profile && st.profile.name ? 1 : 0), 'Пользователей')}
      ${stat(online, 'Онлайн сейчас')}
      ${stat(likedMe, 'Лайкнули тебя')}
      ${stat(matches, 'Взаимных')}
      ${stat(dates.length, 'Свиданий')}
    </div>
    ${st ? '' : '<div class="warn">Основное приложение ещё не запускалось в этом браузере — часть данных пуста. Откройте сайт и создайте профиль, чтобы увидеть полную картину.</div>'}
    <div class="panel">
      <h2>Последние заявки на верификацию</h2>
      ${vs.length ? `<table><thead><tr><th>Заявитель</th><th>Жест</th><th>Статус</th><th>Создано</th></tr></thead><tbody>
        ${vs.slice().reverse().slice(0, 6).map((r) => `<tr>
          <td>${esc(r.name)}, ${r.age}</td><td>${gname(r.gestureId)}</td>
          <td><span class="tag ${r.status}">${stName(r.status)}</span></td><td class="muted">${fmtTime(r.createdAt)}</td>
        </tr>`).join('')}
      </tbody></table>` : '<div class="empty">Пока нет заявок</div>'}
    </div>`;
}

/* ---------------- verifications (with comment to client) ---------------- */
function decide(id, act) {
  const list = loadVerifs();
  const r = list.find((x) => x.id === id);
  if (!r) return;
  const comment = ($('#cm-' + id) ? $('#cm-' + id).value : '').trim();
  if (act === 'reject' && !comment) { toast('Напишите, что не так с фото'); $('#cm-' + id) && $('#cm-' + id).focus(); return; }
  r.status = act === 'approve' ? 'approved' : 'rejected';
  r.comment = comment;
  r.reviewedAt = Date.now();
  r.reviewer = 'admin';
  saveVerifs(list);
  // reflect the decision (and comment) on the applicant's profile so the app shows it
  const st = loadState();
  if (st && st.profile && st.profile.id === r.userId) {
    st.profile.verifyStatus = r.status;
    st.profile.verified = r.status === 'approved';
    st.profile.verifyComment = r.comment || '';
    saveState(st);
  }
  toast(act === 'approve' ? 'Заявка одобрена' : 'Заявка отклонена');
  renderApp();
}

function renderVerif() {
  const st = loadState();
  const myPhotos = (st && st.profile && st.profile.photos) || [];
  const list = loadVerifs().slice().sort((a, b) => {
    if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  $('#content').innerHTML = `
    <div class="h1">Верификации</div>
    <div class="sub">Сравните пример-жест с селфи${myPhotos.length ? ' и фото профиля' : ''}. При отклонении напишите причину — пользователь увидит её в приложении.</div>
    ${list.length ? `<div class="vgrid">${list.map((r) => {
      const isAppUser = st && st.profile && st.profile.id === r.userId;
      const extra = isAppUser ? myPhotos : [];
      return `
      <div class="vcard ${r.status}">
        <div class="vhead"><b>${esc(r.name)}, ${r.age}</b><span class="tag ${r.status}">${stName(r.status)}</span></div>
        <div class="vshots">
          <figure><img src="${gestureSVG(r.gestureId)}" data-zoom="${gestureSVG(r.gestureId)}" alt=""><figcaption>Пример: ${gname(r.gestureId)}</figcaption></figure>
          <figure><img id="selfie-${r.id}" alt="" data-selfie="${r.id}"><figcaption>Селфи</figcaption></figure>
        </div>
        ${extra.length ? `<div class="vmore">${extra.map((p) => `<img class="vthumb" src="${esc(p)}" data-zoom="${esc(p)}" alt="">`).join('')}</div>` : ''}
        <div class="vinstr">Требуемый жест: ${esc(gname(r.gestureId))}</div>
        <div class="muted" style="font-size:11.5px;margin-bottom:8px">Создано: ${fmtTime(r.createdAt)}${r.reviewedAt ? ` · Решение: ${fmtTime(r.reviewedAt)}` : ''}</div>
        ${r.status === 'pending' ? `
          <textarea class="vcomment" id="cm-${r.id}" placeholder="Комментарий (обязателен при отклонении): что не так с фото…"></textarea>
          <div class="vacts">
            <button class="btn danger" data-act="reject" data-id="${r.id}">✕ Отклонить</button>
            <button class="btn ok" data-act="approve" data-id="${r.id}">✓ Одобрить</button>
          </div>`
        : `<div class="vresolved ${r.status}">${r.status === 'approved' ? 'Одобрено' : 'Отклонено'}${r.comment ? ` — «${esc(r.comment)}»` : ''}
             <div style="margin-top:10px"><button class="btn sm" data-act="reopen" data-id="${r.id}">Вернуть в очередь</button></div></div>`}
      </div>`;
    }).join('')}</div>` : '<div class="empty">Пока нет заявок на верификацию</div>'}`;
  $$('[data-zoom]').forEach((im) => { im.onclick = () => zoom(im.dataset.zoom); });
  $$('[data-act]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.act === 'reopen') return reopen(b.dataset.id);
      decide(b.dataset.id, b.dataset.act);
    };
  });
  // Decrypt each selfie in place (only possible with the unwrapped admin key).
  list.forEach((r) => paintSelfie(r));
}

/** Decrypt a request's selfie and drop it into its <img> (async, cached). */
async function paintSelfie(r) {
  const img = $('#selfie-' + r.id);
  if (!img) return;
  let url = selfieCache.get(r.id);
  if (!url) {
    try {
      if (r.enc) url = await decryptSelfie(r.enc, ADMIN_PRIV);
      else if (r.selfie) url = r.selfie; // legacy plaintext request
      else throw new Error('no data');
      selfieCache.set(r.id, url);
    } catch {
      img.replaceWith(Object.assign(document.createElement('div'), { className: 'selfie-fail', textContent: 'Не удалось расшифровать' }));
      return;
    }
  }
  img.src = url;
  img.dataset.zoom = url;
  img.style.cursor = 'zoom-in';
  img.onclick = () => zoom(url);
}
function reopen(id) {
  const list = loadVerifs();
  const r = list.find((x) => x.id === id);
  if (!r) return;
  r.status = 'pending'; r.comment = ''; r.reviewedAt = null;
  saveVerifs(list);
  const st = loadState();
  if (st && st.profile && st.profile.id === r.userId) { st.profile.verifyStatus = 'pending'; st.profile.verified = false; st.profile.verifyComment = ''; saveState(st); }
  renderApp();
}

/* ---------------- users ---------------- */
function patchPerson(id, patch) {
  const st = loadState();
  if (!st || !st.people || !st.people[id]) { toast('Нет состояния приложения'); return; }
  Object.assign(st.people[id], patch);
  saveState(st);
  toast('Изменено');
  renderApp();
}
function setUserStatus(status) {
  const st = loadState();
  if (!st || !st.profile) return;
  st.profile.verifyStatus = status;
  st.profile.verified = status === 'approved';
  saveState(st);
  toast('Статус обновлён');
  renderApp();
}
function renderUsers() {
  const st = loadState();
  const people = (st && st.people) || {};
  const demo = typeof DEMO_PEOPLE !== 'undefined' ? DEMO_PEOPLE : [];
  const av = (p) => avatarDataURI(p.name, p.hues[0], p.hues[1]);
  const meRow = st && st.profile && st.profile.name ? `
    <tr>
      <td><div class="cellname"><img class="uava" src="${(st.profile.photos && st.profile.photos[0]) || av({ name: st.profile.name || '?', hues: [270, 300] })}" alt=""><div><b>${esc(st.profile.name)}</b>, ${st.profile.age || '—'} <span class="tag">это ты</span></div></div></td>
      <td>${st.profile.gender === 'w' ? 'Ж' : 'М'}</td>
      <td>${langList(st.profile.langs)}</td>
      <td><span class="tag ${st.profile.verifyStatus}">${stName(st.profile.verifyStatus)}</span></td>
      <td class="acts">
        <button class="btn sm ok" data-me="approved">✓ Верифиц.</button>
        <button class="btn sm" data-me="pending">На проверку</button>
        <button class="btn sm danger" data-me="rejected">Отклонить</button>
      </td>
    </tr>` : '';
  const rows = demo.map((p) => {
    const d = people[p.id] || {};
    return `<tr>
      <td><div class="cellname"><img class="uava" src="${av(p)}" alt=""><div><b>${esc(p.name)}</b>, ${p.age}</div></div></td>
      <td>${p.gender === 'w' ? 'Ж' : 'М'}</td>
      <td>${langList(p.langs)} · ${p.km} км</td>
      <td><span class="tag ${d.online ? 'on' : 'off'}">${d.online ? 'онлайн' : 'офлайн'}</span>${d.likedMe ? ' <span class="tag approved">лайкнул(а)</span>' : ''}${d.dateId ? ' <span class="tag">свидание</span>' : ''}</td>
      <td class="acts">
        <button class="btn sm" data-id="${p.id}" data-toggle="online">${d.online ? 'В офлайн' : 'В онлайн'}</button>
        <button class="btn sm" data-id="${p.id}" data-toggle="likedMe">${d.likedMe ? 'Убрать лайк' : 'Пусть лайкнет'}</button>
      </td>
    </tr>`;
  }).join('');
  $('#content').innerHTML = `
    <div class="h1">Пользователи</div>
    <div class="sub">Реальный пользователь + демо-люди. Переключатели меняют состояние приложения вживую.</div>
    ${st ? '' : '<div class="warn">Состояние приложения не найдено — переключатели демо-людей недоступны, пока не запущен основной сайт.</div>'}
    <div class="panel">
      <table><thead><tr><th>Имя</th><th>Пол</th><th>Языки / дистанция</th><th>Статус</th><th>Действия</th></tr></thead>
      <tbody>${meRow}${rows}</tbody></table>
    </div>`;
  $$('[data-me]').forEach((b) => { b.onclick = () => setUserStatus(b.dataset.me); });
  $$('[data-toggle]').forEach((b) => {
    b.onclick = () => {
      const st2 = loadState(); const cur = st2 && st2.people && st2.people[b.dataset.id];
      patchPerson(b.dataset.id, { [b.dataset.toggle]: !(cur && cur[b.dataset.toggle]), online: b.dataset.toggle === 'likedMe' ? true : (cur ? !cur.online : true) });
    };
  });
}

/* ---------------- dates ---------------- */
function renderDates() {
  const st = loadState();
  const dates = (st && st.dates) || [];
  const byId = typeof DEMO_BY_ID !== 'undefined' ? DEMO_BY_ID : Object.fromEntries((typeof DEMO_PEOPLE !== 'undefined' ? DEMO_PEOPLE : []).map((p) => [p.id, p]));
  $('#content').innerHTML = `
    <div class="h1">Свидания</div>
    <div class="sub">Запланированные встречи пользователя.</div>
    <div class="panel">
      ${dates.length ? `<table><thead><tr><th>С кем</th><th>Место</th><th>Когда</th><th></th></tr></thead><tbody>
        ${dates.map((d) => { const p = byId[d.personId] || { name: '?', age: '' }; return `<tr>
          <td><b>${esc(p.name)}</b>, ${p.age}</td>
          <td>${esc(d.place)} · ${d.inside ? 'в помещении' : 'на улице'}</td>
          <td>${esc(d.dateISO)} · ${esc(d.time)}</td>
          <td class="acts"><button class="btn sm danger" data-cancel="${d.id}">Отменить</button></td>
        </tr>`; }).join('')}
      </tbody></table>` : '<div class="empty">Свиданий нет</div>'}
    </div>`;
  $$('[data-cancel]').forEach((b) => {
    b.onclick = () => {
      const st2 = loadState(); if (!st2) return;
      const d = (st2.dates || []).find((x) => x.id === b.dataset.cancel);
      st2.dates = (st2.dates || []).filter((x) => x.id !== b.dataset.cancel);
      if (d && st2.people && st2.people[d.personId] && st2.people[d.personId].dateId === d.id) st2.people[d.personId].dateId = null;
      saveState(st2); toast('Свидание отменено'); renderApp();
    };
  });
}

/* ---------------- controls ---------------- */
function renderCtrl() {
  $('#content').innerHTML = `
    <div class="h1">Управление</div>
    <div class="sub">Глобальные действия над демо-данными.</div>
    <div class="panel">
      <h2>Верификации</h2>
      <div class="rowbtns">
        <button class="btn ok" id="c-approve-all">Одобрить все на проверке</button>
        <button class="btn danger" id="c-clear-verif">Очистить очередь</button>
      </div>
    </div>
    <div class="panel">
      <h2>Симуляция</h2>
      <div class="rowbtns">
        <button class="btn" id="c-seed">Пусть 3 девушки лайкнут пользователя</button>
        <button class="btn" id="c-online">Все демо-люди онлайн</button>
      </div>
    </div>
    <div class="panel">
      <h2>Опасная зона</h2>
      <p class="note" style="margin-bottom:12px">Сбрасывает данные приложения в этом браузере. Отменить нельзя.</p>
      <div class="rowbtns">
        <button class="btn danger" id="c-reset">Сбросить состояние приложения</button>
      </div>
    </div>`;
  $('#c-approve-all').onclick = () => {
    const list = loadVerifs(); let n = 0;
    const st = loadState();
    list.forEach((r) => { if (r.status === 'pending') { r.status = 'approved'; r.reviewedAt = Date.now(); r.comment = r.comment || ''; n++; if (st && st.profile && st.profile.id === r.userId) { st.profile.verifyStatus = 'approved'; st.profile.verified = true; } } });
    saveVerifs(list); if (st) saveState(st); toast(`Одобрено: ${n}`); renderApp();
  };
  $('#c-clear-verif').onclick = () => { if (confirm('Очистить всю очередь верификаций?')) { saveVerifs([]); toast('Очередь очищена'); renderApp(); } };
  $('#c-seed').onclick = () => {
    const st = loadState(); if (!st || !st.people) { toast('Нет состояния приложения'); return; }
    const women = (typeof DEMO_PEOPLE !== 'undefined' ? DEMO_PEOPLE : []).filter((p) => p.gender === 'w');
    women.sort(() => Math.random() - 0.5).slice(0, 3).forEach((p) => { st.people[p.id] = { ...st.people[p.id], likedMe: true, online: true }; });
    st.unseen = { ...(st.unseen || {}), likes: ((st.unseen && st.unseen.likes) || 0) + 3 };
    saveState(st); toast('3 лайка добавлено'); renderApp();
  };
  $('#c-online').onclick = () => {
    const st = loadState(); if (!st || !st.people) { toast('Нет состояния приложения'); return; }
    Object.keys(st.people).forEach((id) => { st.people[id].online = true; });
    saveState(st); toast('Все онлайн'); renderApp();
  };
  $('#c-reset').onclick = () => { if (confirm('Сбросить состояние приложения (dateme.v1)?')) { localStorage.removeItem(LS_KEY); toast('Состояние сброшено'); renderApp(); } };
}

/* ---------------- boot ---------------- */
// keep the panel fresh if the app (another tab) changes data
addEventListener('storage', (e) => { if ((e.key === VKEY || e.key === LS_KEY) && isAuthed()) renderApp(); });
// The unwrap key lives only in memory, so every load starts at the login gate.
renderLogin();
