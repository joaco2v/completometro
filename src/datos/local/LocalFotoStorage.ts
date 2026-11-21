import type { IDBPDatabase } from 'idb';
import { aIsoLocal, nuevoId } from '../../dominio/modelo';
import type { FotoStorage } from '../contratos';
import type { CompletometroDB } from './db';

/** Fotos guardadas en IndexedDB como ArrayBuffer + tipo MIME. */
export class LocalFotoStorage implements FotoStorage {
  constructor(private db: () => Promise<IDBPDatabase<CompletometroDB>>) {}

  async guardar(blob: Blob, id = nuevoId()) {
    const datos = await blob.arrayBuffer();
    await (await this.db()).put('fotos', { id, tipo: blob.type || 'image/jpeg', datos, creado_en: aIsoLocal(new Date()) });
    return id;
  }

  async obtener(id: string) {
    const fila = await (await this.db()).get('fotos', id);
    if (!fila) return undefined;
    return { id: fila.id, tipo: fila.tipo, blob: new Blob([fila.datos], { type: fila.tipo }) };
  }

  async eliminar(id: string) {
    await (await this.db()).delete('fotos', id);
  }

  async listarIds() {
    return (await this.db()).getAllKeys('fotos');
  }
}
