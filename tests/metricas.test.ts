import { describe, expect, it } from 'vitest';
import { reg } from './ayuda';
import {
  completosEntre, diasTranscurridos, distribucionEmociones, hambrePromedio, localesConocidos,
  rachaActual, rachaMasLarga, rankingLocales, resumenAnual, resumenRapido, seriePorPeriodo, totalAnio,
} from '../src/dominio/metricas';
import { calcularAcumulados } from '../src/dominio/acumulado';
import { resolverConflicto } from '../src/dominio/conflictos';
import { normalizarDatos, registroVacio } from '../src/dominio/modelo';

// Sábado 21 de noviembre de 2026, 15:00 hora local
const AHORA = new Date(2026, 10, 21, 15, 0);
const d = (mes: number, dia: number, hora = 13) => new Date(2026, mes - 1, dia, hora);

describe('total del año y contador inicial', () => {
  it('suma cantidades y el contador inicial del año', () => {
    const rs = [reg(d(1, 5), { cantidad: 2 }), reg(d(11, 20)), reg(new Date(2025, 11, 31), { cantidad: 9 })];
    expect(totalAnio(rs, 2026)).toBe(3);
    expect(totalAnio(rs, 2026, { '2026': 37 })).toBe(40);
    expect(totalAnio(rs, 2025, { '2026': 37 })).toBe(9);
  });

  it('ignora registros eliminados', () => {
    const rs = [reg(d(3, 1)), reg(d(3, 2), { eliminado_en: '2026-03-03T00:00:00-03:00' })];
    expect(totalAnio(rs, 2026)).toBe(1);
  });

  it('el año nuevo parte en cero', () => {
    const rs = [reg(new Date(2026, 11, 31, 23, 59), { cantidad: 4 })];
    const r = resumenRapido(rs, new Date(2027, 0, 1, 9), { '2026': 10 });
    expect(r.totalAnio).toBe(0);
    expect(r.anio).toBe(2027);
  });
});

describe('acumulado anual', () => {
  it('numera en orden cronológico aunque se registre atrasado', () => {
    const tarde = reg(d(11, 20), { cantidad: 2 });
    const olvidado = reg(d(11, 10)); // registrado después, pero ocurrió antes
    const rs = calcularAcumulados([tarde, olvidado], { '2026': 37 });
    expect(rs.map((r) => r.numero_acumulado_anio)).toEqual([38, 40]);
    expect(rs[0].id).toBe(olvidado.id);
  });

  it('reinicia cada año', () => {
    const rs = calcularAcumulados([reg(new Date(2025, 11, 30)), reg(new Date(2026, 0, 2), { cantidad: 3 })]);
    expect(rs.map((r) => r.numero_acumulado_anio)).toEqual([1, 3]);
  });
});

describe('hoy, semana y mes', () => {
  it('cuenta según hora local, semana desde el lunes', () => {
    const rs = [
      reg(d(11, 21, 9)), // hoy
      reg(d(11, 16, 12), { cantidad: 2 }), // lunes de esta semana
      reg(d(11, 15, 20)), // domingo anterior
      reg(d(11, 1, 8)),
      reg(d(10, 31, 23)),
    ];
    const r = resumenRapido(rs, AHORA);
    expect(r.hoy).toBe(1);
    expect(r.semana).toBe(3);
    expect(r.mes).toBe(5);
  });

  it('completosEntre es semiabierto', () => {
    const rs = [reg(new Date(2026, 0, 1, 0, 0))];
    expect(completosEntre(rs, new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(1);
    expect(completosEntre(rs, new Date(2025, 11, 31), new Date(2026, 0, 1))).toBe(0);
  });
});

describe('racha', () => {
  it('cuenta hasta ayer si hoy aún no hay registro', () => {
    const rs = [reg(d(11, 20)), reg(d(11, 19)), reg(d(11, 18)), reg(d(11, 16))];
    expect(rachaActual(rs, AHORA)).toBe(3);
  });

  it('incluye hoy si ya registré', () => {
    const rs = [reg(d(11, 21)), reg(d(11, 20))];
    expect(rachaActual(rs, AHORA)).toBe(2);
  });

  it('se corta si ayer no hubo', () => {
    expect(rachaActual([reg(d(11, 19))], AHORA)).toBe(0);
  });

  it('racha más larga del año', () => {
    const rs = [reg(d(1, 30)), reg(d(1, 31)), reg(d(2, 1)), reg(d(2, 2)), reg(d(3, 10)), reg(d(3, 11))];
    expect(rachaMasLarga(rs, 2026)).toBe(4);
  });
});

describe('promedio semanal', () => {
  it('divide el total por las semanas transcurridas', () => {
    expect(diasTranscurridos(2026, AHORA)).toBe(325);
    const r = resumenRapido([reg(d(11, 1), { cantidad: 10 })], AHORA, { '2026': 50 });
    expect(r.promedioSemanal).toBeCloseTo(60 / (325 / 7), 5);
  });

  it('usa al menos una semana', () => {
    const r = resumenRapido([reg(new Date(2026, 0, 1, 12), { cantidad: 3 })], new Date(2026, 0, 1, 18));
    expect(r.promedioSemanal).toBe(3);
  });
});

describe('emociones y hambre', () => {
  it('la distribución cuenta ocasiones, no cantidades', () => {
    const rs = [reg(d(11, 2), { emocion: 'feliz', cantidad: 3 }), reg(d(11, 3), { emocion: 'triste' }), reg(d(11, 4), { emocion: 'triste' }), reg(d(11, 5))];
    expect(distribucionEmociones(rs)).toEqual([{ id: 'triste', conteo: 2 }, { id: 'feliz', conteo: 1 }]);
    expect(resumenRapido(rs, AHORA).emocionTopMes).toEqual({ id: 'triste', conteo: 2 });
  });

  it('hambre promedio ignora registros sin dato', () => {
    expect(hambrePromedio([reg(d(1, 1), { hambre: 5 }), reg(d(1, 2), { hambre: 2 }), reg(d(1, 3))])).toBe(3.5);
    expect(hambrePromedio([reg(d(1, 1))])).toBeNull();
  });

  it('hambre de la última semana (7 días incluyendo hoy)', () => {
    const rs = [reg(d(11, 21), { hambre: 5 }), reg(d(11, 15), { hambre: 3 }), reg(d(11, 14), { hambre: 1 })];
    expect(resumenRapido(rs, AHORA).hambrePromedioSemana).toBe(4);
  });
});

describe('series para gráficos', () => {
  it('mensual: un punto por mes hasta el actual, con ceros', () => {
    const s = seriePorPeriodo([reg(d(2, 10), { cantidad: 2 }), reg(d(11, 1))], 2026, 'mes', AHORA);
    expect(s).toHaveLength(11);
    expect(s[0].completos).toBe(0);
    expect(s[1].completos).toBe(2);
    expect(s[10].completos).toBe(1);
  });

  it('semanal: semanas de lunes, la primera puede empezar en diciembre del año anterior', () => {
    const s = seriePorPeriodo([reg(new Date(2026, 0, 1, 12), { emocion: 'feliz', hambre: 4 })], 2026, 'semana', AHORA);
    expect(s[0].clave).toBe('2025-12-29');
    expect(s[0].completos).toBe(1);
    expect(s[0].emociones).toEqual({ feliz: 1 });
    expect(s[0].hambrePromedio).toBe(4);
    expect(s.at(-1)?.clave).toBe('2026-11-16');
  });
});

describe('locales', () => {
  const rs = [
    reg(d(3, 1), { nombre_local: 'Dominó', puntuacion: 8, cantidad: 2 }),
    reg(d(4, 1), { nombre_local: 'domino ', puntuacion: 6 }),
    reg(d(5, 1), { nombre_local: 'Fuente Alemana', puntuacion: 10 }),
    reg(d(5, 2), { tipo_lugar: 'otro', nombre_local: null }),
  ];

  it('agrupa nombres parecidos y ordena por completos', () => {
    const r = rankingLocales(rs);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ nombre: 'domino ', visitas: 2, completos: 3, puntuacionPromedio: 7 });
    expect(r[1]).toMatchObject({ nombre: 'Fuente Alemana', completos: 1, puntuacionPromedio: 10 });
  });

  it('autocompletar sugiere el más reciente primero', () => {
    expect(localesConocidos(rs)).toEqual(['Fuente Alemana', 'domino ']);
  });

  it('resumen anual', () => {
    const r = resumenAnual(rs, 2026, AHORA, { '2026': 5 });
    expect(r.total).toBe(10);
    expect(r.ocasiones).toBe(4);
    expect(r.localFavorito?.completos).toBe(3);
    expect(r.mejorPuntuado?.nombre).toBe('Fuente Alemana');
    expect(r.mesTop).toEqual({ mes: 2, completos: 2 });
  });
});

describe('modelo y conflictos', () => {
  it('normaliza: puntuación y nombre solo para locales', () => {
    const n = normalizarDatos({ ...registroVacio(AHORA), tipo_lugar: 'otro', nombre_local: 'X', puntuacion: 9 });
    expect(n.nombre_local).toBeNull();
    expect(n.puntuacion).toBeNull();
  });

  it('rechaza puntuación fuera de 1–10', () => {
    expect(() => normalizarDatos({ ...registroVacio(AHORA), nombre_local: 'X', puntuacion: 11 })).toThrow();
  });

  it('gana el último cambio', () => {
    const a = reg(d(1, 1), { actualizado_en: '2026-01-01T10:00:00-03:00' });
    const b = { ...a, actualizado_en: '2026-01-02T10:00:00-03:00' };
    expect(resolverConflicto(undefined, a)).toBe('nuevo');
    expect(resolverConflicto(a, b)).toBe('reemplaza');
    expect(resolverConflicto(b, a)).toBe('ignora');
    expect(resolverConflicto(a, a)).toBe('ignora');
  });
});
