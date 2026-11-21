/**
 * Respaldo automático en una carpeta privada en la nube (Google Drive, carpeta "appDataFolder").
 *
 * En la nube quedan:
 *   completometro-datos.json   todos los registros y ajustes (sin fotos incrustadas)
 *   foto-<id>.jpg              una por foto; se suben una sola vez
 *
 * Cada sincronización:
 *   1. Baja el JSON de la nube (si existe) y lo junta con lo local: gana el último cambio por registro.
 *      Así, en un teléfono nuevo, "conectar" restaura todo; y con dos teléfonos, ambos quedan al día.
 *   2. Sube las fotos que falten.
 *   3. Sube el JSON combinado.
 */
import { extension } from './csv';
import type { AlmacenNube } from './contratos';
import { aplicarRespaldo, reunir, validarRespaldo, type Dependencias, type ResultadoImportacion } from './respaldo';

export const ARCHIVO_DATOS = 'completometro-datos.json';
export const nombreFotoNube = (id: string, tipo: string) => `foto-${id}.${extension(tipo)}`;

export interface ResultadoSincronizacion {
  traidos: ResultadoImportacion;
  fotosSubidas: number;
  registros: number;
}

export async function sincronizarConNube(nube: AlmacenNube, d: Dependencias): Promise<ResultadoSincronizacion> {
  const archivos = await nube.listar();
  const porNombre = new Map(archivos.map((a) => [a.nombre, a]));
  const datosRemotos = porNombre.get(ARCHIVO_DATOS);

  let traidos: ResultadoImportacion = { nuevos: 0, actualizados: 0, ignorados: 0, fotos: 0, resenas: 0 };
  if (datosRemotos) {
    const remoto = validarRespaldo(JSON.parse(await nube.descargarTexto(datosRemotos.id)));
    traidos = await aplicarRespaldo(
      remoto,
      async (meta) => {
        const a = porNombre.get(nombreFotoNube(meta.id, meta.tipo));
        return a ? nube.descargarBlob(a.id, meta.tipo) : null;
      },
      d,
    );
  }

  const { respaldo, fotos } = await reunir(d, false);
  let fotosSubidas = 0;
  for (const f of fotos) {
    const nombre = nombreFotoNube(f.id, f.tipo);
    if (porNombre.has(nombre)) continue;
    await nube.crear(nombre, f.blob);
    fotosSubidas++;
  }
  respaldo.fotos = respaldo.fotos.map((f) => ({ ...f, archivo: nombreFotoNube(f.id, f.tipo) }));

  const contenido = new Blob([JSON.stringify(respaldo)], { type: 'application/json' });
  if (datosRemotos) await nube.actualizar(datosRemotos.id, contenido);
  else await nube.crear(ARCHIVO_DATOS, contenido);

  return { traidos, fotosSubidas, registros: respaldo.registros.length };
}
