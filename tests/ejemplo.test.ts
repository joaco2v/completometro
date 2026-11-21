import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLUMNAS_CSV } from '../src/datos/csv';

describe('CSV de ejemplo para Power BI', () => {
  const texto = readFileSync(new URL('../ejemplos/completos_ejemplo.csv', import.meta.url), 'utf8');
  const lineas = texto.replace(/^﻿/, '').trim().split(/\r?\n/);

  it('empieza con BOM y tiene las mismas columnas que exporta la app', () => {
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(lineas[0].split(',')).toEqual([...COLUMNAS_CSV]);
  });

  it('el acumulado es coherente con las cantidades', () => {
    const i = COLUMNAS_CSV.indexOf('numero_acumulado_anio');
    const c = COLUMNAS_CSV.indexOf('cantidad');
    let total = 0;
    for (const l of lineas.slice(1)) {
      const celdas = l.split(',');
      total += Number(celdas[c]);
      expect(Number(celdas[i])).toBe(total);
    }
  });
});
