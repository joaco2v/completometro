/**
 * Base de datos IndexedDB con migraciones versionadas.
 *
 * REGLA: nunca modifiques una migración ya publicada. Para cambiar el esquema,
 * agrega una nueva entrada al final de MIGRACIONES. Cada usuario corre solo las
 * que le faltan, así nadie pierde sus registros.
 */
import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { Registro } from '../../dominio/modelo';
import type { CambioPendiente } from '../contratos';

export interface FotoFila {
  id: string;
  tipo: string;
  /** Se guarda como ArrayBuffer (más compatible con Safari antiguo que Blob). */
  datos: ArrayBuffer;
  creado_en: string;
}

export interface CompletometroDB extends DBSchema {
  registros: { key: string; value: Registro; indexes: { por_fecha: string; por_actualizado: string } };
  fotos: { key: string; value: FotoFila };
  outbox: { key: number; value: CambioPendiente };
  ajustes: { key: string; value: unknown };
}

type Tx = IDBPTransaction<CompletometroDB, StoreNames<CompletometroDB>[], 'versionchange'>;
type Migracion = (db: IDBPDatabase<CompletometroDB>, tx: Tx) => void | Promise<void>;

export const NOMBRE_DB = 'completometro';

const MIGRACIONES: Migracion[] = [
  // v1: esquema inicial
  (db) => {
    const registros = db.createObjectStore('registros', { keyPath: 'id' });
    registros.createIndex('por_fecha', 'fecha_hora');
    registros.createIndex('por_actualizado', 'actualizado_en');
    db.createObjectStore('fotos', { keyPath: 'id' });
    db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
    db.createObjectStore('ajustes');
  },
  // v2 (ejemplo futuro):
  // async (db, tx) => {
  //   const store = tx.objectStore('registros');
  //   for await (const cursor of store) { cursor.update({ ...cursor.value, nuevo_campo: null, version_esquema: 2 }); }
  // },
];

export const VERSION_DB = MIGRACIONES.length;

const conexiones = new Map<string, Promise<IDBPDatabase<CompletometroDB>>>();

export function abrirDB(nombre = NOMBRE_DB): Promise<IDBPDatabase<CompletometroDB>> {
  let c = conexiones.get(nombre);
  if (!c) {
    c = crear(nombre);
    conexiones.set(nombre, c);
  }
  return c;
}

function crear(nombre: string): Promise<IDBPDatabase<CompletometroDB>> {
  return openDB<CompletometroDB>(nombre, VERSION_DB, {
    async upgrade(db, versionAnterior, _nueva, tx) {
      for (let v = versionAnterior; v < VERSION_DB; v++) await MIGRACIONES[v](db, tx as Tx);
    },
    blocking() {
      // Otra pestaña abrió una versión más nueva: cerramos para no bloquearla.
      conexiones.get(nombre)?.then((db) => db.close());
      conexiones.delete(nombre);
    },
  });
}
