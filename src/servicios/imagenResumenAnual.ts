/**
 * Dibuja la imagen del resumen del año (formato historia de Instagram, 1080×1920)
 * para compartirla con el menú del teléfono.
 */
import type { ResumenAnual } from '../dominio/metricas';
import { buscarEmocion, nivelHambre, type Emocion } from '../dominio/emociones';
import { nombreMes } from '../dominio/fechas';
import { config } from '../config';

/** Cuenta de Instagram del proyecto (si haces un fork, cámbiala o déjala vacía en config.ts). */
const INSTAGRAM = config.instagram;
const W = 1080;
const H = 1920;
const FUENTE = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function ajustarTexto(ctx: CanvasRenderingContext2D, texto: string, anchoMax: number, tamano: number, peso = 800): number {
  let t = tamano;
  do {
    ctx.font = `${peso} ${t}px ${FUENTE}`;
    if (ctx.measureText(texto).width <= anchoMax) break;
    t -= 2;
  } while (t > 18);
  return t;
}

function rectRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface Tarjeta {
  emoji: string;
  titulo: string;
  valor: string;
}

/** Tarjetas de datos del resumen (también se muestran en pantalla). */
export function tarjetasResumen(r: ResumenAnual, personalizadas: readonly Emocion[]): Tarjeta[] {
  const emo = buscarEmocion(r.emocionTop?.id, personalizadas);
  const hambre = r.hambrePromedio != null ? nivelHambre(Math.round(r.hambrePromedio)) : undefined;
  const t: Tarjeta[] = [
    { emoji: '🔥', titulo: 'Racha más larga', valor: `${r.rachaMasLarga} ${r.rachaMasLarga === 1 ? 'día' : 'días'}` },
    { emoji: '📅', titulo: 'Días con completo', valor: String(r.diasConCompletos) },
    { emoji: '🏆', titulo: 'Mes más completero', valor: r.mesTop ? `${mayuscula(nombreMes(r.mesTop.mes, true))} (${r.mesTop.completos})` : '—' },
    { emoji: '📍', titulo: 'Local favorito', valor: r.localFavorito ? r.localFavorito.nombre : '—' },
    { emoji: emo?.emoji ?? '💭', titulo: 'Emoción del año', valor: emo?.nombre ?? '—' },
    { emoji: hambre?.emoji ?? '🍽️', titulo: 'Hambre típica', valor: hambre?.nombre ?? '—' },
  ];
  if (r.mejorPuntuado && r.mejorPuntuado.puntuacionPromedio != null) {
    t.push({ emoji: '⭐', titulo: 'Mejor nota', valor: `${r.mejorPuntuado.nombre} (${r.mejorPuntuado.puntuacionPromedio.toFixed(1)})` });
  }
  t.push({ emoji: '📈', titulo: 'Promedio semanal', valor: r.promedioSemanal.toFixed(1).replace('.', ',') });
  return t;
}

export async function dibujarResumenAnual(r: ResumenAnual, personalizadas: readonly Emocion[]): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Fondo: pan, tomate y palta
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#c8102e');
  g.addColorStop(0.55, '#e4572e');
  g.addColorStop(1, '#f3a712');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.arc((i * 263) % W, (i * 467) % H, 40 + ((i * 37) % 90), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff8ee';
  ctx.font = `700 40px ${FUENTE}`;
  ctx.fillText('🌭  COMPLETÓMETRO', W / 2, 150);
  ctx.font = `800 76px ${FUENTE}`;
  ctx.fillText(`Mi ${r.anio} en completos`, W / 2, 270);

  ctx.font = `900 ${r.total >= 1000 ? 260 : 330}px ${FUENTE}`;
  ctx.fillText(String(r.total), W / 2, 610);
  ctx.font = `700 56px ${FUENTE}`;
  ctx.fillText(r.total === 1 ? 'completo' : 'completos', W / 2, 700);

  const tarjetas = tarjetasResumen(r, personalizadas).slice(0, 8);
  const margen = 70;
  const gap = 24;
  const cw = (W - margen * 2 - gap) / 2;
  const ch = 196;
  const y0 = 765;
  tarjetas.forEach((t, i) => {
    const x = margen + (i % 2) * (cw + gap);
    const y = y0 + Math.floor(i / 2) * (ch + gap);
    rectRedondo(ctx, x, y, cw, ch, 36);
    ctx.fillStyle = 'rgba(255,248,238,0.95)';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = `400 56px ${FUENTE}`;
    ctx.fillText(t.emoji, x + 32, y + 74);
    ctx.fillStyle = '#7a4a2a';
    ctx.font = `600 30px ${FUENTE}`;
    ctx.fillText(t.titulo, x + 32, y + 120);
    ctx.fillStyle = '#2a1a10';
    const tam = ajustarTexto(ctx, t.valor, cw - 64, 44);
    ctx.font = `800 ${tam}px ${FUENTE}`;
    ctx.fillText(t.valor, x + 32, y + 170);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff8ee';
  ctx.font = `700 46px ${FUENTE}`;
  // El pie queda sobre los ~100 px de abajo, que Instagram tapa con sus botones.
  ctx.fillText('¿Y tú, cuántos te comiste?', W / 2, 1710);

  // Invitación a etiquetar la cuenta del proyecto, en una "píldora" para que se lea sobre el fondo.
  const etiqueta = `¡Etiquétanos! 😃 ${INSTAGRAM}`;
  ctx.font = `800 40px ${FUENTE}`;
  const anchoPildora = ctx.measureText(etiqueta).width + 72;
  rectRedondo(ctx, (W - anchoPildora) / 2, 1745, anchoPildora, 72, 36);
  ctx.fillStyle = 'rgba(255,248,238,0.95)';
  ctx.fill();
  ctx.fillStyle = '#c8102e';
  ctx.fillText(etiqueta, W / 2, 1795);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('No pude crear la imagen.');
  return new File([blob], `mi-${r.anio}-en-completos.png`, { type: 'image/png' });
}
