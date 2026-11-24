// Gera os ícones PNG do app (sem dependências): node scripts/generate-icons.js
// Desenha o mesmo ícone de icons/icon.svg: quadrado arredondado em degradê + marca de "feito".
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');

// --- PNG mínimo (RGBA 8 bits) ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Geometria (coordenadas 0..512, como no SVG) ---
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function sdRoundRect(x, y, half, r) {
  const qx = Math.abs(x - 256) - (half - r);
  const qy = Math.abs(y - 256) - (half - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}
const CHECK = [[143, 266], [225, 348], [379, 172]];
const STROKE = 23; // metade da espessura (46)
const C1 = [0x22, 0xc5, 0x5e];
const C2 = [0x15, 0x80, 0x3d];

/**
 * @param size   tamanho em px
 * @param radius raio do canto (0 = quadrado cheio)
 * @param scale  escala da marca em relação ao centro (maskable usa < 1 para ficar na zona segura)
 */
function draw(size, radius, scale = 1) {
  const buf = Buffer.alloc(size * size * 4);
  const k = 512 / size; // unidades por pixel
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) * k;
      const y = (py + 0.5) * k;
      const bgA = radius > 0 ? clamp(0.5 - sdRoundRect(x, y, 256, radius) / k, 0, 1) : 1;

      const t = clamp((x + y) / 1024, 0, 1);
      let r = C1[0] + (C2[0] - C1[0]) * t;
      let g = C1[1] + (C2[1] - C1[1]) * t;
      let b = C1[2] + (C2[2] - C1[2]) * t;

      // marca de "feito" (escalada em torno do centro)
      const cx = 256 + (x - 256) / scale;
      const cy = 256 + (y - 256) / scale;
      let d = Infinity;
      for (let i = 0; i < CHECK.length - 1; i++) {
        d = Math.min(d, sdSegment(cx, cy, CHECK[i][0], CHECK[i][1], CHECK[i + 1][0], CHECK[i + 1][1]));
      }
      const ckA = clamp(0.5 - ((d - STROKE) * scale) / k, 0, 1);
      r += (255 - r) * ckA; g += (255 - g) * ckA; b += (255 - b) * ckA;

      const o = (py * size + px) * 4;
      buf[o] = Math.round(r); buf[o + 1] = Math.round(g); buf[o + 2] = Math.round(b);
      buf[o + 3] = Math.round(bgA * 255);
    }
  }
  return encodePNG(size, buf);
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = [
  ['icon-192.png', 192, 112],
  ['icon-512.png', 512, 112],
  ['maskable-512.png', 512, 0, 0.78],
  ['apple-touch-icon.png', 180, 0],
];
for (const [name, size, radius, scale] of jobs) {
  fs.writeFileSync(path.join(OUT, name), draw(size, radius, scale));
  console.log('ok', name);
}
