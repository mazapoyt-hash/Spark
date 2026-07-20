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

// brand palette: warm paper, ink, vermilion accent
const PAPER = hex('#f4efe5');
const INK = hex('#191610');
const ACCENT = hex('#e0421b');

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
 * Print-style tile: flat paper, inset ink frame, vermilion heart with a
 * hard offset ink shadow. No gradients.
 *
 * @param size    icon edge in px
 * @param opts.rounded  corner radius fraction (0 = square tile for maskable/apple)
 * @param opts.heartScale heart size relative to icon
 * @param opts.frame  draw the inset ink frame (skip for maskable safe zone)
 */
function drawIcon(size, { rounded = 0.06, heartScale = 0.30, frame = true } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const r = rounded * size;
  const s = heartScale * size;
  const cx = size / 2;
  const cy = size / 2 + size * 0.02;
  const off = size * 0.028;             // hard shadow offset
  const fIn = size * 0.085;             // frame inset
  const fW = Math.max(2, size * 0.028); // frame stroke width
  const SS = 3; // 3x3 supersampling
  const step = 1 / SS;

  const heartAt = (fx, fy, ox, oy) => {
    const u = (fx - cx - ox) / s;
    const v = -(fy - cy - oy) / s + 0.12;
    return inHeart(u * 1.05, v);
  };
  const frameAt = (fx, fy) => {
    const lo = fIn, hi = size - fIn;
    if (fx < lo || fx > hi || fy < lo || fy > hi) return false;
    return fx < lo + fW || fx > hi - fW || fy < lo + fW || fy > hi - fW;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0, heartCov = 0, shadowCov = 0, frameCov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) * step;
          const fy = y + (sy + 0.5) * step;
          const inside = rounded > 0 ? roundedRectCoverage(fx, fy, size, r) : 1;
          cov += inside;
          if (inside) {
            if (heartAt(fx, fy, 0, 0)) heartCov++;
            else if (heartAt(fx, fy, off, off)) shadowCov++;
            if (frame && frameAt(fx, fy)) frameCov++;
          }
        }
      }
      cov /= SS * SS;
      heartCov /= SS * SS;
      shadowCov /= SS * SS;
      frameCov /= SS * SS;

      let c = PAPER;
      if (frameCov > 0) c = mix(c, INK, frameCov);
      if (shadowCov > 0) c = mix(c, INK, shadowCov);
      if (heartCov > 0) c = mix(c, ACCENT, heartCov);

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
  ['icon-192.png', 192, { rounded: 0.06, heartScale: 0.30, frame: true }],
  ['icon-512.png', 512, { rounded: 0.06, heartScale: 0.30, frame: true }],
  ['icon-maskable-192.png', 192, { rounded: 0, heartScale: 0.24, frame: false }],
  ['icon-maskable-512.png', 512, { rounded: 0, heartScale: 0.24, frame: false }],
  ['apple-touch-icon.png', 180, { rounded: 0, heartScale: 0.28, frame: true }],
];

for (const [name, size, opts] of targets) {
  const buf = drawIcon(size, opts);
  writeFileSync(join(OUT, name), buf);
  console.log(`✓ icons/${name} (${size}×${size}, ${(buf.length / 1024).toFixed(1)} kB)`);
}
console.log('Done.');
