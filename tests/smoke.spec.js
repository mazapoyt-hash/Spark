// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('node:path');

const FIX = path.join(__dirname, 'fixtures');
const TP1 = path.join(FIX, 'tp1.png');
const TP2 = path.join(FIX, 'tp2.png');

/** @type {string[]} */
let pageErrors = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  // force the offline/demo path so tests are deterministic (no live backend)
  await page.route(/supabase-js/, (r) => r.abort());
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource|net::/.test(m.text())) pageErrors.push('console: ' + m.text());
  });
});

test.afterEach(() => {
  expect(pageErrors, 'no uncaught page/console errors').toEqual([]);
});

async function onboard(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#ob-start');
  await page.fill('#f-name', 'Alex');
  await page.fill('#f-age', '27');
  await page.click('#f-looking .chip[data-v="w"]');
  await page.click('#f-langs .chip[data-code="ru"]');
  await page.setInputFiles('#f-photo-file', [TP1]);
  await page.click('#f-submit');
  await page.waitForSelector('.ve-card');
  await page.setInputFiles('#ve-file', [TP2]);
  await page.click('#ve-submit');
  await page.waitForFunction(() => !document.querySelector('#main').classList.contains('hidden'));
}

test('onboarding → verification → discover', async ({ page }) => {
  await onboard(page);
  await expect(page.locator('#deck .ccard, #deck .empty')).toBeVisible();
});

test('like-back → match appears in Meet with a rounded distance', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => {
    const p = DEMO_PEOPLE.find((x) => x.gender === 'w');
    const d = dyn(p.id); d.likedMe = true; d.iLiked = true; d.online = true; d.dateId = null;
    save(); switchTab('meet');
  });
  await expect(page.locator('.mrow')).toHaveCount(1);
  const sub = (await page.textContent('.mrow .msub')) || '';
  expect(sub, 'distance must be rounded, not a raw float').not.toMatch(/\d\.\d{3,}/);
});

test('date planner mini-game resolves a chooser', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => openWizard('p02'));
  for (let i = 0; i < 60; i++) {
    const c = await page.evaluate(() => (typeof wiz !== 'undefined' && wiz && wiz.chooser) || null);
    if (c) break;
    const rps = page.locator('.rps-btn').first();
    if (await rps.isVisible().catch(() => false) && await rps.isEnabled().catch(() => false)) { await rps.click().catch(() => {}); await page.waitForTimeout(1200); continue; }
    const roll = page.locator('#d-roll');
    if (await roll.isVisible().catch(() => false) && await roll.isEnabled().catch(() => false)) { await roll.click().catch(() => {}); await page.waitForTimeout(400); continue; }
    const spin = page.locator('#r-spin');
    if (await spin.isVisible().catch(() => false) && await spin.isEnabled().catch(() => false)) { await spin.click().catch(() => {}); await page.waitForTimeout(400); continue; }
    await page.waitForTimeout(300);
  }
  const chooser = await page.evaluate(() => (typeof wiz !== 'undefined' && wiz && wiz.chooser) || null);
  expect(['me', 'them']).toContain(chooser);
});

test('video sheet opens instantly (no hang)', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => openVideo('p02'));
  await expect(page.locator('#sheet-video .sheet-card')).toBeVisible({ timeout: 3000 });
});

test('«Мне нравятся» lists people I liked', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => {
    const p = DEMO_PEOPLE.find((x) => x.gender === 'w');
    const d = dyn(p.id); d.iLiked = true; d.likedMe = false; d.declined = false;
    save(); switchTab('likes');
  });
  // the sympathies tab opens on «Мне нравятся» (outgoing) by default
  await expect(page.locator('#symseg .symtab.on')).toHaveCount(1);
  await expect(page.locator('#lgrid .lcard')).toHaveCount(1);
});

test('message thread caps at 10 with a live counter', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => { const p = DEMO_PEOPLE.find((x) => x.gender === 'w'); openNote(p.id); });
  await expect(page.locator('#sheet-note .note-count')).toContainText('10');
  await page.fill('#nt-in', 'Привет!');
  await page.click('#nt-send');
  await expect(page.locator('#sheet-note .note-count')).toContainText('9');
});

test('date reschedule form opens with a place field', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => {
    const p = DEMO_PEOPLE.find((x) => x.gender === 'w');
    APP_STATE.dates.push({ id: 'dx', personId: p.id, place: 'Kafe', inside: true, dateISO: isoPlusDays(2), time: '19:00', createdAt: Date.now() });
    save(); switchTab('dates');
  });
  await page.click('.dcard .ded');
  await expect(page.locator('#sheet-edit #de-place')).toBeVisible();
});

test('age filter hides people outside the range', async ({ page }) => {
  await onboard(page);
  const before = await page.evaluate(() => deckList().length);
  expect(before).toBeGreaterThan(0);
  // narrow the range to an age no demo person has → deck empties
  const after = await page.evaluate(() => {
    APP_STATE.profile.ageMin = 40; APP_STATE.profile.ageMax = 45; save();
    return deckList().length;
  });
  expect(after).toBe(0);
});

test('unlike from «Мне нравятся» returns the person to discovery', async ({ page }) => {
  await onboard(page);
  const id = await page.evaluate(() => {
    const p = DEMO_PEOPLE.find((x) => x.gender === 'w' && x.km <= 10);
    const d = dyn(p.id); d.iLiked = true; d.likedMe = false; d.declined = false; d.online = true;
    save(); switchTab('likes'); return p.id;
  });
  await expect(page.locator('#lgrid .lcard')).toHaveCount(1);
  await page.click('#lgrid .lcard .no'); // X = unlike in the outgoing list
  await expect(page.locator('#lgrid .lcard')).toHaveCount(0);
  const backInDeck = await page.evaluate((pid) => deckList().some((p) => p.id === pid), id);
  expect(backInDeck).toBe(true);
});

test('admin (demo) login + verification queue + reject needs a comment', async ({ page }) => {
  await onboard(page); // submits a verification into same-origin localStorage
  await page.goto('/adminka6582/');
  await page.fill('#us', 'admin');
  await page.fill('#pw', 'spark-admin-2026');
  await page.click('#lb');
  await page.click('.nav[data-s="verif"]');
  await expect(page.locator('.vcard')).toHaveCount(1);
  // reject without a comment must be blocked (card stays pending)
  await page.click('.vcard [data-act="reject"]');
  await expect(page.locator('.vcard.pending')).toHaveCount(1);
});

test('wrong admin password is rejected', async ({ page }) => {
  await page.goto('/adminka6582/');
  await page.fill('#us', 'admin');
  await page.fill('#pw', 'nope');
  await page.click('#lb');
  await expect(page.locator('#lf')).toBeVisible();
  await expect(page.locator('.admin')).toHaveCount(0);
});
