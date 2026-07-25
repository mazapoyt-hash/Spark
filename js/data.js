/* DATE ME — demo dataset + generated avatars */
'use strict';

/**
 * Neon avatar (SVG data-URI): deep-space base tinted by hue, a soft violet
 * glow, a colored blob and a bright centered initial. Composed centered so
 * it reads well when cropped to a circle or oval. Deterministic per person
 * via hue pair.
 */
function avatarDataURI(name, h1, h2) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300">
<defs>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${h1},52%,21%)"/>
<stop offset="1" stop-color="#08070e"/>
</linearGradient>
<radialGradient id="g" cx="0.5" cy="0.4" r="0.65">
<stop offset="0" stop-color="hsla(${h1},88%,64%,0.5)"/>
<stop offset="0.6" stop-color="hsla(${h2},82%,52%,0.12)"/>
<stop offset="1" stop-color="hsla(0,0%,0%,0)"/>
</radialGradient>
</defs>
<rect width="240" height="300" fill="url(#b)"/>
<circle cx="188" cy="252" r="76" fill="hsla(${h2},72%,56%,0.3)"/>
<circle cx="120" cy="140" r="150" fill="url(#g)"/>
<circle cx="46" cy="60" r="2.6" fill="rgba(255,255,255,0.85)"/>
<circle cx="205" cy="96" r="2" fill="hsla(268,90%,80%,0.9)"/>
<circle cx="60" cy="232" r="1.8" fill="rgba(255,255,255,0.6)"/>
<text x="120" y="196" font-family="ui-rounded,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" font-size="150" font-weight="800" fill="rgba(255,255,255,0.95)" text-anchor="middle">${initial}</text>
<path d="M196 38 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 z" fill="#c084fc"/>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/**
 * Demo people nearby. gender: 'w' | 'm'. km ≤ 10 (spec: search radius).
 * No bios by design — "no texts about yourself, that's what dating is for".
 */
const DEMO_PEOPLE = [
  { id: 'p01', name: 'Anna',    age: 24, gender: 'w', langs: ['de', 'en'],       km: 1.2, hues: [335, 275] },
  { id: 'p02', name: 'Lena',    age: 27, gender: 'w', langs: ['de', 'ru'],       km: 0.6, hues: [355, 305] },
  { id: 'p03', name: 'Mia',     age: 23, gender: 'w', langs: ['de'],             km: 2.4, hues: [15, 340]  },
  { id: 'p04', name: 'Sofia',   age: 25, gender: 'w', langs: ['it', 'en', 'de'], km: 3.1, hues: [290, 230] },
  { id: 'p05', name: 'Emma',    age: 29, gender: 'w', langs: ['en', 'fr'],       km: 4.8, hues: [200, 260] },
  { id: 'p06', name: 'Alina',   age: 22, gender: 'w', langs: ['ru', 'de'],       km: 1.9, hues: [320, 20]  },
  { id: 'p07', name: 'Marie',   age: 28, gender: 'w', langs: ['fr', 'de'],       km: 5.6, hues: [260, 210] },
  { id: 'p08', name: 'Polina',  age: 23, gender: 'w', langs: ['ru', 'en'],       km: 6.3, hues: [345, 250] },
  { id: 'p09', name: 'Yasmin',  age: 26, gender: 'w', langs: ['tr', 'de', 'en'], km: 7.4, hues: [30, 330]  },
  { id: 'p10', name: 'Nika',    age: 24, gender: 'w', langs: ['uk', 'ru', 'de'], km: 8.8, hues: [280, 320] },
  { id: 'p11', name: 'Max',     age: 27, gender: 'm', langs: ['de', 'en'],       km: 0.9, hues: [215, 260] },
  { id: 'p12', name: 'Leon',    age: 25, gender: 'm', langs: ['de'],             km: 1.7, hues: [190, 230] },
  { id: 'p13', name: 'Daniel',  age: 29, gender: 'm', langs: ['de', 'es'],       km: 2.8, hues: [250, 300] },
  { id: 'p14', name: 'Artem',   age: 26, gender: 'm', langs: ['ru', 'de'],       km: 3.9, hues: [230, 180] },
  { id: 'p15', name: 'Felix',   age: 28, gender: 'm', langs: ['de', 'en', 'pl'], km: 5.2, hues: [270, 220] },
  { id: 'p16', name: 'Nikita',  age: 24, gender: 'm', langs: ['ru', 'en'],       km: 6.7, hues: [205, 290] },
  { id: 'p17', name: 'Jonas',   age: 30, gender: 'm', langs: ['de', 'en'],       km: 7.9, hues: [240, 200] },
  { id: 'p18', name: 'Paul',    age: 26, gender: 'm', langs: ['de', 'fr'],       km: 9.4, hues: [260, 340] },
];

/** counter-proposal pools for the scheduling wizard */
const PLACE_IDEAS = {
  inside: ['Starbucks', 'Café Milano', 'Pizzeria Roma', 'Sushi Bar Zen', 'Cinema CityPark', 'Bowling Center'],
  outside: ['Stadtpark', 'Botanischer Garten', 'Flussufer-Promenade', 'Weihnachtsmarkt', 'Street-Food-Markt', 'Aussichtspunkt'],
};
const TIME_IDEAS = ['12:30', '15:00', '17:30', '18:00', '19:00', '20:30'];

/** your (demo) location — used to place the map & estimate travel time */
const MY_LOCATION = { lat: 52.5170, lng: 13.3889 };

/** real coordinates for every suggested place so any of them can be
 *  previewed on a map with route estimates (demo: around Berlin). */
const PLACE_GEO = {
  'Starbucks': { lat: 52.5219, lng: 13.4132 },
  'Café Milano': { lat: 52.4995, lng: 13.4246 },
  'Pizzeria Roma': { lat: 52.5145, lng: 13.3899 },
  'Sushi Bar Zen': { lat: 52.5323, lng: 13.4145 },
  'Cinema CityPark': { lat: 52.5065, lng: 13.3320 },
  'Bowling Center': { lat: 52.4881, lng: 13.3550 },
  'Stadtpark': { lat: 52.5448, lng: 13.4260 },
  'Botanischer Garten': { lat: 52.4570, lng: 13.3050 },
  'Flussufer-Promenade': { lat: 52.5108, lng: 13.4380 },
  'Weihnachtsmarkt': { lat: 52.5126, lng: 13.3903 },
  'Street-Food-Markt': { lat: 52.5010, lng: 13.4300 },
  'Aussichtspunkt': { lat: 52.5290, lng: 13.3777 },
};

/** travel modes: avg city speed (km/h) + Google/Apple Maps route codes.
 *  `icon` is an svgIcon() name (rendered by the app, no emoji). */
const TRAVEL_MODES = [
  { id: 'walk',    icon: 'walk',    kmh: 4.8, g: 'walking',   a: 'w' },
  { id: 'bike',    icon: 'bike',    kmh: 15,  g: 'bicycling', a: 'w' },
  { id: 'transit', icon: 'transit', kmh: 21,  g: 'transit',   a: 'r' },
  { id: 'car',     icon: 'car',     kmh: 28,  g: 'driving',   a: 'd' },
];

/* ---------------- verification gestures ----------------
   Anti-catfishing: a random gesture is shown as a drawn example (no real
   person's photo) and the user must replicate it in a selfie. `ups` = which
   of the 4 fingers are raised; `thumb`: 'out' | 'in' | 'up'. */
const VERIFY_GESTURES = [
  { id: 'palm',  ups: [1, 1, 1, 1], thumb: 'out' },
  { id: 'peace', ups: [1, 1, 0, 0], thumb: 'in' },
  { id: 'three', ups: [1, 1, 1, 0], thumb: 'in' },
  { id: 'thumb', ups: [0, 0, 0, 0], thumb: 'up' },
];

/* ---- hand illustration ----------------------------------------------
   Minimal single-colour glyph in the app's own line-icon language: one soft
   lavender hand on the neon card, thin unified outline, tapered fingers.
   Palm faces the camera; thumbs-up is drawn as a proper fist. */
const _LINE = 'rgba(76,44,120,0.9)'; // unified outline (violet-ink)
const _LW = 3;
// finger geometry: centre-x, base half-width, tip half-width, fingertip-y up
const _FINGERS = [
  { cx: 116, wb: 15, wt: 12, tip: 112 }, // index
  { cx: 147, wb: 16, wt: 12, tip: 92 },  // middle (longest)
  { cx: 178, wb: 15, wt: 12, tip: 106 }, // ring
  { cx: 206, wb: 13, wt: 10, tip: 140 }, // pinky
];
const _KNUCK = 210; // knuckle line where fingers meet the palm

/** a tapered, round-tipped finger from the knuckle line up to `tip` */
function _fingerUp(f) {
  const { cx, wb, wt, tip } = f;
  return `<path d="M${cx - wb} ${_KNUCK} `
    + `L${cx - wt} ${tip + wt} Q${cx - wt} ${tip} ${cx} ${tip} `
    + `Q${cx + wt} ${tip} ${cx + wt} ${tip + wt} `
    + `L${cx + wb} ${_KNUCK} Z" fill="url(#skin)" stroke="${_LINE}" stroke-width="${_LW}" stroke-linejoin="round"/>`;
}
/** a folded finger: a low rounded knuckle sitting on the palm top */
function _fingerFold(f) {
  const { cx, wb } = f;
  return `<path d="M${cx - wb} ${_KNUCK} L${cx - wb} 196 Q${cx - wb} 182 ${cx} 182 `
    + `Q${cx + wb} 182 ${cx + wb} 196 L${cx + wb} ${_KNUCK} Z" fill="url(#skinF)" stroke="${_LINE}" stroke-width="${_LW}" stroke-linejoin="round"/>`;
}

/** full hand for a gesture (palm-to-camera, or a fist for thumbs-up) */
function handArt(g) {
  // thumbs-up: a fist (rounded block + curled-finger ridges) with thumb up
  if (g.thumb === 'up') {
    return `
      <path d="M150 210 q0 -92 30 -92 q26 0 26 44 l0 48 Z"
            fill="url(#skin)" stroke="${_LINE}" stroke-width="${_LW}" stroke-linejoin="round"/>
      <rect x="102" y="196" width="128" height="132" rx="40" fill="url(#skin)" stroke="${_LINE}" stroke-width="${_LW}"/>
      ${[133, 165, 197].map((x) => `<line x1="${x}" y1="202" x2="${x}" y2="250" stroke="${_LINE}" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>`).join('')}
      <path d="M110 250 q56 20 112 0" fill="none" stroke="${_LINE}" stroke-width="2.6" stroke-linecap="round" opacity="0.55"/>
      <path d="M150 210 q4 -14 22 -15" fill="none" stroke="${_LINE}" stroke-width="2.4" stroke-linecap="round" opacity="0.5"/>`;
  }
  let s = '';
  // cuff + wrist behind the palm
  s += `<path d="M116 300 h68 a24 24 0 0 1 24 24 v52 h-116 v-52 a24 24 0 0 1 24 -24 Z" fill="url(#cuff)"/>`;
  s += `<rect x="120" y="292" width="90" height="34" rx="17" fill="url(#skin)" stroke="${_LINE}" stroke-width="${_LW}"/>`;
  // fingers first, then the palm overlaps their base so it reads as one shape
  s += g.ups.map((up, i) => (up ? _fingerUp(_FINGERS[i]) : _fingerFold(_FINGERS[i]))).join('');
  // thumb
  if (g.thumb === 'out') {
    s += `<path d="M104 240 Q74 222 56 232 Q44 239 49 252 Q56 267 81 266 L106 270 Z"
             fill="url(#skin)" stroke="${_LINE}" stroke-width="${_LW}" stroke-linejoin="round"/>`;
  } else { // tucked across the lower palm
    s += `<path d="M104 262 Q150 246 196 268 Q198 286 180 288 Q150 278 116 284 Q100 284 104 262 Z"
             fill="url(#skinF)" stroke="${_LINE}" stroke-width="${_LW}" stroke-linejoin="round"/>`;
  }
  // palm (drawn over the finger roots)
  s += `<path d="M100 214 Q100 196 120 196 H210 Q230 196 230 218 V292 Q230 318 200 318 H130 Q100 318 100 292 Z"
           fill="url(#skin)" stroke="${_LINE}" stroke-width="${_LW}" stroke-linejoin="round"/>`;
  // re-draw the raised fingers' lower edge so the palm seam disappears
  s += g.ups.map((up, i) => (up ? `<line x1="${_FINGERS[i].cx - _FINGERS[i].wb}" y1="${_KNUCK}" x2="${_FINGERS[i].cx + _FINGERS[i].wb}" y2="${_KNUCK}" stroke="url(#skin)" stroke-width="${_LW + 1}"/>` : '')).join('');
  return s;
}

/** drawn selfie example for a gesture (SVG data-URI) */
function gestureSVG(id) {
  const g = VERIFY_GESTURES.find((x) => x.id === id) || VERIFY_GESTURES[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 380">
<defs>
<linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#1a1330"/><stop offset="1" stop-color="#100c1a"/>
</linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.44" r="0.62">
<stop offset="0" stop-color="rgba(168,85,247,0.42)"/><stop offset="1" stop-color="rgba(168,85,247,0)"/>
</radialGradient>
<linearGradient id="skin" x1="0" y1="0" x2="0.4" y2="1">
<stop offset="0" stop-color="#f6f1ff"/><stop offset="1" stop-color="#e4d7fb"/>
</linearGradient>
<linearGradient id="skinF" x1="0" y1="0" x2="0.4" y2="1">
<stop offset="0" stop-color="#e6dbfa"/><stop offset="1" stop-color="#d3c2f2"/>
</linearGradient>
<linearGradient id="cuff" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#7c3aed"/>
</linearGradient>
</defs>
<rect x="6" y="6" width="288" height="368" rx="34" fill="url(#card)"/>
<circle cx="150" cy="190" r="134" fill="url(#glow)"/>
<circle cx="52" cy="52" r="2.4" fill="rgba(255,255,255,0.7)"/>
<circle cx="248" cy="84" r="1.8" fill="hsla(268,90%,82%,0.85)"/>
<circle cx="60" cy="330" r="1.6" fill="rgba(255,255,255,0.5)"/>
${handArt(g)}
<rect x="6" y="6" width="288" height="368" rx="34" fill="none" stroke="#a855f7" stroke-width="4"/>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
