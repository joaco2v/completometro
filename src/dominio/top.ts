/**
 * "Mi top 5" de locales. Funciones puras.
 *
 * Automático: ordena por NOTA PROMEDIO (notas de tus completos en el local + tus reseñas del local);
 * si empatan, gana el que tiene más visitas; luego más completos; luego por nombre.
 * Personalizado: el orden lo eliges tú (útil cuando aún hay pocos datos).
 */
import type { Registro } from './modelo';
import type { ResenaLocal } from './resenas';
import { claveLocal } from './metricas';

export interface LocalTop {
  /** Clave normalizada ("domino") para agrupar variantes del nombre. */
  clave: string;
  nombre: string;
  /** Promedio de todas las notas (completos + reseñas). null si nunca le pusiste nota. */
  nota: number | null;
  /** Veces que registraste completos ahí. */
  visitas: number;
  completos: number;
  /** Cuántas notas se promediaron. */
  notas: number;
  /** Tiene una reseña sin completo. */
  resenado: boolean;
  latitud: number | null;
  longitud: number | null;
}

/** Junta registros (solo locales) y reseñas por local. */
export function locales(registros: readonly Registro[], resenas: readonly ResenaLocal[]): LocalTop[] {
  const grupos = new Map<string, LocalTop & { suma: number; ultima: number }>();
  const grupo = (nombre: string, t: number) => {
    const k = claveLocal(nombre);
    let g = grupos.get(k);
    if (!g) {
      g = { clave: k, nombre, nota: null, visitas: 0, completos: 0, notas: 0, resenado: false, latitud: null, longitud: null, suma: 0, ultima: t };
      grupos.set(k, g);
    }
    if (t >= g.ultima) {
      g.ultima = t;
      g.nombre = nombre; // se muestra el nombre escrito más recientemente
    }
    return g;
  };
  for (const r of registros) {
    if (r.eliminado_en || r.tipo_lugar !== 'local' || !r.nombre_local?.trim()) continue;
    const g = grupo(r.nombre_local.trim(), new Date(r.fecha_hora).getTime());
    g.visitas++;
    g.completos += r.cantidad;
    if (r.puntuacion != null) {
      g.suma += r.puntuacion;
      g.notas++;
    }
    if (r.latitud != null && r.longitud != null && g.latitud == null) {
      g.latitud = r.latitud;
      g.longitud = r.longitud;
    }
  }
  for (const s of resenas) {
    if (s.eliminado_en || !s.nombre_local?.trim()) continue;
    const g = grupo(s.nombre_local.trim(), new Date(s.fecha).getTime());
    g.suma += s.puntuacion;
    g.notas++;
    g.resenado = true;
    if (s.latitud != null && s.longitud != null) {
      g.latitud = s.latitud;
      g.longitud = s.longitud;
    }
  }
  return [...grupos.values()].map(({ suma, ultima: _u, ...g }) => ({ ...g, nota: g.notas ? suma / g.notas : null }));
}

/** Ranking automático: solo locales con nota. */
export function rankingPorNota(registros: readonly Registro[], resenas: readonly ResenaLocal[]): LocalTop[] {
  return locales(registros, resenas)
    .filter((l) => l.nota != null)
    .sort((a, b) =>
      (b.nota as number) - (a.nota as number) ||
      b.visitas - a.visitas ||
      b.completos - a.completos ||
      a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Top personalizado: toma los nombres en el orden elegido y les agrega sus datos (si existen).
 * Un nombre sin datos igual aparece (por ejemplo, un local que aún no registras).
 */
export function topPersonalizado(nombres: readonly string[], registros: readonly Registro[], resenas: readonly ResenaLocal[]): LocalTop[] {
  const porClave = new Map(locales(registros, resenas).map((l) => [l.clave, l]));
  const vistos = new Set<string>();
  const top: LocalTop[] = [];
  for (const n of nombres) {
    const nombre = n.trim();
    const k = claveLocal(nombre);
    if (!nombre || vistos.has(k)) continue;
    vistos.add(k);
    top.push(porClave.get(k) ?? { clave: k, nombre, nota: null, visitas: 0, completos: 0, notas: 0, resenado: false, latitud: null, longitud: null });
  }
  return top.slice(0, TAMANO_TOP);
}

export const TAMANO_TOP = 5;

/** Mueve un elemento de la lista (para subir/bajar en el top personalizado). */
export function mover<T>(lista: readonly T[], desde: number, hasta: number): T[] {
  if (hasta < 0 || hasta >= lista.length || desde === hasta) return [...lista];
  const copia = [...lista];
  const [x] = copia.splice(desde, 1);
  copia.splice(hasta, 0, x);
  return copia;
}

/**
 * Puntos para el mapa de calor: cada completo con ubicación pesa según su cantidad.
 * Agrupa en celdas de ~100 m para no dibujar miles de puntos encima.
 */
export function puntosCalor(registros: readonly Registro[], celdaGrados = 0.001): { latitud: number; longitud: number; peso: number }[] {
  const celdas = new Map<string, { lat: number; lon: number; peso: number }>();
  for (const r of registros) {
    if (r.eliminado_en || r.latitud == null || r.longitud == null) continue;
    const k = `${Math.round(r.latitud / celdaGrados)}|${Math.round(r.longitud / celdaGrados)}`;
    const c = celdas.get(k) ?? { lat: 0, lon: 0, peso: 0 };
    // promedio ponderado de la posición dentro de la celda
    c.lat = (c.lat * c.peso + r.latitud * r.cantidad) / (c.peso + r.cantidad);
    c.lon = (c.lon * c.peso + r.longitud * r.cantidad) / (c.peso + r.cantidad);
    c.peso += r.cantidad;
    celdas.set(k, c);
  }
  return [...celdas.values()].map((c) => ({ latitud: c.lat, longitud: c.lon, peso: c.peso }));
}
