/** Formatos de texto para la interfaz (es-CL). */
import { claveDia, sumarDias } from '../dominio/fechas';

export const entero = (n: number) => n.toLocaleString('es-CL');
export const decimal = (n: number, d = 1) => n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });

export function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

/** "hoy 13:05", "ayer 21:40", "lun 16 nov, 13:05", "16 nov 2025, 13:05". */
export function fechaRelativa(iso: string, ahora = new Date()): string {
  const f = new Date(iso);
  const dia = claveDia(f);
  if (dia === claveDia(ahora)) return `hoy ${hora(iso)}`;
  if (dia === claveDia(sumarDias(ahora, -1))) return `ayer ${hora(iso)}`;
  const opciones: Intl.DateTimeFormatOptions = f.getFullYear() === ahora.getFullYear()
    ? { weekday: 'short', day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return `${f.toLocaleDateString('es-CL', opciones)}, ${hora(iso)}`;
}

export function plural(n: number, uno: string, varios: string) {
  return `${entero(n)} ${n === 1 ? uno : varios}`;
}

/** Valor para <input type="datetime-local"> en hora local. */
export function aInputFecha(iso: string): string {
  const f = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(f.getHours())}:${p(f.getMinutes())}`;
}
