/**
 * Imágenes para historias (1080×1920) con estilo "ticket retro" de fuente de soda:
 *  - "Mi top 5" de locales.
 *  - Plantilla en blanco "Mi completo favorito" para rellenar en Instagram.
 */
import { config } from '../config';
import { TAMANO_TOP, type LocalTop } from '../dominio/top';

const W = 1080;
const H = 1920;
const MONO = '"Courier New", Courier, ui-monospace, "SF Mono", Menlo, monospace';
const SANS = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const ROJO = '#c8102e';
const PAPEL = '#fbf3e3';
const TINTA = '#2b2118';
const TINTA_SUAVE = '#7d6a58';

// Ticket: márgenes y altura
const TX = 100;
const TW = W - TX * 2;
const TY = 150;
const TH = 1560;
const DIENTE = 22;

function lienzo() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Fondo rojo tomate con lunares suaves
  ctx.fillStyle = ROJO;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 30; y < H; y += 80) {
    for (let x = (y / 80) % 2 ? 70 : 30; x < W; x += 80) {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return { canvas, ctx };
}

/** Papel con bordes dentados arriba y abajo, y una sombra. */
function papel(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.beginPath();
  ctx.moveTo(TX, TY + DIENTE);
  for (let x = TX; x < TX + TW; x += DIENTE * 2) {
    ctx.lineTo(x + DIENTE, TY);
    ctx.lineTo(Math.min(x + DIENTE * 2, TX + TW), TY + DIENTE);
  }
  ctx.lineTo(TX + TW, TY + TH - DIENTE);
  for (let x = TX + TW; x > TX; x -= DIENTE * 2) {
    ctx.lineTo(x - DIENTE, TY + TH);
    ctx.lineTo(Math.max(x - DIENTE * 2, TX), TY + TH - DIENTE);
  }
  ctx.closePath();
  ctx.fillStyle = PAPEL;
  ctx.fill();
  ctx.restore();
  // textura de papel: líneas muy tenues
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = TINTA;
  for (let y = TY + 40; y < TY + TH - 40; y += 6) ctx.fillRect(TX + 10, y, TW - 20, 1);
  ctx.restore();
}

function texto(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, o: { tam?: number; peso?: number; color?: string; alinear?: CanvasTextAlign; fuente?: string } = {}) {
  ctx.font = `${o.peso ?? 400} ${o.tam ?? 34}px ${o.fuente ?? MONO}`;
  ctx.fillStyle = o.color ?? TINTA;
  ctx.textAlign = o.alinear ?? 'left';
  ctx.fillText(t, x, y);
}

function lineaPunteada(ctx: CanvasRenderingContext2D, y: number, x1 = TX + 50, x2 = TX + TW - 50) {
  ctx.save();
  ctx.strokeStyle = TINTA_SUAVE;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/** Línea para escribir encima (en Instagram). */
function lineaEscribir(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  ctx.save();
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/** Recorta un texto con "…" para que quepa en el ancho dado. */
function recortar(ctx: CanvasRenderingContext2D, t: string, ancho: number): string {
  if (ctx.measureText(t).width <= ancho) return t;
  let s = t;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > ancho) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

function encabezado(ctx: CanvasRenderingContext2D, y: number) {
  const cx = W / 2;
  texto(ctx, '★ COMPLETÓMETRO ★', cx, y, { tam: 46, peso: 700, alinear: 'center' });
  texto(ctx, 'FUENTE DE SODA PERSONAL', cx, y + 46, { tam: 26, color: TINTA_SUAVE, alinear: 'center' });
}

function fechaBoleta(ahora: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(ahora.getDate())}/${p(ahora.getMonth() + 1)}/${ahora.getFullYear()}  ${p(ahora.getHours())}:${p(ahora.getMinutes())}`;
}

/** Código de barras decorativo (determinístico según una semilla). */
function codigoBarras(ctx: CanvasRenderingContext2D, y: number, semilla: string) {
  let s = [...semilla].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const ancho = 520;
  let x = (W - ancho) / 2;
  ctx.fillStyle = TINTA;
  while (x < (W + ancho) / 2) {
    const w = 2 + Math.floor(rnd() * 6);
    if (rnd() > 0.35) ctx.fillRect(x, y, w, 90);
    x += w + 2 + Math.floor(rnd() * 4);
  }
}

/** Timbre redondo rojo, girado, como sello de "aprobado". */
function timbre(ctx: CanvasRenderingContext2D, x: number, y: number, arriba: string, centro: string, escala = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.22);
  ctx.scale(escala, escala);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = ROJO;
  ctx.fillStyle = ROJO;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  // El texto de arriba se achica para que no se salga del círculo interior.
  let tam = 22;
  do {
    ctx.font = `700 ${tam}px ${MONO}`;
  } while (ctx.measureText(arriba).width > 118 && --tam > 12);
  ctx.fillText(arriba, 0, -32);
  ctx.font = `800 40px ${SANS}`;
  ctx.fillText(centro, 0, 14);
  ctx.font = `700 22px ${MONO}`;
  ctx.fillText('★ ★ ★', 0, 48);
  ctx.restore();
}

/** Pie fuera del ticket, sobre el fondo rojo (sobre los ~100 px que tapa Instagram). */
function pieEtiqueta(ctx: CanvasRenderingContext2D) {
  if (!config.instagram) return;
  const t = `¡Etiquétanos! 😃 ${config.instagram}`;
  ctx.font = `800 40px ${SANS}`;
  const ancho = ctx.measureText(t).width + 72;
  const x = (W - ancho) / 2;
  const y = TY + TH + 36;
  ctx.fillStyle = PAPEL;
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, 72, 36);
  ctx.fill();
  ctx.fillStyle = ROJO;
  ctx.textAlign = 'center';
  ctx.fillText(t, W / 2, y + 50);
}

async function aArchivo(canvas: HTMLCanvasElement, nombre: string): Promise<File> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('No pude crear la imagen.');
  return new File([blob], nombre, { type: 'image/png' });
}

const estrellas = (nota: number) => {
  const llenas = Math.round(nota / 2);
  return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
};

const decimal = (n: number) => n.toFixed(1).replace('.', ',');

/** "Mi top 5" en forma de boleta. Si hay menos de 5 locales, deja líneas en blanco para rellenar. */
export async function dibujarTop5(top: readonly LocalTop[], o: { completosAnio: number; localesProbados: number; ahora?: Date }): Promise<File> {
  const ahora = o.ahora ?? new Date();
  const { canvas, ctx } = lienzo();
  papel(ctx);
  const izq = TX + 60;
  const der = TX + TW - 60;

  encabezado(ctx, TY + 90);
  lineaPunteada(ctx, TY + 160);
  texto(ctx, `BOLETA N° ${ahora.getFullYear()}-0005`, izq, TY + 210, { tam: 28 });
  texto(ctx, fechaBoleta(ahora), der, TY + 210, { tam: 28, alinear: 'right' });
  lineaPunteada(ctx, TY + 240);

  texto(ctx, 'MI TOP 5', W / 2, TY + 345, { tam: 104, peso: 800, alinear: 'center', fuente: SANS });
  texto(ctx, 'DE COMPLETOS', W / 2, TY + 400, { tam: 40, peso: 700, alinear: 'center' });
  timbre(ctx, TX + TW - 82, TY + 110, 'CERTIFICADO', 'TOP', 0.72);
  lineaPunteada(ctx, TY + 440);

  const y0 = TY + 520;
  const alto = 140;
  for (let i = 0; i < TAMANO_TOP; i++) {
    const l = top[i];
    const y = y0 + i * alto;
    texto(ctx, `${i + 1}.`, izq, y, { tam: 64, peso: 800, color: ROJO, fuente: SANS });
    const xNombre = izq + 90;
    if (!l) {
      lineaEscribir(ctx, xNombre, der, y + 6);
      texto(ctx, '(escribe aquí)', xNombre, y + 48, { tam: 24, color: TINTA_SUAVE });
      continue;
    }
    const nota = l.nota != null ? decimal(l.nota) : '';
    ctx.font = `700 44px ${MONO}`;
    const anchoNota = nota ? ctx.measureText(nota).width + 24 : 0;
    const nombre = recortar(ctx, l.nombre.toUpperCase(), der - xNombre - anchoNota - 40);
    texto(ctx, nombre, xNombre, y, { tam: 44, peso: 700 });
    if (nota) {
      // puntos guía hasta la nota, como en una boleta
      const xFin = xNombre + ctx.measureText(nombre).width + 14;
      ctx.font = `400 44px ${MONO}`;
      let puntos = '';
      while (ctx.measureText(`${puntos}.`).width < der - anchoNota - xFin) puntos += '.';
      texto(ctx, puntos, xFin, y, { tam: 44, color: TINTA_SUAVE });
      texto(ctx, nota, der, y, { tam: 44, peso: 700, alinear: 'right' });
    }
    const detalle = [
      l.nota != null ? estrellas(l.nota) : null,
      l.visitas ? `${l.visitas} ${l.visitas === 1 ? 'visita' : 'visitas'}` : l.resenado ? 'reseñado' : null,
      l.completos ? `${l.completos} ${l.completos === 1 ? 'completo' : 'completos'}` : null,
    ].filter(Boolean).join('  ·  ');
    if (detalle) texto(ctx, detalle, xNombre, y + 48, { tam: 26, color: TINTA_SUAVE });
  }

  const yTot = y0 + TAMANO_TOP * alto - 50;
  lineaPunteada(ctx, yTot);
  const fila = (etiqueta: string, valor: string, y: number) => {
    texto(ctx, etiqueta, izq, y, { tam: 30 });
    texto(ctx, valor, der, y, { tam: 30, peso: 700, alinear: 'right' });
  };
  fila('LOCALES PROBADOS', String(o.localesProbados), yTot + 50);
  fila(`COMPLETOS ${ahora.getFullYear()}`, String(o.completosAnio), yTot + 92);
  lineaPunteada(ctx, yTot + 125);

  codigoBarras(ctx, yTot + 150, top.map((l) => l.nombre).join('|') || 'completometro');
  texto(ctx, '¡GRACIAS POR SU VISITA!', W / 2, yTot + 300, { tam: 30, peso: 700, alinear: 'center' });

  pieEtiqueta(ctx);
  return aArchivo(canvas, 'mi-top-5-completos.png');
}

/** Plantilla en blanco "Mi completo favorito" para rellenar con texto y stickers en Instagram. */
export async function dibujarPlantillaFavorito(ahora = new Date()): Promise<File> {
  const { canvas, ctx } = lienzo();
  papel(ctx);
  const izq = TX + 60;
  const der = TX + TW - 60;

  encabezado(ctx, TY + 90);
  lineaPunteada(ctx, TY + 160);
  texto(ctx, 'ORDEN ESPECIAL', izq, TY + 210, { tam: 28 });
  texto(ctx, fechaBoleta(ahora), der, TY + 210, { tam: 28, alinear: 'right' });
  lineaPunteada(ctx, TY + 240);

  texto(ctx, 'MI COMPLETO', W / 2, TY + 330, { tam: 80, peso: 800, alinear: 'center', fuente: SANS });
  texto(ctx, 'FAVORITO', W / 2, TY + 410, { tam: 80, peso: 800, alinear: 'center', fuente: SANS, color: ROJO });

  // Recuadro para pegar la foto (sticker de foto en Instagram)
  const fx = izq;
  const fy = TY + 450;
  const fw = der - izq;
  const fh = 460;
  ctx.save();
  ctx.strokeStyle = TINTA_SUAVE;
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 12]);
  ctx.beginPath();
  ctx.roundRect(fx, fy, fw, fh, 24);
  ctx.stroke();
  ctx.restore();
  texto(ctx, '📸', W / 2, fy + fh / 2 - 10, { tam: 90, alinear: 'center', fuente: SANS });
  texto(ctx, 'PEGA AQUÍ LA FOTO', W / 2, fy + fh / 2 + 70, { tam: 32, peso: 700, alinear: 'center', color: TINTA_SUAVE });

  // Campos para rellenar
  const campo = (etiqueta: string, y: number, ayuda?: string) => {
    texto(ctx, etiqueta, izq, y, { tam: 38, peso: 700 });
    ctx.font = `700 38px ${MONO}`;
    lineaEscribir(ctx, izq + ctx.measureText(etiqueta).width + 18, der, y + 6);
    if (ayuda) texto(ctx, ayuda, izq, y + 44, { tam: 24, color: TINTA_SUAVE });
  };
  const yc = fy + fh + 80;
  campo('DÓNDE:', yc, '(etiqueta al local con @)');
  campo('PEDIDO:', yc + 110, '(italiano, dinámico, as, chacarero…)');
  texto(ctx, 'NOTA:', izq, yc + 220, { tam: 38, peso: 700 });
  ctx.font = `700 38px ${MONO}`;
  const xNota = izq + ctx.measureText('NOTA:').width + 18;
  lineaEscribir(ctx, xNota, xNota + 110, yc + 226);
  texto(ctx, '/ 10', xNota + 124, yc + 220, { tam: 38, peso: 700 });
  texto(ctx, '★ ★ ★ ★ ★', der, yc + 220, { tam: 38, color: TINTA_SUAVE, alinear: 'right' });
  campo('¿POR QUÉ?', yc + 310);
  lineaEscribir(ctx, izq, der, yc + 375);

  timbre(ctx, TX + TW - 130, fy + 40, 'RECOMENDADO', 'FAV');
  lineaPunteada(ctx, TY + TH - 130);
  texto(ctx, '¡GRACIAS POR SU VISITA!', W / 2, TY + TH - 75, { tam: 30, peso: 700, alinear: 'center' });

  pieEtiqueta(ctx);
  return aArchivo(canvas, 'mi-completo-favorito.png');
}

/**
 * "Mi contador" de completos del año. Pensada también para quien recién empieza a usar la app:
 * si `numero` es null, deja un recuadro en blanco para escribir la cifra en Instagram.
 */
export async function dibujarContador(numero: number | null, ahora = new Date()): Promise<File> {
  const { canvas, ctx } = lienzo();
  papel(ctx);
  const izq = TX + 60;
  const der = TX + TW - 60;
  const anio = ahora.getFullYear();

  encabezado(ctx, TY + 90);
  lineaPunteada(ctx, TY + 160);
  texto(ctx, `BOLETA N° ${anio}-0001`, izq, TY + 210, { tam: 28 });
  texto(ctx, fechaBoleta(ahora), der, TY + 210, { tam: 28, alinear: 'right' });
  lineaPunteada(ctx, TY + 240);

  texto(ctx, 'MI CONTADOR', W / 2, TY + 340, { tam: 88, peso: 800, alinear: 'center', fuente: SANS });
  texto(ctx, 'DE COMPLETOS', W / 2, TY + 400, { tam: 40, peso: 700, alinear: 'center' });
  lineaPunteada(ctx, TY + 450);

  // La cifra (o el recuadro para escribirla)
  const cajaY = TY + 500;
  const cajaH = 420;
  if (numero != null) {
    const cifra = numero.toLocaleString('es-CL');
    let tam = 340;
    do {
      ctx.font = `900 ${tam}px ${SANS}`;
    } while (ctx.measureText(cifra).width > TW - 180 && (tam -= 10) > 80);
    texto(ctx, cifra, W / 2, cajaY + cajaH / 2 + tam * 0.36, { tam, peso: 900, alinear: 'center', fuente: SANS, color: ROJO });
  } else {
    ctx.save();
    ctx.strokeStyle = TINTA_SUAVE;
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.roundRect(izq + 60, cajaY + 20, der - izq - 120, cajaH - 40, 28);
    ctx.stroke();
    ctx.restore();
    texto(ctx, '✍️', W / 2, cajaY + cajaH / 2 - 10, { tam: 80, alinear: 'center', fuente: SANS });
    texto(ctx, 'ESCRIBE AQUÍ TU NÚMERO', W / 2, cajaY + cajaH / 2 + 70, { tam: 30, peso: 700, alinear: 'center', color: TINTA_SUAVE });
  }
  texto(ctx, `COMPLETOS EN ${anio}`, W / 2, cajaY + cajaH + 50, { tam: 44, peso: 800, alinear: 'center', fuente: SANS });
  timbre(ctx, der - 40, cajaY + 40, 'CONTEO', 'OFICIAL', 0.72);

  lineaPunteada(ctx, cajaY + cajaH + 100);
  const fila = (etiqueta: string, y: number, valor?: string) => {
    texto(ctx, etiqueta, izq, y, { tam: 32, peso: 700 });
    if (valor) {
      texto(ctx, valor, der, y, { tam: 32, peso: 700, alinear: 'right' });
    } else {
      ctx.font = `700 32px ${MONO}`;
      lineaEscribir(ctx, izq + ctx.measureText(etiqueta).width + 20, der, y + 6);
    }
  };
  const yFilas = cajaY + cajaH + 165;
  fila(`MI META ${anio}:`, yFilas);
  fila('MI FAVORITO:', yFilas + 70);
  lineaPunteada(ctx, yFilas + 115);

  codigoBarras(ctx, yFilas + 145, `${numero ?? 'blanco'}-${anio}`);
  texto(ctx, '¿Y TÚ, CUÁNTOS LLEVAS?', W / 2, TY + TH - 75, { tam: 32, peso: 700, alinear: 'center' });

  pieEtiqueta(ctx);
  return aArchivo(canvas, numero != null ? `mi-contador-${anio}.png` : `contador-en-blanco-${anio}.png`);
}
