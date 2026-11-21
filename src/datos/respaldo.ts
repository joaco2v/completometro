/**
 * Exportación e importación.
 *
 * Dos formatos:
 *  1. ZIP "para Power BI": completos.csv + completos.json + fotos/ + LEEME.txt
 *  2. JSON "respaldo de un solo archivo": todo, con las fotos incrustadas (base64).
 *     Se puede compartir con el menú del teléfono (Drive, WhatsApp, correo, Archivos de iCloud),
 *     cosa que Chrome no permite con archivos .zip.
 * Importar acepta cualquiera de los dos y evita duplicados por id (gana el último cambio).
 */
import { calcularAcumulados } from '../dominio/acumulado';
import { resolverConflicto } from '../dominio/conflictos';
import { aIsoLocal, VERSION_ESQUEMA, type Registro } from '../dominio/modelo';
import type { Emocion } from '../dominio/emociones';
import type { ContadoresIniciales } from '../dominio/acumulado';
import { claveDia } from '../dominio/fechas';
import type { AjustesStore, FotoStorage, RegistroRepository } from './contratos';
import { extension, generarCsv } from './csv';

export const FORMATO = 'completometro-respaldo';

export interface FotoRespaldo {
  id: string;
  tipo: string;
  /** Nombre dentro de la carpeta fotos/ del ZIP. */
  archivo?: string;
  /** Foto incrustada (solo en el respaldo de un archivo). */
  base64?: string;
}

export interface ArchivoRespaldo {
  formato: typeof FORMATO;
  version_formato: 1;
  version_esquema: number;
  exportado_en: string;
  ajustes: { contadoresIniciales: ContadoresIniciales; emocionesPersonalizadas: Emocion[] };
  /** Incluye los eliminados (borrado lógico) para que el borrado viaje al otro teléfono. */
  registros: Registro[];
  fotos: FotoRespaldo[];
}

export interface Dependencias {
  repo: RegistroRepository;
  fotos: FotoStorage;
  ajustes: AjustesStore;
}

export interface ResultadoImportacion {
  nuevos: number;
  actualizados: number;
  ignorados: number;
  fotos: number;
}

// ---------- utilidades base64 (funcionan en navegador y en Node) ----------

export function bufferABase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ABlob(b64: string, tipo: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

// ---------- exportar ----------

const nombreFotoDe = (r: Pick<Registro, 'id'>, tipo: string) => `${r.id}.${extension(tipo)}`;

/** Arma el respaldo completo. Con `embeber`, las fotos van dentro del JSON (base64). */
export async function reunir(d: Dependencias, embeber: boolean) {
  const [registros, ajustes] = await Promise.all([d.repo.listar({ incluirEliminados: true }), d.ajustes.leer()]);
  const fotos: (FotoRespaldo & { blob: Blob })[] = [];
  const archivoPorRegistro = new Map<string, string>();
  for (const r of registros) {
    if (!r.foto_id || r.eliminado_en) continue;
    const f = await d.fotos.obtener(r.foto_id);
    if (!f) continue;
    const archivo = nombreFotoDe(r, f.tipo);
    archivoPorRegistro.set(r.id, archivo);
    fotos.push({
      id: f.id,
      tipo: f.tipo,
      archivo,
      blob: f.blob,
      ...(embeber ? { base64: bufferABase64(await f.blob.arrayBuffer()) } : {}),
    });
  }
  const respaldo: ArchivoRespaldo = {
    formato: FORMATO,
    version_formato: 1,
    version_esquema: VERSION_ESQUEMA,
    exportado_en: aIsoLocal(new Date()),
    ajustes: { contadoresIniciales: ajustes.contadoresIniciales, emocionesPersonalizadas: ajustes.emocionesPersonalizadas },
    registros,
    fotos: fotos.map(({ blob: _b, ...f }) => f),
  };
  return { respaldo, fotos, archivoPorRegistro, ajustes };
}

const LEEME = `COMPLETÓMETRO – Exportación de datos

completos.csv   Una fila por registro. UTF-8, separador coma, decimales con punto.
                Para Power BI: Obtener datos > Texto/CSV > completos.csv
                El visual de mapa usa las columnas "latitud" y "longitud".
completos.json  Respaldo completo (incluye metadatos). Sirve para "Importar" en la app.
fotos/          Imágenes. La columna foto_archivo del CSV indica el nombre de cada una.
`;

/** ZIP para Power BI / Excel (y también restaurable con "Importar"). */
export async function exportarZip(d: Dependencias): Promise<File> {
  const { default: JSZip } = await import('jszip');
  const { respaldo, fotos, archivoPorRegistro, ajustes } = await reunir(d, false);
  const zip = new JSZip();
  const conAcumulado = calcularAcumulados(respaldo.registros, ajustes.contadoresIniciales);
  zip.file('completos.csv', generarCsv(conAcumulado, ajustes.emocionesPersonalizadas, (r) => archivoPorRegistro.get(r.id) ?? null));
  zip.file('completos.json', JSON.stringify(respaldo, null, 2));
  zip.file('LEEME.txt', LEEME);
  const carpeta = zip.folder('fotos')!;
  for (const f of fotos) carpeta.file(f.archivo!, f.blob);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return new File([blob], `completometro-${claveDia(new Date())}.zip`, { type: 'application/zip' });
}

/** Respaldo de un solo archivo .json con las fotos incluidas. */
export async function exportarRespaldoJson(d: Dependencias): Promise<File> {
  const { respaldo } = await reunir(d, true);
  return new File([JSON.stringify(respaldo)], `completometro-respaldo-${claveDia(new Date())}.json`, { type: 'application/json' });
}

// ---------- importar ----------

export function validarRespaldo(x: unknown): ArchivoRespaldo {
  const r = x as Partial<ArchivoRespaldo> | null;
  if (!r || r.formato !== FORMATO || !Array.isArray(r.registros)) {
    throw new Error('Este archivo no parece un respaldo del Completómetro.');
  }
  if ((r.version_esquema ?? 1) > VERSION_ESQUEMA) {
    throw new Error('Este respaldo viene de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.');
  }
  const validos = r.registros.filter((g) => g && typeof g.id === 'string' && typeof g.fecha_hora === 'string' && typeof g.actualizado_en === 'string');
  return {
    ...(r as ArchivoRespaldo),
    registros: validos.map((g) => ({ ...g, cantidad: Number(g.cantidad) || 1 })),
    fotos: Array.isArray(r.fotos) ? r.fotos : [],
    ajustes: { contadoresIniciales: r.ajustes?.contadoresIniciales ?? {}, emocionesPersonalizadas: r.ajustes?.emocionesPersonalizadas ?? [] },
  };
}

async function esZip(archivo: Blob): Promise<boolean> {
  const cab = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
  return cab[0] === 0x50 && cab[1] === 0x4b; // "PK"
}

/** Restaura desde un ZIP exportado o un respaldo .json. */
export async function importarArchivo(archivo: Blob, d: Dependencias): Promise<ResultadoImportacion> {
  let respaldo: ArchivoRespaldo;
  let leerFotoZip: ((nombre: string, tipo: string) => Promise<Blob | null>) | null = null;

  if (await esZip(archivo)) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(archivo);
    const json = zip.file('completos.json') ?? zip.file(/(^|\/)completos\.json$/)[0];
    if (!json) throw new Error('El ZIP no trae completos.json. ¿Es una exportación del Completómetro?');
    respaldo = validarRespaldo(JSON.parse(await json.async('string')));
    leerFotoZip = async (nombre, tipo) => {
      const f = zip.file(`fotos/${nombre}`) ?? zip.file(new RegExp(`(^|/)fotos/${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))[0];
      return f ? new Blob([await f.async('arraybuffer')], { type: tipo }) : null;
    };
  } else {
    let datos: unknown;
    try {
      datos = JSON.parse(await archivo.text());
    } catch {
      throw new Error('No pude leer el archivo. Elige el .zip o .json que exportó el Completómetro.');
    }
    respaldo = validarRespaldo(datos);
  }

  return aplicarRespaldo(respaldo, async (meta) => (meta.archivo && leerFotoZip ? leerFotoZip(meta.archivo, meta.tipo) : null), d);
}

/**
 * Integra un respaldo ya leído: fotos que falten, registros (gana el último cambio) y ajustes.
 * `leerFoto` trae una foto que no venga incrustada (desde el ZIP, Google Drive, etc.).
 */
export async function aplicarRespaldo(
  respaldo: ArchivoRespaldo,
  leerFoto: (meta: FotoRespaldo) => Promise<Blob | null>,
  d: Dependencias,
): Promise<ResultadoImportacion> {
  // Fotos: solo las de registros que realmente entran (nuevos o más recientes) y que no tengamos.
  const fotosPorId = new Map(respaldo.fotos.map((f) => [f.id, f]));
  const existentes = new Set(await d.fotos.listarIds());
  let fotos = 0;
  for (const r of respaldo.registros) {
    if (!r.foto_id || existentes.has(r.foto_id) || r.eliminado_en) continue;
    if (resolverConflicto(await d.repo.obtener(r.id), r) === 'ignora') continue;
    const meta = fotosPorId.get(r.foto_id);
    if (!meta) continue;
    const blob = meta.base64 ? base64ABlob(meta.base64, meta.tipo) : await leerFoto(meta).catch(() => null);
    if (!blob) continue;
    await d.fotos.guardar(blob, meta.id);
    existentes.add(meta.id);
    fotos++;
  }

  const resultado = await d.repo.fusionar(respaldo.registros);

  // Ajustes: completa contadores iniciales que falten y suma emociones personalizadas nuevas.
  const actuales = await d.ajustes.leer();
  const contadores = { ...actuales.contadoresIniciales };
  for (const [anio, v] of Object.entries(respaldo.ajustes.contadoresIniciales)) if (!contadores[anio]) contadores[anio] = v;
  const ids = new Set(actuales.emocionesPersonalizadas.map((e) => e.id));
  const emociones = [...actuales.emocionesPersonalizadas, ...respaldo.ajustes.emocionesPersonalizadas.filter((e) => e?.id && !ids.has(e.id))];
  await d.ajustes.guardar({ contadoresIniciales: contadores, emocionesPersonalizadas: emociones });

  return { ...resultado, fotos };
}
