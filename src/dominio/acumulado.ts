import type { Registro, RegistroConAcumulado } from './modelo';

/** Mapa año → completos que el usuario ya llevaba antes de usar la app. */
export type ContadoresIniciales = Record<string, number>;

export function contadorInicial(contadores: ContadoresIniciales, anio: number): number {
  const v = Number(contadores[String(anio)] ?? 0);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function anioDe(r: Pick<Registro, 'fecha_hora'>): number {
  return new Date(r.fecha_hora).getFullYear();
}

/** Ordena por fecha_hora ascendente (y por creado_en para desempatar). No modifica el arreglo original. */
export function ordenarCronologico<T extends Pick<Registro, 'fecha_hora' | 'creado_en'>>(rs: readonly T[]): T[] {
  return [...rs].sort((a, b) =>
    new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime() ||
    a.creado_en.localeCompare(b.creado_en));
}

/**
 * Calcula numero_acumulado_anio para cada registro no eliminado.
 * Cada año parte desde su contador inicial (o cero) y suma la cantidad de cada registro en orden cronológico.
 * Como se calcula al leer, editar fechas, borrar o registrar completos atrasados nunca deja números desfasados.
 * Devuelve los registros en orden cronológico.
 */
export function calcularAcumulados(rs: readonly Registro[], contadores: ContadoresIniciales = {}): RegistroConAcumulado[] {
  const porAnio = new Map<number, number>();
  return ordenarCronologico(rs.filter((r) => !r.eliminado_en)).map((r) => {
    const anio = anioDe(r);
    const previo = porAnio.get(anio) ?? contadorInicial(contadores, anio);
    const acumulado = previo + r.cantidad;
    porAnio.set(anio, acumulado);
    return { ...r, numero_acumulado_anio: acumulado };
  });
}
