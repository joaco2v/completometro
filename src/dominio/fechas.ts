/** Utilidades de fechas en hora local del dispositivo. Semanas de lunes a domingo. */

const p2 = (n: number) => String(n).padStart(2, '0');

/** "2026-11-21" en hora local. */
export function claveDia(f: Date): string {
  return `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`;
}

/** "2026-11" en hora local. */
export function claveMes(f: Date): string {
  return `${f.getFullYear()}-${p2(f.getMonth() + 1)}`;
}

export function inicioDia(f: Date): Date {
  return new Date(f.getFullYear(), f.getMonth(), f.getDate());
}

export function sumarDias(f: Date, dias: number): Date {
  return new Date(f.getFullYear(), f.getMonth(), f.getDate() + dias, f.getHours(), f.getMinutes(), f.getSeconds());
}

/** Lunes 00:00 de la semana de la fecha. */
export function inicioSemana(f: Date): Date {
  const d = inicioDia(f);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  return sumarDias(d, -dow);
}

export function inicioMes(f: Date): Date {
  return new Date(f.getFullYear(), f.getMonth(), 1);
}

/** Clave de la semana: fecha del lunes, ej "2026-11-16". */
export function claveSemana(f: Date): string {
  return claveDia(inicioSemana(f));
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nombreMes(mes0: number, largo = false): string {
  return (largo ? MESES_LARGOS : MESES)[mes0] ?? '';
}

/** Etiqueta corta para una clave de mes ("2026-11" → "nov") o semana ("2026-11-16" → "16 nov"). */
export function etiquetaPeriodo(clave: string): string {
  const [, m, d] = clave.split('-');
  const mes = nombreMes(Number(m) - 1);
  return d ? `${Number(d)} ${mes}` : mes;
}

export function mismoDia(a: Date, b: Date): boolean {
  return claveDia(a) === claveDia(b);
}
