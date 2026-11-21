/**
 * Punto único donde se elige la implementación de datos.
 * Las pantallas importan `datos` desde aquí y nunca tocan IndexedDB directamente.
 *
 * Hoy: modo local. Cuando exista backend (config.modo === 'remoto'), aquí se
 * envolverá el repositorio local con SyncRepository (ver remoto/RemoteRepository.ts).
 */
import { config } from '../config';
import { abrirDB } from './local/db';
import { LocalAjustes } from './local/LocalAjustes';
import { LocalFotoStorage } from './local/LocalFotoStorage';
import { LocalRepository } from './local/LocalRepository';

export function crearDatos(nombreDb?: string) {
  const db = () => abrirDB(nombreDb);
  const ajustes = new LocalAjustes(db);
  const repo = new LocalRepository({
    db,
    dispositivoId: async () => (await ajustes.leer()).dispositivo_id,
    alEscribir: async () => {
      const a = await ajustes.leer();
      await ajustes.guardar({ cambiosDesdeRespaldo: a.cambiosDesdeRespaldo + 1 });
    },
  });
  const fotos = new LocalFotoStorage(db);
  return { repo, fotos, ajustes, outbox: repo, modo: config.modo };
}

export const datos = crearDatos();
export type Datos = ReturnType<typeof crearDatos>;
