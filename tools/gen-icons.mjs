#!/usr/bin/env node
/**
 * DATE ME — PWA icon generator (zero dependencies).
 * Renders the brand heart on a gradient tile and writes real PNG files
 * using Node's built-in zlib for compression.
 *
 * Usage: node tools/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(OUT, { recursive: true });

/* ---------- minimal PNG encoder ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // scanlines with filter byte 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- drawing ---------- */
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

// brand gradient stops (top-left → bottom-right)
const G = ['#ff2d55', '#ff2d9c', '#8f2dff'].map(hex);
const HEART_TOP = hex('#ffffff');
const HEART_BOTTOM = hex('#ffdbe9');

function gradientAt(t) {
  return t < 0.5 ? mix(G[0], G[1], t * 2) : mix(G[1], G[2], (t - 0.5) * 2);
}

// classic implicit heart: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0  (y points up)
function inHeart(u, v) {
  const a = u * u + v * v - 1;
  return a * a * a - u * u * v * v * v <= 0;
}

function roundedRectCoverage(x, y, size, r) {
  // 1 inside, 0 outside; hard test per subsample (AA comes from supersampling)
  const dx = Math.max(r - x, x - (size - r), 0);
  const dy = Math.max(r - y, y - (size - r), 0);
  return dx * dx + dy * dy <= r * r ? 1 : 0;
}

/**
 * @param size    icon edge in px
 * @param opts.rounded  corner radius fraction (0 = square tile for maskable/apple)
 * @param opts.heartScale heart size relative to icon
 */
function drawIcon(size, { rounded = 0.225, heartScale = 0.30 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const r = rounded * size;
  const s = heartScale * size;
  const cx = size / 2;
  const cy = size / 2 + size * 0.02;
  const SS = 3; // 3x3 supersampling
  const step = 1 / SS;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0, heartCov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) * step;
          const fy = y + (sy + 0.5) * step;
          const inside = rounded > 0 ? roundedRectCoverage(fx, fy, size, r) : 1;
          cov += inside;
          if (inside) {
            const u = (fx - cx) / s;
            const v = -(fy - cy) / s + 0.12;
            if (inHeart(u * 1.05, v)) heartCov++;
          }
        }
      }
      cov /= SS * SS;
      heartCov /= SS * SS;

      const t = (x + y) / (2 * size);
      let c = gradientAt(t);
      // soft radial glow behind the heart
      const d = Math.hypot(x - cx, y - cy) / (size * 0.5);
      const glow = Math.max(0, 1 - d) * 0.18;
      c = mix(c, [255, 255, 255], glow);
      if (heartCov > 0) {
        const hv = (y - (cy - s * 1.1)) / (s * 2.2);
        const hc = mix(HEART_TOP, HEART_BOTTOM, Math.min(Math.max(hv, 0), 1));
        c = mix(c, hc, heartCov);
      }

      const i = (y * size + x) * 4;
      px[i] = Math.round(c[0]);
      px[i + 1] = Math.round(c[1]);
      px[i + 2] = Math.round(c[2]);
      px[i + 3] = Math.round(cov * 255);
    }
  }
  return encodePNG(size, size, px);
}

const targets = [
  ['icon-192.png', 192, { rounded: 0.225, heartScale: 0.31 }],
  ['icon-512.png', 512, { rounded: 0.225, heartScale: 0.31 }],
  ['icon-maskable-192.png', 192, { rounded: 0, heartScale: 0.26 }],
  ['icon-maskable-512.png', 512, { rounded: 0, heartScale: 0.26 }],
  ['apple-touch-icon.png', 180, { rounded: 0, heartScale: 0.30 }],
];

for (const [name, size, opts] of targets) {
  const buf = drawIcon(size, opts);
  writeFileSync(join(OUT, name), buf);
  console.log(`✓ icons/${name} (${size}×${size}, ${(buf.length / 1024).toFixed(1)} kB)`);
}
console.log('Done.');
