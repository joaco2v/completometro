import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { reg } from './ayuda';
import { leerNota, locales, mover, puntosCalor, rankingPorNota, topPersonalizado } from '../src/dominio/top';
import type { ResenaLocal } from '../src/dominio/resenas';
import { normalizarResena } from '../src/dominio/resenas';
import { crearDatos } from '../src/datos';
import { exportarZip, importarArchivo } from '../src/datos/respaldo';
import { registroVacio } from '../src/dominio/modelo';

const d = (mes: number, dia: number) => new Date(2026, mes - 1, dia, 13);
const resena = (nombre: string, puntuacion: number, extra: Partial<ResenaLocal> = {}): ResenaLocal => ({
  id: `r-${nombre}`, nombre_local: nombre, puntuacion, latitud: null, longitud: null, comentario: null,
  fecha: '2026-06-01T12:00:00-04:00', creado_en: '2026-06-01T12:00:00-04:00', actualizado_en: '2026-06-01T12:00:00-04:00',
  eliminado_en: null, dispositivo_id: 'x', estado_sync: 'pendiente', version_esquema: 2, ...extra,
});

describe('ranking por nota', () => {
  const rs = [
    reg(d(1, 1), { nombre_local: 'Dominó', puntuacion: 8 }),
    reg(d(1, 2), { nombre_local: 'domino', puntuacion: 9 }), // mismo local, promedio 8,5
    reg(d(1, 3), { nombre_local: 'Fuente Alemana', puntuacion: 9 }),
    reg(d(1, 4), { nombre_local: 'Lomitón', puntuacion: 9 }),
    reg(d(1, 5), { nombre_local: 'Lomitón', puntuacion: 9 }),
    reg(d(1, 6), { nombre_local: 'Sin nota' }),
    reg(d(1, 7), { tipo_lugar: 'otro', nombre_local: null, puntuacion: 10 }), // en casa: no es local
  ];

  it('ordena por nota y desempata por visitas', () => {
    const r = rankingPorNota(rs, []);
    expect(r.map((l) => l.nombre)).toEqual(['Lomitón', 'Fuente Alemana', 'domino']);
    expect(r[0]).toMatchObject({ nota: 9, visitas: 2 });
    expect(r[2].nota).toBeCloseTo(8.5);
  });

  it('las reseñas suman a la nota pero no a las visitas', () => {
    const r = rankingPorNota(rs, [resena('Dominó', 10), resena('Nuevo Local', 7)]);
    const domino = r.find((l) => l.clave === 'domino')!;
    expect(domino).toMatchObject({ visitas: 2, notas: 3, resenado: true });
    expect(domino.nota).toBeCloseTo(9);
    expect(r.find((l) => l.nombre === 'Nuevo Local')).toMatchObject({ visitas: 0, completos: 0, nota: 7 });
  });

  it('ignora eliminados y locales sin nota', () => {
    const r = rankingPorNota([...rs, reg(d(2, 1), { nombre_local: 'Borrado', puntuacion: 10, eliminado_en: '2026-02-02T00:00:00-03:00' })], [resena('Otro', 10, { eliminado_en: 'x' })]);
    expect(r.map((l) => l.nombre)).not.toContain('Borrado');
    expect(r.map((l) => l.nombre)).not.toContain('Otro');
    expect(r.map((l) => l.nombre)).not.toContain('Sin nota');
    expect(locales(rs, []).map((l) => l.nombre)).toContain('Sin nota');
  });
});

describe('top personalizado', () => {
  it('respeta el orden elegido, sin duplicados, máximo 5', () => {
    const rs = [reg(d(1, 1), { nombre_local: 'Dominó', puntuacion: 8 })];
    const t = topPersonalizado(['Local Nuevo', 'dominó', 'Domino', 'A', 'B', 'C', 'D'], rs, []);
    expect(t.map((l) => l.nombre)).toEqual(['Local Nuevo', 'Dominó', 'A', 'B', 'C']);
    expect(t[1].nota).toBe(8);
    expect(t[0].nota).toBeNull();
  });

  it('la nota a mano reemplaza al promedio y se redondea a un decimal', () => {
    const rs = [reg(d(1, 1), { nombre_local: 'Dominó', puntuacion: 8 })];
    const t = topPersonalizado(['Dominó', 'Local Nuevo', 'Otro'], rs, [], { domino: 9.24, 'local nuevo': 7.5, otro: 15 });
    expect(t[0]).toMatchObject({ nota: 9.2, notaPersonalizada: true, visitas: 1 });
    expect(t[1]).toMatchObject({ nota: 7.5, notaPersonalizada: true });
    expect(t[2]).toMatchObject({ nota: null }); // 15 no es válida
    expect(t[2].notaPersonalizada).toBeUndefined();
  });

  it('lee notas escritas con coma o punto', () => {
    expect(leerNota('8,7')).toBe(8.7);
    expect(leerNota('8.75')).toBe(8.8);
    expect(leerNota('10')).toBe(10);
    expect(leerNota(' 9 ')).toBe(9);
    expect(leerNota('0,5')).toBeNull();
    expect(leerNota('11')).toBeNull();
    expect(leerNota('abc')).toBeNull();
    expect(leerNota('')).toBeNull();
  });

  it('mover sube y baja', () => {
    expect(mover(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(mover(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
  });
});

describe('mapa de calor', () => {
  it('agrupa puntos cercanos y pesa por cantidad', () => {
    const p = puntosCalor([
      reg(d(1, 1), { latitud: -33.43721, longitud: -70.63661, cantidad: 2 }),
      reg(d(1, 2), { latitud: -33.43719, longitud: -70.63659 }),
      reg(d(1, 3), { latitud: -33.5, longitud: -70.7 }),
      reg(d(1, 4)),
    ]);
    expect(p).toHaveLength(2);
    expect(p.find((x) => x.peso === 3)).toBeDefined();
  });
});

describe('reseñas en la base y en los respaldos', () => {
  it('valida la reseña', () => {
    expect(() => normalizarResena({ nombre_local: ' ', puntuacion: 5, latitud: null, longitud: null, comentario: null, fecha: '2026-01-01T00:00:00-03:00' })).toThrow(/nombre/);
    expect(() => normalizarResena({ nombre_local: 'X', puntuacion: 11, latitud: null, longitud: null, comentario: null, fecha: '2026-01-01T00:00:00-03:00' })).toThrow(/1 a 10/);
  });

  it('una reseña por local: calificar de nuevo la actualiza', async () => {
    const db = crearDatos('resenas-1');
    const a = await db.resenas.guardar({ nombre_local: 'Dominó', puntuacion: 7, latitud: null, longitud: null, comentario: null, fecha: '2026-01-01T12:00:00-03:00' });
    const b = await db.resenas.guardar({ nombre_local: 'domino ', puntuacion: 9, latitud: null, longitud: null, comentario: 'mejoró', fecha: '2026-02-01T12:00:00-03:00' });
    expect(b.id).toBe(a.id);
    const todas = await db.resenas.listar();
    expect(todas).toHaveLength(1);
    expect(todas[0]).toMatchObject({ puntuacion: 9, comentario: 'mejoró' });
    expect((await db.outbox.pendientes()).map((p) => p.entidad)).toEqual(['resena', 'resena']);
  });

  it('viajan en el ZIP junto con el top personalizado', async () => {
    const origen = crearDatos('resenas-2');
    await origen.repo.crear({ ...registroVacio(), nombre_local: 'Dominó', puntuacion: 8 });
    await origen.resenas.guardar({ nombre_local: 'Fuente Alemana', puntuacion: 10, latitud: -33.43, longitud: -70.63, comentario: null, fecha: '2026-03-01T12:00:00-03:00' });
    await origen.ajustes.guardar({ modoTop: 'personalizado', topPersonalizado: ['Fuente Alemana', 'Dominó'], notasTopPersonalizado: { domino: 8.7 } });
    const zip = await exportarZip(origen);

    const destino = crearDatos('resenas-3');
    const r = await importarArchivo(zip, destino);
    expect(r).toMatchObject({ nuevos: 1, resenas: 1 });
    expect((await destino.resenas.listar())[0]).toMatchObject({ nombre_local: 'Fuente Alemana', puntuacion: 10 });
    expect(await destino.ajustes.leer()).toMatchObject({ modoTop: 'personalizado', topPersonalizado: ['Fuente Alemana', 'Dominó'], notasTopPersonalizado: { domino: 8.7 } });

    const { default: JSZip } = await import('jszip');
    const csv = await (await JSZip.loadAsync(zip)).file('resenas_locales.csv')!.async('string');
    expect(csv).toContain('Fuente Alemana,10,-33.430000,-70.630000');
  });
});
