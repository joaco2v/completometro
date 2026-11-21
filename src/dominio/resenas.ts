/**
 * Reseñas de locales: calificar un local SIN registrar un completo.
 * Cuentan para el ranking "Mi top 5", pero no suman al contador de completos.
 * Una reseña por local (si calificas de nuevo, se actualiza la misma).
 */
import type { MetadatosSync } from './modelo';

export interface DatosResena {
  nombre_local: string;
  /** Nota del local, de 1 a 10. */
  puntuacion: number;
  latitud: number | null;
  longitud: number | null;
  comentario: string | null;
  /** Cuándo se calificó (ISO con zona horaria). */
  fecha: string;
}

/** Usa los mismos metadatos de sincronización que los registros (UUID, borrado lógico, gana el último cambio). */
export type ResenaLocal = DatosResena & MetadatosSync;

export function normalizarResena(d: DatosResena): DatosResena {
  const nombre = (d.nombre_local ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!nombre) throw new Error('Escribe el nombre del local.');
  const puntuacion = Math.round(Number(d.puntuacion));
  if (!(puntuacion >= 1 && puntuacion <= 10)) throw new Error('La nota va de 1 a 10.');
  if (Number.isNaN(new Date(d.fecha).getTime())) throw new Error('La fecha no es válida.');
  const coords = d.latitud != null && d.longitud != null && Number.isFinite(d.latitud) && Number.isFinite(d.longitud);
  return {
    nombre_local: nombre,
    puntuacion,
    latitud: coords ? d.latitud : null,
    longitud: coords ? d.longitud : null,
    comentario: d.comentario?.trim() ? d.comentario.trim().slice(0, 300) : null,
    fecha: d.fecha,
  };
}
