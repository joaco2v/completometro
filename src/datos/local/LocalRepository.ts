import type { IDBPDatabase } from 'idb';
import { aIsoLocal, normalizarDatos, nuevoId, VERSION_ESQUEMA, type DatosRegistro, type Registro } from '../../dominio/modelo';
import { resolverConflicto } from '../../dominio/conflictos';
import type { CambioPendiente, Outbox, RegistroRepository, ResultadoFusion } from '../contratos';
import type { CompletometroDB } from './db';

type Opciones = {
  db: () => Promise<IDBPDatabase<CompletometroDB>>;
  dispositivoId: () => Promise<string>;
  /** Se llama tras cada escritura hecha por el usuario (para el contador de "cambios sin respaldar"). */
  alEscribir?: () => void | Promise<void>;
  ahora?: () => Date;
};

/** Implementación de RegistroRepository sobre IndexedDB. Cada escritura deja un cambio en el outbox. */
export class LocalRepository implements RegistroRepository, Outbox {
  private oyentes = new Set<() => void>();
  constructor(private o: Opciones) {}

  private ahora() {
    return aIsoLocal(this.o.ahora?.() ?? new Date());
  }

  private avisar() {
    for (const f of this.oyentes) f();
  }

  suscribir(alCambiar: () => void) {
    this.oyentes.add(alCambiar);
    return () => this.oyentes.delete(alCambiar);
  }

  async listar(opciones: { incluirEliminados?: boolean } = {}) {
    const todos = await (await this.o.db()).getAll('registros');
    return opciones.incluirEliminados ? todos : todos.filter((r) => !r.eliminado_en);
  }

  async obtener(id: string) {
    return (await this.o.db()).get('registros', id);
  }

  private async escribir(r: Registro, operacion: CambioPendiente['operacion']) {
    const db = await this.o.db();
    const tx = db.transaction(['registros', 'outbox'], 'readwrite');
    await Promise.all([
      tx.objectStore('registros').put(r),
      tx.objectStore('outbox').add({ entidad: 'registro', entidad_id: r.id, operacion, fecha: r.actualizado_en }),
      tx.done,
    ]);
  }

  async crear(datos: DatosRegistro) {
    const ahora = this.ahora();
    const r: Registro = {
      ...normalizarDatos(datos),
      id: nuevoId(),
      creado_en: ahora,
      actualizado_en: ahora,
      eliminado_en: null,
      dispositivo_id: await this.o.dispositivoId(),
      estado_sync: 'pendiente',
      version_esquema: VERSION_ESQUEMA,
    };
    await this.escribir(r, 'crear');
    await this.o.alEscribir?.();
    this.avisar();
    return r;
  }

  async actualizar(id: string, cambios: Partial<DatosRegistro>) {
    const actual = await this.obtener(id);
    if (!actual) throw new Error('No encontré ese registro.');
    const { id: _i, creado_en: _c, ...resto } = actual;
    void _i; void _c;
    const r: Registro = {
      ...actual,
      ...normalizarDatos({ ...resto, ...cambios }),
      actualizado_en: this.ahora(),
      dispositivo_id: await this.o.dispositivoId(),
      estado_sync: 'pendiente',
      version_esquema: VERSION_ESQUEMA,
    };
    await this.escribir(r, 'actualizar');
    await this.o.alEscribir?.();
    this.avisar();
    return r;
  }

  async eliminar(id: string) {
    const actual = await this.obtener(id);
    if (!actual || actual.eliminado_en) return;
    const ahora = this.ahora();
    await this.escribir({ ...actual, eliminado_en: ahora, actualizado_en: ahora, estado_sync: 'pendiente' }, 'eliminar');
    await this.o.alEscribir?.();
    this.avisar();
  }

  /**
   * Cambia el estado de borrado de varios registros en una sola transacción.
   * `eliminar = true` los manda a la papelera; `false` los restaura. Devuelve cuántos cambiaron.
   */
  private async marcarVarios(ids: readonly string[], eliminar: boolean): Promise<number> {
    if (!ids.length) return 0;
    const ahora = this.ahora();
    const db = await this.o.db();
    const tx = db.transaction(['registros', 'outbox'], 'readwrite');
    const store = tx.objectStore('registros');
    let cambiados = 0;
    for (const id of new Set(ids)) {
      const r = await store.get(id);
      if (!r || !!r.eliminado_en === eliminar) continue;
      await store.put({ ...r, eliminado_en: eliminar ? ahora : null, actualizado_en: ahora, estado_sync: 'pendiente' });
      await tx.objectStore('outbox').add({ entidad: 'registro', entidad_id: id, operacion: eliminar ? 'eliminar' : 'actualizar', fecha: ahora });
      cambiados++;
    }
    await tx.done;
    if (cambiados) {
      await this.o.alEscribir?.();
      this.avisar();
    }
    return cambiados;
  }

  /**
   * Edita varios registros en una sola transacción. Primero valida todos:
   * si alguno queda inválido, no se cambia ninguno. Devuelve cuántos se actualizaron.
   */
  async actualizarVarios(ids: readonly string[], cambiar: (r: DatosRegistro) => DatosRegistro): Promise<number> {
    if (!ids.length) return 0;
    const ahora = this.ahora();
    const dispositivo_id = await this.o.dispositivoId();
    const db = await this.o.db();
    const actuales = (await Promise.all([...new Set(ids)].map((id) => db.get('registros', id))))
      .filter((r): r is Registro => !!r && !r.eliminado_en);
    const nuevos = actuales.map((r) => {
      const { id: _i, creado_en: _c, actualizado_en: _a, eliminado_en: _e, dispositivo_id: _d, estado_sync: _s, version_esquema: _v, ...datos } = r;
      return { ...r, ...cambiar(datos), actualizado_en: ahora, dispositivo_id, estado_sync: 'pendiente' as const, version_esquema: VERSION_ESQUEMA };
    });
    const tx = db.transaction(['registros', 'outbox'], 'readwrite');
    for (const r of nuevos) {
      await tx.objectStore('registros').put(r);
      await tx.objectStore('outbox').add({ entidad: 'registro', entidad_id: r.id, operacion: 'actualizar', fecha: ahora });
    }
    await tx.done;
    if (nuevos.length) {
      await this.o.alEscribir?.();
      this.avisar();
    }
    return nuevos.length;
  }

  eliminarVarios(ids: readonly string[]) {
    return this.marcarVarios(ids, true);
  }

  /** Saca registros de la papelera (deshace un borrado). Al ser un cambio más nuevo, también viaja a Drive. */
  restaurar(ids: readonly string[]) {
    return this.marcarVarios(ids, false);
  }

  async fusionar(entrantes: Registro[]): Promise<ResultadoFusion> {
    const db = await this.o.db();
    const tx = db.transaction(['registros', 'outbox'], 'readwrite');
    const store = tx.objectStore('registros');
    const resultado: ResultadoFusion = { nuevos: 0, actualizados: 0, ignorados: 0 };
    for (const e of entrantes) {
      const local = await store.get(e.id);
      const decision = resolverConflicto(local, e);
      if (decision === 'ignora') {
        resultado.ignorados++;
        continue;
      }
      await store.put(e);
      if (e.estado_sync === 'pendiente') {
        await tx.objectStore('outbox').add({ entidad: 'registro', entidad_id: e.id, operacion: 'importar', fecha: e.actualizado_en });
      }
      if (decision === 'nuevo') resultado.nuevos++;
      else resultado.actualizados++;
    }
    await tx.done;
    if (resultado.nuevos || resultado.actualizados) this.avisar();
    return resultado;
  }

  // --- Outbox (cola de cambios pendientes; hoy no se envía a ningún lado) ---

  async pendientes() {
    return (await this.o.db()).getAll('outbox');
  }

  async contar() {
    return (await this.o.db()).count('outbox');
  }

  async confirmar(seqs: number[]) {
    const db = await this.o.db();
    const tx = db.transaction('outbox', 'readwrite');
    await Promise.all([...seqs.map((s) => tx.store.delete(s)), tx.done]);
  }
}
