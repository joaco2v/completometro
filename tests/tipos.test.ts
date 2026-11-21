import { describe, expect, it } from 'vitest';
import { reg } from './ayuda';
import { buscarTipo, esTipoConocido, TIPOS_COMPLETO } from '../src/dominio/tipos';
import { completosVeggie, distribucionTipos } from '../src/dominio/metricas';
import { normalizarDatos, registroVacio } from '../src/dominio/modelo';
import { calcularAcumulados } from '../src/dominio/acumulado';
import { generarCsv } from '../src/datos/csv';

const d = (dia: number) => new Date(2026, 10, dia, 13);

describe('tipos de completo', () => {
  it('incluye los más conocidos', () => {
    expect(TIPOS_COMPLETO.map((t) => t.nombre)).toEqual(expect.arrayContaining(['Completo', 'Italiano', 'Dinámico', 'Luco', 'As']));
  });

  it('un tipo propio se muestra con su propio nombre', () => {
    expect(buscarTipo('italiano')?.nombre).toBe('Italiano');
    expect(buscarTipo('Alemán')).toMatchObject({ nombre: 'Alemán', emoji: '✏️' });
    expect(esTipoConocido('Alemán')).toBe(false);
    expect(buscarTipo(null)).toBeUndefined();
  });

  it('normaliza: limpia el texto y veggie siempre es booleano', () => {
    const n = normalizarDatos({ ...registroVacio(d(1)), tipo_completo: '  a lo   pobre ', veggie: 'sí' as unknown as boolean });
    expect(n).toMatchObject({ tipo_completo: 'a lo pobre', veggie: false });
    expect(normalizarDatos({ ...registroVacio(d(1)), tipo_completo: '   ' }).tipo_completo).toBeNull();
  });

  it('cuenta completos por tipo y los veggie', () => {
    const rs = [
      reg(d(1), { tipo_completo: 'italiano', cantidad: 2 }),
      reg(d(2), { tipo_completo: 'italiano', veggie: true }),
      reg(d(3), { tipo_completo: 'dinamico' }),
      reg(d(4)),
      reg(d(5), { tipo_completo: 'luco', eliminado_en: '2026-11-06T00:00:00-03:00' }),
    ];
    expect(distribucionTipos(rs)).toEqual([{ tipo: 'italiano', completos: 3 }, { tipo: 'dinamico', completos: 1 }]);
    expect(completosVeggie(rs)).toBe(1);
  });

  it('el CSV trae el nombre del tipo y si es veggie', () => {
    const csv = generarCsv(calcularAcumulados([reg(d(1), { nombre_local: 'Dominó', puntuacion: 9, tipo_completo: 'dinamico', veggie: true })]));
    expect(csv).toContain(',Dominó,9,Dinámico,Sí,');
  });
});
