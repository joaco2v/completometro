/**
 * Generación del CSV para Power BI / Excel. Funciones puras (testeables).
 * - UTF-8 con BOM (Excel y Power BI reconocen tildes y emojis).
 * - Separador coma, decimales con punto, fechas ISO 8601.
 * - Latitud y longitud en columnas separadas (para el visual de mapa).
 * - Sin metadatos internos de sincronización.
 * - La emoción va como texto: no tiene valor numérico porque no hay emociones "mejores" que otras.
 */
import { buscarEmocion, nivelHambre, type Emocion } from '../dominio/emociones';
import type { RegistroConAcumulado } from '../dominio/modelo';
import type { ResenaLocal } from '../dominio/resenas';
import { buscarTipo } from '../dominio/tipos';
import { claveDia, claveSemana } from '../dominio/fechas';

export const COLUMNAS_CSV = [
  'id', 'fecha_hora', 'fecha', 'hora', 'anio', 'mes', 'semana_inicio', 'numero_acumulado_anio', 'cantidad',
  'tipo_lugar', 'nombre_local', 'puntuacion', 'tipo_completo', 'veggie', 'preparado_por', 'preparado_por_nombre', 'emocion', 'emocion_emoji', 'hambre_nivel', 'hambre_texto',
  'latitud', 'longitud', 'precision_gps_m', 'origen_coordenadas', 'foto_archivo', 'notas',
] as const;

export const BOM = '﻿';

const ETIQUETA_LUGAR = { local: 'Local establecido', otro: 'En casa u otro lugar' } as const;
const ETIQUETA_PREPARADO = { yo: 'Yo', otra_persona: 'Otra persona' } as const;

/** Escapa un valor según RFC 4180 y neutraliza fórmulas (=, +, -, @) en textos libres. */
export function celda(v: unknown, textoLibre = false): string {
  if (v == null) return '';
  let s = String(v);
  if (textoLibre && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const numero = (n: number | null, decimales?: number) =>
  n == null || !Number.isFinite(n) ? '' : decimales != null ? n.toFixed(decimales) : String(n);

export function filaCsv(r: RegistroConAcumulado, personalizadas: readonly Emocion[], fotoArchivo: string | null): string[] {
  const f = new Date(r.fecha_hora);
  const emocion = buscarEmocion(r.emocion, personalizadas);
  const hambre = nivelHambre(r.hambre);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return [
    celda(r.id),
    celda(r.fecha_hora),
    claveDia(f),
    `${p2(f.getHours())}:${p2(f.getMinutes())}`,
    String(f.getFullYear()),
    String(f.getMonth() + 1),
    claveSemana(f),
    String(r.numero_acumulado_anio),
    String(r.cantidad),
    ETIQUETA_LUGAR[r.tipo_lugar],
    celda(r.nombre_local, true),
    numero(r.puntuacion),
    celda(buscarTipo(r.tipo_completo)?.nombre, true),
    r.veggie ? 'Sí' : 'No',
    r.preparado_por ? ETIQUETA_PREPARADO[r.preparado_por] : '',
    celda(r.preparado_por_nombre, true),
    celda(emocion?.nombre, true),
    celda(emocion?.emoji),
    numero(r.hambre),
    celda(hambre?.nombre),
    numero(r.latitud, 6),
    numero(r.longitud, 6),
    numero(r.precision_gps_m),
    celda(r.origen_coordenadas),
    celda(fotoArchivo),
    celda(r.notas, true),
  ];
}

export function generarCsv(
  registros: readonly RegistroConAcumulado[],
  personalizadas: readonly Emocion[] = [],
  fotoArchivo: (r: RegistroConAcumulado) => string | null = () => null,
): string {
  const lineas = [COLUMNAS_CSV.join(','), ...registros.map((r) => filaCsv(r, personalizadas, fotoArchivo(r)).join(','))];
  return BOM + lineas.join('\r\n') + '\r\n';
}

export const COLUMNAS_CSV_RESENAS = ['id', 'fecha', 'nombre_local', 'puntuacion', 'latitud', 'longitud', 'comentario'] as const;

/** CSV de reseñas de locales (calificados sin registrar un completo). */
export function generarCsvResenas(resenas: readonly ResenaLocal[]): string {
  const filas = resenas.map((s) => [
    celda(s.id),
    celda(s.fecha),
    celda(s.nombre_local, true),
    numero(s.puntuacion),
    numero(s.latitud, 6),
    numero(s.longitud, 6),
    celda(s.comentario, true),
  ].join(','));
  return BOM + [COLUMNAS_CSV_RESENAS.join(','), ...filas].join('\r\n') + '\r\n';
}

/** Extensión de archivo para un tipo MIME de imagen. */
export function extension(tipo: string): string {
  if (tipo.includes('png')) return 'png';
  if (tipo.includes('webp')) return 'webp';
  if (tipo.includes('heic')) return 'heic';
  return 'jpg';
}
