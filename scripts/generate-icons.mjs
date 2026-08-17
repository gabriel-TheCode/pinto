/**
 * Generates the extension icons as real PNGs with no image dependency.
 *
 * The mark is a rounded square with the warm brand gradient (#FF9100 ->
 * #DF301C) and a pixelated white "P." — a blocky P followed by a period —
 * drawn straight into an RGBA buffer and deflated into a PNG. Everything is
 * hard-edged: the glyph snaps to a coarse bitmap so it reads as pixel art, not
 * a smooth letterform.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/icons');

const SIZES = [16, 32, 48, 128];

const BRAND_FROM = [0xff, 0x91, 0x00]; // #FF9100
const BRAND_TO = [0xdf, 0x30, 0x1c]; // #DF301C

/**
 * 6-wide x 8-tall bitmap of "P." — a blocky P (stem column 0, bowl columns
 * 0-3) with a 2x2 period at the bottom-right.
 */
const GLYPH_W = 6;
const GLYPH_H = 8;
const GLYPH = [
  '111100', // bowl top
  '100100',
  '100100',
  '111100', // bowl close
  '100000',
  '100000',
  '100011', // stem + top of period
  '000011', // period
];

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.24;

  // Snap the glyph to whole pixels so its cells stay crisp and square at every
  // size — that hard edge is what makes it read as "pixelated".
  const cell = Math.max(1, Math.floor((size * 0.4) / GLYPH_W));
  const glyphW = cell * GLYPH_W;
  const glyphH = cell * GLYPH_H;
  const glyphX = Math.round((size - glyphW) / 2);
  const glyphY = Math.round((size - glyphH) / 2);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!insideRounded(x, y, size, radius)) continue;

      const t = (x + y) / (2 * size);
      let r = lerp(BRAND_FROM[0], BRAND_TO[0], t);
      let g = lerp(BRAND_FROM[1], BRAND_TO[1], t);
      let b = lerp(BRAND_FROM[2], BRAND_TO[2], t);

      const gx = Math.floor((x - glyphX) / cell);
      const gy = Math.floor((y - glyphY) / cell);
      const inGlyph =
        gx >= 0 && gx < GLYPH_W && gy >= 0 && gy < GLYPH_H && GLYPH[gy][gx] === '1';
      if (inGlyph) {
        r = 255;
        g = 255;
        b = 255;
      }

      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

function insideRounded(x, y, size, radius) {
  const cx = Math.min(Math.max(x + 0.5, radius), size - radius);
  const cy = Math.min(Math.max(y + 0.5, radius), size - radius);
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= radius * radius;
}

mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), png(size, render(size)));
}
console.log(`icons: wrote ${SIZES.length} files to public/icons`);
