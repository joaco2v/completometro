// Genera los íconos PNG y SVG del Completómetro sin dependencias (dibujo vectorial simple + PNG con zlib).
// Uso: node scripts/generar-iconos.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const FONDO = [200, 16, 46];

// Capas del completo, de abajo hacia arriba. Coordenadas normalizadas (0..1).
// tipo capsula: segmento horizontal [cx-l, cx+l] a altura cy, con radio r.
const capas = [
  { tipo: 'capsula', cx: 0.5, cy: 0.6, l: 0.3, r: 0.15, color: [196, 140, 72] }, // borde del pan
  { tipo: 'capsula', cx: 0.5, cy: 0.585, l: 0.3, r: 0.13, color: [233, 184, 114] }, // pan
  { tipo: 'capsula', cx: 0.5, cy: 0.5, l: 0.36, r: 0.075, color: [170, 62, 38] }, // vienesa
  { tipo: 'capsula', cx: 0.5, cy: 0.445, l: 0.27, r: 0.05, color: [124, 179, 66] }, // palta
  ...[0.3, 0.4, 0.5, 0.6, 0.7].map((x) => ({ tipo: 'circulo', cx: x, cy: 0.43, r: 0.035, color: [232, 48, 63] })), // tomate
  { tipo: 'ola', cx: 0.5, cy: 0.395, l: 0.27, grosor: 0.02, amp: 0.018, color: [255, 250, 235] }, // mayo
];

function distanciaCapa(c, x, y) {
  if (c.tipo === 'capsula') {
    const px = Math.max(c.cx - c.l, Math.min(c.cx + c.l, x));
    return Math.hypot(x - px, y - c.cy) - c.r;
  }
  if (c.tipo === 'circulo') return Math.hypot(x - c.cx, y - c.cy) - c.r;
  // ola: banda sinusoidal
  if (x < c.cx - c.l || x > c.cx + c.l) return 1;
  const yOla = c.cy + Math.sin(((x - (c.cx - c.l)) / (2 * c.l)) * Math.PI * 6) * c.amp;
  return Math.abs(y - yOla) - c.grosor / 2;
}

function dentroRectRedondo(x, y, radio) {
  const dx = Math.max(radio - x, 0, x - (1 - radio));
  const dy = Math.max(radio - y, 0, y - (1 - radio));
  return dx * dx + dy * dy <= radio * radio;
}

/** Devuelve RGBA para el punto (x, y). escala < 1 achica el dibujo (zona segura de íconos maskable). */
function colorEn(x, y, { escala, redondeado }) {
  if (redondeado && !dentroRectRedondo(x, y, 0.22)) return [0, 0, 0, 0];
  const ux = (x - 0.5) / escala + 0.5;
  const uy = (y - 0.5) / escala + 0.5;
  let color = FONDO;
  for (const c of capas) if (distanciaCapa(c, ux, uy) <= 0) color = c.color;
  return [...color, 255];
}

function renderizar(tamano, opciones) {
  const ss = 4;
  const px = Buffer.alloc(tamano * tamano * 4);
  for (let j = 0; j < tamano; j++) {
    for (let i = 0; i < tamano; i++) {
      const acc = [0, 0, 0, 0];
      for (let sj = 0; sj < ss; sj++) {
        for (let si = 0; si < ss; si++) {
          const c = colorEn((i + (si + 0.5) / ss) / tamano, (j + (sj + 0.5) / ss) / tamano, opciones);
          acc[0] += c[0] * c[3]; acc[1] += c[1] * c[3]; acc[2] += c[2] * c[3]; acc[3] += c[3];
        }
      }
      const o = (j * tamano + i) * 4;
      const a = acc[3] / (ss * ss);
      px[o] = acc[3] ? Math.round(acc[0] / acc[3]) : 0;
      px[o + 1] = acc[3] ? Math.round(acc[1] / acc[3]) : 0;
      px[o + 2] = acc[3] ? Math.round(acc[2] / acc[3]) : 0;
      px[o + 3] = Math.round(a);
    }
  }
  return png(tamano, tamano, px);
}

// ---- codificador PNG mínimo ----
const tablaCrc = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = tablaCrc[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([largo, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const crudo = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    crudo[y * (w * 4 + 1)] = 0;
    rgba.copy(crudo, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

// ---- SVG equivalente (favicon) ----
function svg() {
  const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const S = 512;
  const partes = capas.map((c) => {
    if (c.tipo === 'capsula') {
      return `<rect x="${(c.cx - c.l - c.r) * S}" y="${(c.cy - c.r) * S}" width="${(2 * c.l + 2 * c.r) * S}" height="${2 * c.r * S}" rx="${c.r * S}" fill="${hex(c.color)}"/>`;
    }
    if (c.tipo === 'circulo') return `<circle cx="${c.cx * S}" cy="${c.cy * S}" r="${c.r * S}" fill="${hex(c.color)}"/>`;
    const pts = [];
    for (let k = 0; k <= 60; k++) {
      const x = c.cx - c.l + (2 * c.l * k) / 60;
      pts.push(`${(x * S).toFixed(1)},${((c.cy + Math.sin((k / 60) * Math.PI * 6) * c.amp) * S).toFixed(1)}`);
    }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${hex(c.color)}" stroke-width="${c.grosor * S}" stroke-linecap="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${hex(FONDO)}"/>${partes.join('')}</svg>\n`;
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icono-192.png', renderizar(192, { escala: 1, redondeado: true }));
writeFileSync('public/icono-512.png', renderizar(512, { escala: 1, redondeado: true }));
writeFileSync('public/icono-512-maskable.png', renderizar(512, { escala: 0.78, redondeado: false }));
writeFileSync('public/apple-touch-icon.png', renderizar(180, { escala: 0.9, redondeado: false }));
writeFileSync('public/icono.svg', svg());
console.log('Íconos generados en public/');
