import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { crearDatos } from '../src/datos';
import type { AlmacenNube, ArchivoNube } from '../src/datos/contratos';
import { ARCHIVO_DATOS, sincronizarConNube } from '../src/datos/sincronizarNube';
import { registroVacio } from '../src/dominio/modelo';

/** Drive falso en memoria. */
class NubeFalsa implements AlmacenNube {
  archivos = new Map<string, { nombre: string; blob: Blob }>();
  subidas = 0;
  private n = 0;
  async listar(): Promise<ArchivoNube[]> {
    return [...this.archivos].map(([id, a]) => ({ id, nombre: a.nombre }));
  }
  async descargarTexto(id: string) {
    return this.archivos.get(id)!.blob.text();
  }
  async descargarBlob(id: string, tipo: string) {
    return new Blob([await this.archivos.get(id)!.blob.arrayBuffer()], { type: tipo });
  }
  async crear(nombre: string, blob: Blob) {
    const id = `f${++this.n}`;
    this.archivos.set(id, { nombre, blob });
    this.subidas++;
    return id;
  }
  async actualizar(id: string, blob: Blob) {
    this.archivos.get(id)!.blob = blob;
  }
  nombres() {
    return [...this.archivos.values()].map((a) => a.nombre).sort();
  }
}

let n = 0;
const nuevaDb = () => crearDatos(`nube-${++n}`);

describe('respaldo en la nube (Google Drive appData)', () => {
  it('primer respaldo sube datos y fotos; el segundo no repite fotos', async () => {
    const d = nuevaDb();
    const nube = new NubeFalsa();
    const foto = await d.fotos.guardar(new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' }));
    await d.repo.crear({ ...registroVacio(), nombre_local: 'Dominó', foto_id: foto });

    const r1 = await sincronizarConNube(nube, d);
    expect(r1).toMatchObject({ fotosSubidas: 1, registros: 1 });
    expect(nube.nombres()).toEqual([ARCHIVO_DATOS, `foto-${foto}.jpg`]);

    await d.repo.crear(registroVacio());
    const r2 = await sincronizarConNube(nube, d);
    expect(r2).toMatchObject({ fotosSubidas: 0, registros: 2 });
    expect(nube.subidas).toBe(2); // el JSON se actualiza, no se duplica
  });

  it('un teléfono nuevo restaura todo al conectarse, con fotos', async () => {
    const nube = new NubeFalsa();
    const viejo = nuevaDb();
    await viejo.ajustes.guardar({ contadoresIniciales: { 2026: 12 } });
    const foto = await viejo.fotos.guardar(new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' }));
    const r = await viejo.repo.crear({ ...registroVacio(), foto_id: foto });
    await sincronizarConNube(nube, viejo);

    const nuevo = nuevaDb();
    const res = await sincronizarConNube(nube, nuevo);
    expect(res.traidos).toMatchObject({ nuevos: 1, fotos: 1 });
    expect(await nuevo.repo.obtener(r.id)).toBeDefined();
    expect(await nuevo.fotos.obtener(foto)).toBeDefined();
    expect((await nuevo.ajustes.leer()).contadoresIniciales['2026']).toBe(12);
  });

  it('dos teléfonos quedan con la unión de sus registros', async () => {
    const nube = new NubeFalsa();
    const a = nuevaDb();
    const b = nuevaDb();
    const ra = await a.repo.crear({ ...registroVacio(), nombre_local: 'A' });
    const rb = await b.repo.crear({ ...registroVacio(), nombre_local: 'B' });
    await sincronizarConNube(nube, a);
    await sincronizarConNube(nube, b);
    await sincronizarConNube(nube, a);
    for (const d of [a, b]) {
      const ids = (await d.repo.listar()).map((r) => r.id).sort();
      expect(ids).toEqual([ra.id, rb.id].sort());
    }
  });

  it('un borrado en un teléfono viaja al otro', async () => {
    const nube = new NubeFalsa();
    const a = nuevaDb();
    const b = nuevaDb();
    const r = await a.repo.crear(registroVacio());
    await sincronizarConNube(nube, a);
    await sincronizarConNube(nube, b);
    await new Promise((ok) => setTimeout(ok, 1100));
    await b.repo.eliminar(r.id);
    await sincronizarConNube(nube, b);
    await sincronizarConNube(nube, a);
    expect(await a.repo.listar()).toHaveLength(0);
  });
});
