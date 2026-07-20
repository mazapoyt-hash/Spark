/* DATE ME — demo dataset + generated avatars */
'use strict';

/**
 * Editorial avatar (SVG data-URI): flat tinted paper, ink frame,
 * oversized serif initial, one accent mark. Deterministic per person
 * via hue pair.
 */
function avatarDataURI(name, h1, h2) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const bg = `hsl(${h1},32%,76%)`;
  const shape = `hsl(${h2},38%,58%)`;
  const ink = '#191610';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300">
<rect width="240" height="300" fill="${bg}"/>
<circle cx="182" cy="234" r="82" fill="${shape}"/>
<rect x="36" y="42" width="64" height="64" fill="none" stroke="${ink}" stroke-width="3"/>
<text x="118" y="212" font-family="Georgia,'Times New Roman',serif" font-size="168" font-weight="700" fill="${ink}" text-anchor="middle">${initial}</text>
<text x="196" y="60" font-size="28" fill="#e0421b" text-anchor="middle">&#10045;</text>
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
