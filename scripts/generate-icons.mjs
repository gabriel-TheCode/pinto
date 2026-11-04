/**
 * Generates the extension icons as real PNGs with no image dependency.
 *
 * The shapes come from src/ui/mark.ts, the one definition of Pinto's mark, and
 * are rasterised here: each pixel is sampled on a 6x6 grid, which gives the
 * edges proper anti-aliasing without a renderer. The toolbar size uses the
 * pixel-snapped drawing; the others scale the full one. The 128 px icon keeps
 * 16 px of transparent margin on each side, as the Chrome Web Store asks, so
 * the tile is 96 px there.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND, MARK, MARK_16 } from '../src/ui/mark.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/icons');

const ICONS = [
  { size: 16, drawing: MARK_16, inset: 0 },
  { size: 32, drawing: MARK, inset: 0 },
  { size: 48, drawing: MARK, inset: 0 },
  { size: 128, drawing: MARK, inset: 16 },
];
const SAMPLES = 6;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const FROM = rgb(BRAND.from);
const TO = rgb(BRAND.to);

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

/** Even-odd ray test. */
function inPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundedSquare(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 && x >= 0 && y >= 0 && x <= size && y <= size;
}

function inGlyph(x, y, { outline, hole }) {
  if (!inPolygon(x, y, outline)) return false;
  if ('polygon' in hole) return !inPolygon(x, y, hole.polygon);
  const [cx, cy, r] = hole.circle;
  return (x - cx) ** 2 + (y - cy) ** 2 > r * r;
}

function render({ size, drawing, inset }) {
  const pixels = Buffer.alloc(size * size * 4);
  const tile = size - inset * 2;
  const scale = drawing.size / tile;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let covered = 0;
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          // Sample position in drawing units.
          const x = (px - inset + (sx + 0.5) / SAMPLES) * scale;
          const y = (py - inset + (sy + 0.5) / SAMPLES) * scale;
          if (!inRoundedSquare(x, y, drawing.size, drawing.radius)) continue;
          covered++;
          if (inGlyph(x, y, drawing)) {
            sum[0] += 255;
            sum[1] += 255;
            sum[2] += 255;
          } else {
            // Same diagonal as the SVG's x1=0 y1=0 x2=1 y2=1 gradient.
            const t = (x + y) / (2 * drawing.size);
            for (let c = 0; c < 3; c++) sum[c] += FROM[c] + (TO[c] - FROM[c]) * t;
          }
        }
      }
      if (!covered) continue;
      const i = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(sum[c] / covered);
      pixels[i + 3] = Math.round((255 * covered) / SAMPLES ** 2);
    }
  }
  return pixels;
}

mkdirSync(outDir, { recursive: true });
for (const icon of ICONS) {
  writeFileSync(resolve(outDir, `icon-${icon.size}.png`), png(icon.size, render(icon)));
}
console.log(`icons: wrote ${ICONS.length} files to public/icons`);
