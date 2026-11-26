// Zeichnet das App-Icon (Teller mit Blatt) als PNG, ohne externe Pakete.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) { let c, crc = ~0; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex('#2f6f5e'), PLATE = hex('#f7f4ee'), RIM = hex('#e4ded2'), LEAF = hex('#6cc4a5'), VEIN = hex('#2f6f5e');

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const S = 4; // Supersampling
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const u = (x + (sx + .5) / S) / size - .5, v = (y + (sy + .5) / S) / size - .5;
      const r = Math.hypot(u, v);
      let col = BG;
      if (r < .36) col = RIM;
      if (r < .29) col = PLATE;
      // Blatt: gedrehte Linse
      const a = -Math.PI / 4, cu = u * Math.cos(a) - v * Math.sin(a), cv = u * Math.sin(a) + v * Math.cos(a);
      const L = .19, W = .085;
      if (Math.abs(cu) < L && Math.abs(cv) < W * (1 - (cu / L) ** 2)) col = Math.abs(cv) < .008 && Math.abs(cu) < L * .85 ? VEIN : LEAF;
      acc = acc.map((c, i) => c + col[i]);
    }
    const o = (y * size + x) * 4;
    px[o] = acc[0] / (S * S); px[o + 1] = acc[1] / (S * S); px[o + 2] = acc[2] / (S * S); px[o + 3] = 255;
  }
  return png(size, px);
}
const out = new URL('../icons/', import.meta.url);
for (const s of [180, 192, 512]) writeFileSync(new URL(`icon-${s}.png`, out), draw(s));
console.log('ok');
