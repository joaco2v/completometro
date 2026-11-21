import type { IDBPDatabase } from 'idb';
import { resolverConflicto } from '../../dominio/conflictos';
import { claveLocal } from '../../dominio/metricas';
import { aIsoLocal, nuevoId, VERSION_ESQUEMA } from '../../dominio/modelo';
import { normalizarResena, type DatosResena, type ResenaLocal } from '../../dominio/resenas';
import type { CambioPendiente, ResenaRepository, ResultadoFusion } from '../contratos';
import type { CompletometroDB } from './db';

/** Reseñas de locales en IndexedDB. Cada escritura deja un cambio en el outbox, igual que los registros. */
export class LocalResenas implements ResenaRepository {
  private oyentes = new Set<() => void>();

  constructor(private o: {
    db: () => Promise<IDBPDatabase<CompletometroDB>>;
    dispositivoId: () => Promise<string>;
    alEscribir?: () => void | Promise<void>;
  }) {}

  suscribir(f: () => void) {
    this.oyentes.add(f);
    return () => this.oyentes.delete(f);
  }

  private avisar() {
    this.oyentes.forEach((f) => f());
  }

  async listar(opciones: { incluirEliminados?: boolean } = {}) {
    const todas = await (await this.o.db()).getAll('resenas');
    return opciones.incluirEliminados ? todas : todas.filter((r) => !r.eliminado_en);
  }

  private async escribir(r: ResenaLocal, operacion: CambioPendiente['operacion']) {
    const db = await this.o.db();
    const tx = db.transaction(['resenas', 'outbox'], 'readwrite');
    await Promise.all([
      tx.objectStore('resenas').put(r),
      tx.objectStore('outbox').add({ entidad: 'resena', entidad_id: r.id, operacion, fecha: r.actualizado_en }),
      tx.done,
    ]);
    await this.o.alEscribir?.();
    this.avisar();
  }

  async guardar(datos: DatosResena) {
    const limpio = normalizarResena(datos);
    const ahora = aIsoLocal(new Date());
    const k = claveLocal(limpio.nombre_local);
    const existente = (await this.listar()).find((r) => claveLocal(r.nombre_local) === k);
    const r: ResenaLocal = {
      ...limpio,
      id: existente?.id ?? nuevoId(),
      creado_en: existente?.creado_en ?? ahora,
      actualizado_en: ahora,
      eliminado_en: null,
      dispositivo_id: await this.o.dispositivoId(),
      estado_sync: 'pendiente',
      version_esquema: VERSION_ESQUEMA,
    };
    await this.escribir(r, existente ? 'actualizar' : 'crear');
    return r;
  }

  async eliminar(id: string) {
    const actual = await (await this.o.db()).get('resenas', id);
    if (!actual || actual.eliminado_en) return;
    const ahora = aIsoLocal(new Date());
    await this.escribir({ ...actual, eliminado_en: ahora, actualizado_en: ahora, estado_sync: 'pendiente' }, 'eliminar');
  }

  async fusionar(entrantes: ResenaLocal[]): Promise<ResultadoFusion> {
    const db = await this.o.db();
    const tx = db.transaction('resenas', 'readwrite');
    const res: ResultadoFusion = { nuevos: 0, actualizados: 0, ignorados: 0 };
    for (const e of entrantes) {
      const decision = resolverConflicto(await tx.store.get(e.id), e);
      if (decision === 'ignora') {
        res.ignorados++;
        continue;
      }
      await tx.store.put(e);
      if (decision === 'nuevo') res.nuevos++;
      else res.actualizados++;
    }
    await tx.done;
    if (res.nuevos || res.actualizados) this.avisar();
    return res;
  }
}
