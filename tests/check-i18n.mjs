/* i18n parity: every locale must define exactly the same keys as `en`.
   Catches the easy-to-forget "added a string to one locale only" bug. */
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../js/i18n.js', import.meta.url), 'utf8');
// i18n.js is a browser script (const I18N = {...}); evaluate it in isolation.
const I18N = new Function(`${src}\n;return I18N;`)();

const locales = Object.keys(I18N);
const ref = Object.keys(I18N.en);
const refSet = new Set(ref);
let bad = false;

for (const loc of locales) {
  const keys = new Set(Object.keys(I18N[loc]));
  const missing = ref.filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !refSet.has(k));
  if (missing.length || extra.length) {
    bad = true;
    console.error(`✗ [${loc}] missing: [${missing.join(', ')}]  extra: [${extra.join(', ')}]`);
  }
}

if (bad) { console.error('i18n parity FAILED'); process.exit(1); }
console.log(`✓ i18n parity OK — ${locales.length} locales, ${ref.length} keys each (${locales.join(', ')})`);
