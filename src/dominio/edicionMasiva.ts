/**
 * Edición de varios registros a la vez. Función pura.
 *
 * Cada campo de EdicionMasiva es opcional: si no viene, ese dato NO se toca en ningún registro.
 * `null` significa "quitar" (dejar vacío).
 */
import { aIsoLocal, normalizarDatos, type DatosRegistro, type PreparadoPor, type TipoLugar } from './modelo';

export interface EdicionMasiva {
  cantidad?: number;
  lugar?: {
    tipo_lugar: TipoLugar;
    /** Solo para 'local'. Vacío o ausente = conservar el nombre que ya tenía cada registro. */
    nombre_local?: string | null;
    /** Si se eligió un local sugerido, su ubicación se aplica a todos. */
    latitud?: number | null;
    longitud?: number | null;
  };
  puntuacion?: number | null;
  emocion?: string | null;
  hambre?: number | null;
  /** Solo se aplica a los registros que quedan "en casa u otro lugar". */
  preparado?: { preparado_por: PreparadoPor | null; preparado_por_nombre?: string | null };
  notas?: string | null;
  /** "2026-11-20": mueve el registro a ese día manteniendo su hora. */
  fecha?: string;
}

/** ¿La edición cambia algo? */
export function edicionVacia(e: EdicionMasiva): boolean {
  return Object.values(e).every((v) => v === undefined);
}

/** Aplica la edición a un registro y valida el resultado (lanza Error si algo no cuadra). */
export function aplicarEdicionMasiva(r: DatosRegistro, e: EdicionMasiva): DatosRegistro {
  const d: DatosRegistro = { ...r };
  if (e.cantidad !== undefined) d.cantidad = e.cantidad;
  if (e.lugar) {
    d.tipo_lugar = e.lugar.tipo_lugar;
    const nombre = e.lugar.nombre_local?.trim();
    if (e.lugar.tipo_lugar === 'local' && nombre) d.nombre_local = nombre;
    if (e.lugar.latitud != null && e.lugar.longitud != null) {
      d.latitud = e.lugar.latitud;
      d.longitud = e.lugar.longitud;
      d.precision_gps_m = null;
      d.origen_coordenadas = 'manual';
    }
  }
  if (e.puntuacion !== undefined) d.puntuacion = e.puntuacion;
  if (e.emocion !== undefined) d.emocion = e.emocion;
  if (e.hambre !== undefined) d.hambre = e.hambre;
  if (e.preparado) {
    d.preparado_por = e.preparado.preparado_por;
    d.preparado_por_nombre = e.preparado.preparado_por_nombre ?? null;
  }
  if (e.notas !== undefined) d.notas = e.notas;
  if (e.fecha) {
    const [y, m, dia] = e.fecha.split('-').map(Number);
    if (!y || !m || !dia) throw new Error('La fecha no es válida.');
    const antes = new Date(r.fecha_hora);
    const nueva = new Date(y, m - 1, dia, antes.getHours(), antes.getMinutes(), antes.getSeconds());
    if (nueva.getTime() > Date.now() + 60_000) throw new Error('La fecha no puede quedar en el futuro.');
    d.fecha_hora = aIsoLocal(nueva);
  }
  return normalizarDatos(d);
}
