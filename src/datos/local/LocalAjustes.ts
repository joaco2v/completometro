import type { IDBPDatabase } from 'idb';
import { ajustesPorDefecto, type Ajustes } from '../../dominio/ajustes';
import { nuevoId } from '../../dominio/modelo';
import type { AjustesStore } from '../contratos';
import type { CompletometroDB } from './db';

const CLAVE = 'ajustes';

/** Ajustes guardados en IndexedDB (un solo objeto). */
export class LocalAjustes implements AjustesStore {
  private oyentes = new Set<() => void>();
  private cache: Ajustes | null = null;
  private cola: Promise<unknown> = Promise.resolve();

  constructor(private db: () => Promise<IDBPDatabase<CompletometroDB>>) {}

  async leer(): Promise<Ajustes> {
    if (this.cache) return this.cache;
    const db = await this.db();
    const guardado = (await db.get('ajustes', CLAVE)) as Partial<Ajustes> | undefined;
    const base = ajustesPorDefecto(guardado?.dispositivo_id ?? nuevoId());
    this.cache = { ...base, ...guardado };
    if (!guardado) await db.put('ajustes', this.cache, CLAVE);
    return this.cache;
  }

  /** Las escrituras se encadenan para que dos cambios seguidos no se pisen. */
  guardar(cambios: Partial<Ajustes>): Promise<Ajustes> {
    const p = this.cola.then(async () => {
      const nuevo = { ...(await this.leer()), ...cambios };
      await (await this.db()).put('ajustes', nuevo, CLAVE);
      this.cache = nuevo;
      for (const f of this.oyentes) f();
      return nuevo;
    });
    this.cola = p.catch(() => undefined);
    return p;
  }

  suscribir(alCambiar: () => void) {
    this.oyentes.add(alCambiar);
    return () => this.oyentes.delete(alCambiar);
  }
}
