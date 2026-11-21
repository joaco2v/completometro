import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { aplicarEdicionMasiva, edicionVacia } from '../src/dominio/edicionMasiva';
import { registroVacio } from '../src/dominio/modelo';
import { crearDatos } from '../src/datos';

const base = (extra = {}) => ({ ...registroVacio(new Date(2026, 9, 10, 13, 45)), nombre_local: 'Dominó', puntuacion: 7, emocion: 'feliz', hambre: 3, notas: 'rico', ...extra });

describe('aplicarEdicionMasiva', () => {
  it('solo cambia lo que viene; null quita', () => {
    const r = aplicarEdicionMasiva(base(), { puntuacion: 9, emocion: null });
    expect(r).toMatchObject({ puntuacion: 9, emocion: null, hambre: 3, notas: 'rico', nombre_local: 'Dominó' });
  });

  it('mueve de día conservando la hora', () => {
    const r = aplicarEdicionMasiva(base(), { fecha: '2026-11-02' });
    const f = new Date(r.fecha_hora);
    expect([f.getFullYear(), f.getMonth(), f.getDate(), f.getHours(), f.getMinutes()]).toEqual([2026, 10, 2, 13, 45]);
  });

  it('no deja fechas en el futuro', () => {
    expect(() => aplicarEdicionMasiva(base(), { fecha: '2999-01-01' })).toThrow(/futuro/);
  });

  it('cambiar a local sin nombre conserva el nombre de cada registro', () => {
    expect(aplicarEdicionMasiva(base(), { lugar: { tipo_lugar: 'local', nombre_local: '' } }).nombre_local).toBe('Dominó');
    const conNombre = aplicarEdicionMasiva(base(), { lugar: { tipo_lugar: 'local', nombre_local: 'Fuente Alemana', latitud: -33.43, longitud: -70.63 } });
    expect(conNombre).toMatchObject({ nombre_local: 'Fuente Alemana', latitud: -33.43, origen_coordenadas: 'manual' });
  });

  it('pasar a "en casa" quita el local; quién lo preparó solo aplica fuera de locales', () => {
    const casa = aplicarEdicionMasiva(base(), { lugar: { tipo_lugar: 'otro' }, preparado: { preparado_por: 'otra_persona', preparado_por_nombre: 'Mi mamá' } });
    expect(casa).toMatchObject({ tipo_lugar: 'otro', nombre_local: null, preparado_por: 'otra_persona', preparado_por_nombre: 'Mi mamá' });
    const local = aplicarEdicionMasiva(base(), { preparado: { preparado_por: 'yo' } });
    expect(local.preparado_por).toBeNull();
  });

  it('cambia el tipo de completo y si es veggie', () => {
    const r = aplicarEdicionMasiva(base({ tipo_completo: 'completo' }), { tipo_completo: 'italiano', veggie: true });
    expect(r).toMatchObject({ tipo_completo: 'italiano', veggie: true, puntuacion: 7 });
    expect(aplicarEdicionMasiva(r, { tipo_completo: null }).tipo_completo).toBeNull();
  });

  it('detecta una edición vacía', () => {
    expect(edicionVacia({})).toBe(true);
    expect(edicionVacia({ emocion: null })).toBe(false);
  });
});

describe('actualizarVarios en IndexedDB', () => {
  it('actualiza varios en una transacción y deja cambios en el outbox', async () => {
    const d = crearDatos('masiva-1');
    const a = await d.repo.crear(base());
    const b = await d.repo.crear(base({ nombre_local: 'Lomitón' }));
    const n = await d.repo.actualizarVarios([a.id, b.id], (r) => aplicarEdicionMasiva(r, { puntuacion: 10 }));
    expect(n).toBe(2);
    const todos = await d.repo.listar();
    expect(todos.map((r) => r.puntuacion)).toEqual([10, 10]);
    expect(todos.map((r) => r.nombre_local).sort()).toEqual(['Dominó', 'Lomitón']);
    expect((await d.outbox.pendientes()).filter((p) => p.operacion === 'actualizar')).toHaveLength(2);
  });

  it('si uno queda inválido, no cambia ninguno', async () => {
    const d = crearDatos('masiva-2');
    const a = await d.repo.crear(base());
    await expect(d.repo.actualizarVarios([a.id], (r) => aplicarEdicionMasiva(r, { cantidad: 99 }))).rejects.toThrow();
    expect((await d.repo.obtener(a.id))?.cantidad).toBe(1);
  });

  it('ignora eliminados', async () => {
    const d = crearDatos('masiva-3');
    const a = await d.repo.crear(base());
    await d.repo.eliminar(a.id);
    expect(await d.repo.actualizarVarios([a.id], (r) => ({ ...r, puntuacion: 1 }))).toBe(0);
  });
});
