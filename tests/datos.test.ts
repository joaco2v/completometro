import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { crearDatos } from '../src/datos';
import { exportarRespaldoJson, exportarZip, importarArchivo, validarRespaldo } from '../src/datos/respaldo';
import { COLUMNAS_CSV, celda, generarCsv } from '../src/datos/csv';
import { calcularAcumulados } from '../src/dominio/acumulado';
import { registroVacio } from '../src/dominio/modelo';
import { debeAvisarRespaldo, ajustesPorDefecto, anioDelBannerAnual } from '../src/dominio/ajustes';
import { reg } from './ayuda';

let n = 0;
const nuevaDb = () => crearDatos(`prueba-${++n}`);

describe('LocalRepository', () => {
  it('crea, edita y elimina (lógico) dejando todo en el outbox', async () => {
    const d = nuevaDb();
    const r = await d.repo.crear({ ...registroVacio(), nombre_local: 'Dominó', puntuacion: 9 });
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.estado_sync).toBe('pendiente');

    const editado = await d.repo.actualizar(r.id, { cantidad: 3 });
    expect(editado.cantidad).toBe(3);
    expect(editado.creado_en).toBe(r.creado_en);
    expect(editado.nombre_local).toBe('Dominó');

    await d.repo.eliminar(r.id);
    expect(await d.repo.listar()).toHaveLength(0);
    const todos = await d.repo.listar({ incluirEliminados: true });
    expect(todos[0].eliminado_en).not.toBeNull();

    const pend = await d.outbox.pendientes();
    expect(pend.map((p) => p.operacion)).toEqual(['crear', 'actualizar', 'eliminar']);
    expect((await d.ajustes.leer()).cambiosDesdeRespaldo).toBe(3);
  });

  it('elimina varios a la vez y los puede restaurar', async () => {
    const d = nuevaDb();
    const [a, b, c] = await Promise.all([1, 2, 3].map((i) => d.repo.crear({ ...registroVacio(new Date(2026, 0, i, 13)) })));
    let avisos = 0;
    d.repo.suscribir(() => avisos++);

    expect(await d.repo.eliminarVarios([a.id, b.id, b.id, 'no-existe'])).toBe(2);
    expect((await d.repo.listar()).map((r) => r.id)).toEqual([c.id]);
    expect(avisos).toBe(1); // una sola notificación para todo el lote
    expect(await d.repo.eliminarVarios([a.id])).toBe(0); // ya estaba eliminado

    await new Promise((ok) => setTimeout(ok, 1100));
    expect(await d.repo.restaurar([a.id, c.id])).toBe(1); // c no estaba eliminado
    const restaurado = await d.repo.obtener(a.id);
    expect(restaurado?.eliminado_en).toBeNull();
    expect(restaurado!.actualizado_en > a.actualizado_en).toBe(true); // cambio más nuevo: gana al sincronizar
    expect((await d.repo.listar()).length).toBe(2);

    const ops = (await d.outbox.pendientes()).map((p) => p.operacion);
    expect(ops.filter((o) => o === 'eliminar')).toHaveLength(2);
    expect(ops.at(-1)).toBe('actualizar');
  });

  it('un borrado masivo viaja a otro teléfono al importar', async () => {
    const d = nuevaDb();
    const r = await d.repo.crear(registroVacio());
    const otro = nuevaDb();
    await importarArchivo(await exportarZip(d), otro);
    await new Promise((ok) => setTimeout(ok, 1100));
    await d.repo.eliminarVarios([r.id]);
    await importarArchivo(await exportarZip(d), otro);
    expect(await otro.repo.listar()).toHaveLength(0);
  });

  it('avisa a los suscriptores', async () => {
    const d = nuevaDb();
    let avisos = 0;
    d.repo.suscribir(() => avisos++);
    await d.repo.crear(registroVacio());
    expect(avisos).toBe(1);
  });
});

describe('migración de IndexedDB', () => {
  it('v1 → v2 conserva los registros y agrega los campos nuevos', async () => {
    const { openDB } = await import('idb');
    const nombre = 'migracion-v1';
    const v1 = await openDB(nombre, 1, {
      upgrade(db) {
        const r = db.createObjectStore('registros', { keyPath: 'id' });
        r.createIndex('por_fecha', 'fecha_hora');
        r.createIndex('por_actualizado', 'actualizado_en');
        db.createObjectStore('fotos', { keyPath: 'id' });
        db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
        db.createObjectStore('ajustes');
      },
    });
    const viejo = { ...reg(new Date(2026, 2, 1, 13)), version_esquema: 1 } as Record<string, unknown>;
    delete viejo.preparado_por;
    delete viejo.preparado_por_nombre;
    await v1.put('registros', viejo);
    v1.close();

    const d = crearDatos(nombre);
    const [r] = await d.repo.listar();
    expect(r).toMatchObject({ id: viejo.id, preparado_por: null, preparado_por_nombre: null, version_esquema: 3, actualizado_en: viejo.actualizado_en });
  });
});

describe('exportar e importar', () => {
  async function conDatos() {
    const d = nuevaDb();
    await d.ajustes.guardar({ contadoresIniciales: { 2026: 37 }, emocionesPersonalizadas: [{ id: 'p_bajoneado', emoji: '🫠', nombre: 'Bajoneado' }] });
    const foto = await d.fotos.guardar(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }));
    const a = await d.repo.crear({ ...registroVacio(new Date(2026, 5, 1, 13)), nombre_local: 'Fuente, "Alemana"', puntuacion: 10, emocion: 'p_bajoneado', hambre: 5, latitud: -33.4372, longitud: -70.6506, precision_gps_m: 12, origen_coordenadas: 'gps', foto_id: foto });
    await d.repo.crear({ ...registroVacio(new Date(2026, 5, 2, 20)), tipo_lugar: 'otro', cantidad: 2, notas: '=1+1' });
    return { d, a, foto };
  }

  it('ZIP → importar en otro teléfono restaura todo, con fotos', async () => {
    const { d, a, foto } = await conDatos();
    const zip = await exportarZip(d);
    const otro = nuevaDb();
    const res = await importarArchivo(zip, otro);
    expect(res).toMatchObject({ nuevos: 2, fotos: 1 });
    expect((await otro.repo.obtener(a.id))?.nombre_local).toBe('Fuente, "Alemana"');
    const f = await otro.fotos.obtener(foto);
    expect([...new Uint8Array(await f!.blob.arrayBuffer())]).toEqual([1, 2, 3, 4]);
    const aj = await otro.ajustes.leer();
    expect(aj.contadoresIniciales['2026']).toBe(37);
    expect(aj.emocionesPersonalizadas[0].nombre).toBe('Bajoneado');

    // Importar de nuevo no duplica
    const otraVez = await importarArchivo(zip, otro);
    expect(otraVez).toMatchObject({ nuevos: 0, actualizados: 0, ignorados: 2 });
    expect(await otro.repo.listar()).toHaveLength(2);
  });

  it('respaldo JSON de un archivo también trae las fotos', async () => {
    const { d, foto } = await conDatos();
    const json = await exportarRespaldoJson(d);
    const otro = nuevaDb();
    expect(await importarArchivo(json, otro)).toMatchObject({ nuevos: 2, fotos: 1 });
    expect(await otro.fotos.obtener(foto)).toBeDefined();
  });

  it('gana el cambio más reciente al importar', async () => {
    const { d, a } = await conDatos();
    const zipViejo = await exportarZip(d);
    await new Promise((r) => setTimeout(r, 1100));
    await d.repo.actualizar(a.id, { cantidad: 5 });
    const res = await importarArchivo(zipViejo, d);
    expect(res.actualizados).toBe(0);
    expect((await d.repo.obtener(a.id))?.cantidad).toBe(5);
  });

  it('rechaza archivos que no son respaldos', async () => {
    await expect(importarArchivo(new Blob(['{"hola":1}']), nuevaDb())).rejects.toThrow(/no parece/);
    await expect(importarArchivo(new Blob(['no es json']), nuevaDb())).rejects.toThrow(/No pude leer/);
  });
});

describe('CSV', () => {
  it('tiene BOM, encabezados planos y escapa bien', () => {
    const rs = calcularAcumulados([
      reg(new Date(2026, 0, 3, 12, 30), { nombre_local: 'Lo de "Juan", Ñuñoa', puntuacion: 7, emocion: 'feliz', hambre: 5, latitud: -33.4569, longitud: -70.5975, precision_gps_m: 8, origen_coordenadas: 'gps' }),
    ], { 2026: 10 });
    const csv = generarCsv(rs, [], () => 'x.jpg');
    expect(csv.startsWith('﻿')).toBe(true);
    const [cab, fila] = csv.slice(1).trim().split('\r\n');
    expect(cab.split(',')).toEqual([...COLUMNAS_CSV]);
    expect(cab).not.toMatch(/estado_sync|dispositivo|eliminado/);
    expect(fila).toContain('"Lo de ""Juan"", Ñuñoa"');
    expect(fila).toContain(',11,1,Local establecido,');
    expect(fila).toContain('Ñuñoa",7,,No,,,Feliz');
    expect(fila).toContain(',Feliz,😄,5,Me comería toda la olla,-33.456900,-70.597500,8,gps,x.jpg,');
  });

  it('en casa: muestra quién lo preparó', () => {
    const rs = calcularAcumulados([reg(new Date(2026, 0, 3, 12), { tipo_lugar: 'otro', nombre_local: null, puntuacion: 10, preparado_por: 'otra_persona', preparado_por_nombre: 'Mi mamá' })]);
    expect(generarCsv(rs)).toContain(',En casa u otro lugar,,10,,No,Otra persona,Mi mamá,');
  });

  it('importa respaldos v1 (sin "quién lo preparó")', () => {
    const v1 = { formato: 'completometro-respaldo', version_esquema: 1, registros: [{ ...reg(new Date(2026, 0, 1)), version_esquema: 1, preparado_por: undefined }], fotos: [] };
    const r = validarRespaldo(v1);
    expect(r.registros[0]).toMatchObject({ preparado_por: null, tipo_completo: null, veggie: false, version_esquema: 3 });
  });

  it('neutraliza fórmulas en textos libres', () => {
    expect(celda('=HYPERLINK()', true)).toBe("'=HYPERLINK()");
    expect(celda('-33.4')).toBe('-33.4');
  });
});

describe('avisos', () => {
  const base = ajustesPorDefecto('x');
  const ahora = new Date(2026, 10, 21);

  it('aviso de respaldo', () => {
    expect(debeAvisarRespaldo({ ...base, cambiosDesdeRespaldo: 2 }, 2, ahora)).toBe(false);
    expect(debeAvisarRespaldo({ ...base, cambiosDesdeRespaldo: 3 }, 3, ahora)).toBe(true);
    const reciente = { ...base, ultimoRespaldo: new Date(2026, 10, 18).toISOString() };
    expect(debeAvisarRespaldo({ ...reciente, cambiosDesdeRespaldo: 4 }, 50, ahora)).toBe(false);
    expect(debeAvisarRespaldo({ ...reciente, cambiosDesdeRespaldo: 15 }, 50, ahora)).toBe(true);
    const viejo = { ...base, ultimoRespaldo: new Date(2026, 10, 1).toISOString(), cambiosDesdeRespaldo: 1 };
    expect(debeAvisarRespaldo(viejo, 50, ahora)).toBe(true);
    expect(debeAvisarRespaldo({ ...viejo, avisoRespaldoPospuestoHasta: new Date(2026, 10, 23).toISOString() }, 50, ahora)).toBe(false);
  });

  it('banner del resumen anual: 31 dic al 10 ene', () => {
    expect(anioDelBannerAnual(new Date(2026, 11, 30), [])).toBeNull();
    expect(anioDelBannerAnual(new Date(2026, 11, 31), [])).toBe(2026);
    expect(anioDelBannerAnual(new Date(2027, 0, 10), [])).toBe(2026);
    expect(anioDelBannerAnual(new Date(2027, 0, 11), [])).toBeNull();
    expect(anioDelBannerAnual(new Date(2026, 11, 31), [2026])).toBeNull();
  });
});
