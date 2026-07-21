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
<text x="196" y="66" font-size="24" fill="#c084fc" text-anchor="middle">&#10022;</text>
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
