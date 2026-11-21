/**
 * Modelo de datos del Completómetro.
 * Este archivo no depende del navegador ni de IndexedDB: es dominio puro.
 */

/** Versión actual del esquema de un registro. Súbela cuando cambie la forma de los datos. */
// v2: la nota (puntuacion) es del completo y vale para cualquier lugar; se agrega preparado_por.
// v3: tipo de completo (italiano, dinámico…) y si es veggie.
export const VERSION_ESQUEMA = 3;

export type TipoLugar = 'local' | 'otro';
export type OrigenCoordenadas = 'gps' | 'foto_exif' | 'manual';
/** Quién preparó el completo (solo cuando fue en casa u otro lugar). */
export type PreparadoPor = 'yo' | 'otra_persona';
export type EstadoSync = 'pendiente' | 'sincronizado';

/** Lo que el usuario llena (o la app completa sola) al registrar un completo. */
export interface DatosRegistro {
  /** Fecha y hora en ISO 8601 con zona horaria local, ej: 2026-11-21T13:05:00-03:00 */
  fecha_hora: string;
  /** Cuántos completos en este registro (mínimo 1). */
  cantidad: number;
  tipo_lugar: TipoLugar;
  /** Solo si tipo_lugar === 'local'. */
  nombre_local: string | null;
  /** Nota del completo, de 1 a 10 (en cualquier lugar). */
  puntuacion: number | null;
  /** Tipo de completo: id de tipos.ts ("italiano", "dinamico"…) o un texto propio. */
  tipo_completo: string | null;
  /** Si la vienesa era vegetal. */
  veggie: boolean;
  /** Solo si tipo_lugar === 'otro'. */
  preparado_por: PreparadoPor | null;
  /** Nombre de quien lo preparó (opcional, solo si preparado_por === 'otra_persona'). */
  preparado_por_nombre: string | null;
  /** id de una emoción predefinida o personalizada (ver emociones.ts). Es una etiqueta, no una escala. */
  emocion: string | null;
  /** Nivel de hambre de 1 (nada) a 5 (me comería toda la olla). */
  hambre: number | null;
  latitud: number | null;
  longitud: number | null;
  precision_gps_m: number | null;
  origen_coordenadas: OrigenCoordenadas | null;
  /** id de la foto en FotoStorage (la imagen no vive dentro del registro). */
  foto_id: string | null;
  notas: string | null;
}

/** Metadatos de sincronización: invisibles para el usuario. */
export interface MetadatosSync {
  id: string;
  creado_en: string;
  actualizado_en: string;
  /** Borrado lógico: si tiene fecha, el registro está eliminado. */
  eliminado_en: string | null;
  dispositivo_id: string;
  estado_sync: EstadoSync;
  version_esquema: number;
}

export type Registro = DatosRegistro & MetadatosSync;

/** Registro enriquecido con el número acumulado del año (se calcula, no se guarda). */
export type RegistroConAcumulado = Registro & { numero_acumulado_anio: number };

export function registroVacio(ahora: Date = new Date()): DatosRegistro {
  return {
    fecha_hora: aIsoLocal(ahora),
    cantidad: 1,
    tipo_lugar: 'local',
    nombre_local: null,
    puntuacion: null,
    tipo_completo: null,
    veggie: false,
    preparado_por: null,
    preparado_por_nombre: null,
    emocion: null,
    hambre: null,
    latitud: null,
    longitud: null,
    precision_gps_m: null,
    origen_coordenadas: null,
    foto_id: null,
    notas: null,
  };
}

/** Limpia y valida los datos antes de guardarlos. Lanza Error con mensaje en español si algo no cuadra. */
export function normalizarDatos(d: DatosRegistro): DatosRegistro {
  const fecha = new Date(d.fecha_hora);
  if (Number.isNaN(fecha.getTime())) throw new Error('La fecha no es válida.');
  const cantidad = Math.round(Number(d.cantidad));
  if (!Number.isFinite(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser 1 o más.');
  if (cantidad > 50) throw new Error('¿Más de 50 completos de una vez? Revisa la cantidad.');

  const esLocal = d.tipo_lugar === 'local';
  const nombre = esLocal ? (d.nombre_local ?? '').trim().replace(/\s+/g, ' ') : '';
  const puntuacion = d.puntuacion != null ? Math.round(d.puntuacion) : null;
  if (puntuacion != null && (puntuacion < 1 || puntuacion > 10)) throw new Error('La nota va de 1 a 10.');
  const preparado_por = !esLocal && (d.preparado_por === 'yo' || d.preparado_por === 'otra_persona') ? d.preparado_por : null;
  const nombrePrep = preparado_por === 'otra_persona' ? (d.preparado_por_nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 60) : '';
  let hambre = d.hambre != null ? Math.round(d.hambre) : null;
  if (hambre != null && (hambre < 1 || hambre > 5)) hambre = null;

  const tieneCoords = d.latitud != null && d.longitud != null &&
    Number.isFinite(d.latitud) && Number.isFinite(d.longitud);

  return {
    fecha_hora: d.fecha_hora,
    cantidad,
    tipo_lugar: esLocal ? 'local' : 'otro',
    nombre_local: nombre || null,
    puntuacion,
    tipo_completo: d.tipo_completo?.trim() ? d.tipo_completo.trim().replace(/\s+/g, ' ').slice(0, 40) : null,
    veggie: d.veggie === true,
    preparado_por,
    preparado_por_nombre: nombrePrep || null,
    emocion: d.emocion || null,
    hambre,
    latitud: tieneCoords ? d.latitud : null,
    longitud: tieneCoords ? d.longitud : null,
    precision_gps_m: tieneCoords && d.precision_gps_m != null ? Math.round(d.precision_gps_m) : null,
    origen_coordenadas: tieneCoords ? d.origen_coordenadas ?? 'manual' : null,
    foto_id: d.foto_id || null,
    notas: d.notas?.trim() ? d.notas.trim() : null,
  };
}

/** Texto corto del lugar: "Dominó", "Hecho por mí", "Hecho por mi mamá", "En casa u otro lugar". */
export function describirLugar(r: Pick<DatosRegistro, 'tipo_lugar' | 'nombre_local' | 'preparado_por' | 'preparado_por_nombre'>): string {
  if (r.tipo_lugar === 'local') return r.nombre_local ?? 'Local';
  if (r.preparado_por === 'yo') return 'Hecho por mí';
  if (r.preparado_por === 'otra_persona') return r.preparado_por_nombre ? `Hecho por ${r.preparado_por_nombre}` : 'Hecho por otra persona';
  return 'En casa u otro lugar';
}

/**
 * Lleva un registro de una versión anterior del esquema a la actual (rellena campos nuevos).
 * Se usa en la migración de IndexedDB y al importar respaldos antiguos. No cambia actualizado_en.
 */
export function migrarRegistro(r: Registro): Registro {
  const v = Number(r.version_esquema) || 1;
  if (v >= VERSION_ESQUEMA) return r;
  return {
    ...r,
    preparado_por: r.preparado_por ?? null,
    preparado_por_nombre: r.preparado_por_nombre ?? null,
    tipo_completo: r.tipo_completo ?? null,
    veggie: r.veggie === true,
    version_esquema: VERSION_ESQUEMA,
  };
}

/** Convierte una fecha a ISO 8601 con el desfase de la zona horaria local (no en UTC). */
export function aIsoLocal(fecha: Date): string {
  const p = (n: number) => String(Math.abs(Math.trunc(n))).padStart(2, '0');
  const offset = -fecha.getTimezoneOffset();
  const signo = offset >= 0 ? '+' : '-';
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}` +
    `T${p(fecha.getHours())}:${p(fecha.getMinutes())}:${p(fecha.getSeconds())}` +
    `${signo}${p(offset / 60)}:${p(offset % 60)}`;
}

/** UUID v4 generado en el cliente (con respaldo si crypto.randomUUID no existe, ej. HTTP en iOS antiguo). */
export function nuevoId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
