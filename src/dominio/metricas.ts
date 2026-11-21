/**
 * Métricas del Completómetro: funciones PURAS (sin DOM, sin IndexedDB).
 * Reciben registros + "ahora" y devuelven números. Se usan en el resumen rápido, el dashboard y el resumen anual.
 *
 * Convenciones:
 *  - "Completos" = suma de `cantidad`. "Ocasiones" = número de registros.
 *  - La distribución de emociones cuenta ocasiones (cada registro es un momento con una emoción).
 *  - Los registros eliminados (eliminado_en) se ignoran siempre.
 *  - Semanas de lunes a domingo, en hora local.
 */
import type { Registro } from './modelo';
import { anioDe, contadorInicial, type ContadoresIniciales } from './acumulado';
import { claveDia, claveMes, claveSemana, inicioDia, inicioMes, inicioSemana, sumarDias } from './fechas';

export type Periodo = 'semana' | 'mes';

const vivos = (rs: readonly Registro[]) => rs.filter((r) => !r.eliminado_en);
const fechaDe = (r: Registro) => new Date(r.fecha_hora);
const sumar = (rs: readonly Registro[]) => rs.reduce((s, r) => s + r.cantidad, 0);

export function registrosDelAnio(rs: readonly Registro[], anio: number): Registro[] {
  return vivos(rs).filter((r) => anioDe(r) === anio);
}

/** Completos entre [desde, hasta). */
export function completosEntre(rs: readonly Registro[], desde: Date, hasta: Date): number {
  const a = desde.getTime();
  const b = hasta.getTime();
  return sumar(vivos(rs).filter((r) => {
    const t = fechaDe(r).getTime();
    return t >= a && t < b;
  }));
}

/** Total del año, incluyendo el contador inicial. */
export function totalAnio(rs: readonly Registro[], anio: number, contadores: ContadoresIniciales = {}): number {
  return contadorInicial(contadores, anio) + sumar(registrosDelAnio(rs, anio));
}

/** Días transcurridos del año hasta "ahora" (incluye hoy). Si el año ya terminó, el año completo. */
export function diasTranscurridos(anio: number, ahora: Date): number {
  const inicio = new Date(anio, 0, 1);
  const fin = new Date(anio + 1, 0, 1);
  const hasta = ahora < fin ? sumarDias(inicioDia(ahora), 1) : fin;
  if (hasta <= inicio) return 0;
  return Math.round((hasta.getTime() - inicio.getTime()) / 86_400_000);
}

/** Promedio de completos por semana en el año (incluye contador inicial). */
export function promedioSemanal(rs: readonly Registro[], anio: number, ahora: Date, contadores: ContadoresIniciales = {}): number {
  const semanas = Math.max(1, diasTranscurridos(anio, ahora) / 7);
  return totalAnio(rs, anio, contadores) / semanas;
}

function diasConCompletos(rs: readonly Registro[]): Set<string> {
  return new Set(vivos(rs).filter((r) => r.cantidad > 0).map((r) => claveDia(fechaDe(r))));
}

/**
 * Racha actual: días seguidos comiendo completos.
 * Se cuenta HASTA AYER, para que no se corte mientras aún puedes registrar el de hoy.
 * Si hoy ya registraste, hoy también suma.
 */
export function rachaActual(rs: readonly Registro[], ahora: Date): number {
  const dias = diasConCompletos(rs);
  let cursor = dias.has(claveDia(ahora)) ? inicioDia(ahora) : sumarDias(inicioDia(ahora), -1);
  let racha = 0;
  while (dias.has(claveDia(cursor))) {
    racha++;
    cursor = sumarDias(cursor, -1);
  }
  return racha;
}

/** Racha más larga dentro de un año. */
export function rachaMasLarga(rs: readonly Registro[], anio: number): number {
  const dias = [...diasConCompletos(registrosDelAnio(rs, anio))].sort();
  let mejor = 0;
  let actual = 0;
  let anterior: string | null = null;
  for (const d of dias) {
    if (anterior) {
      const [y, m, dd] = anterior.split('-').map(Number);
      const siguiente = claveDia(new Date(y, m - 1, dd + 1));
      actual = siguiente === d ? actual + 1 : 1;
    } else {
      actual = 1;
    }
    mejor = Math.max(mejor, actual);
    anterior = d;
  }
  return mejor;
}

export interface ConteoEmocion {
  id: string;
  conteo: number;
}

/** Distribución de emociones (ocasiones), de mayor a menor. Registros sin emoción no cuentan. */
export function distribucionEmociones(rs: readonly Registro[]): ConteoEmocion[] {
  const m = new Map<string, number>();
  for (const r of vivos(rs)) if (r.emocion) m.set(r.emocion, (m.get(r.emocion) ?? 0) + 1);
  return [...m].map(([id, conteo]) => ({ id, conteo })).sort((a, b) => b.conteo - a.conteo || a.id.localeCompare(b.id));
}

export function emocionMasFrecuente(rs: readonly Registro[]): ConteoEmocion | null {
  return distribucionEmociones(rs)[0] ?? null;
}

/** Promedio del nivel de hambre (1–5) de los registros que lo tienen. null si no hay datos. */
export function hambrePromedio(rs: readonly Registro[]): number | null {
  const con = vivos(rs).filter((r) => r.hambre != null);
  if (!con.length) return null;
  return con.reduce((s, r) => s + (r.hambre as number), 0) / con.length;
}

export function entre(rs: readonly Registro[], desde: Date, hasta: Date): Registro[] {
  return vivos(rs).filter((r) => {
    const t = fechaDe(r).getTime();
    return t >= desde.getTime() && t < hasta.getTime();
  });
}

export function ultimoRegistro(rs: readonly Registro[]): Registro | null {
  let ultimo: Registro | null = null;
  for (const r of vivos(rs)) if (!ultimo || fechaDe(r) > fechaDe(ultimo)) ultimo = r;
  return ultimo;
}

export interface ResumenRapido {
  anio: number;
  totalAnio: number;
  contadorInicial: number;
  hoy: number;
  semana: number;
  mes: number;
  promedioSemanal: number;
  racha: number;
  emocionTopMes: ConteoEmocion | null;
  distribucionEmocionesMes: ConteoEmocion[];
  hambrePromedioSemana: number | null;
  ultimo: Registro | null;
}

/** Todo lo que muestra la pantalla de inicio, de una vez. */
export function resumenRapido(rs: readonly Registro[], ahora: Date, contadores: ContadoresIniciales = {}): ResumenRapido {
  const anio = ahora.getFullYear();
  const manana = sumarDias(inicioDia(ahora), 1);
  const delMes = entre(rs, inicioMes(ahora), manana);
  const ultimos7 = entre(rs, sumarDias(inicioDia(ahora), -6), manana);
  return {
    anio,
    totalAnio: totalAnio(rs, anio, contadores),
    contadorInicial: contadorInicial(contadores, anio),
    hoy: completosEntre(rs, inicioDia(ahora), manana),
    semana: completosEntre(rs, inicioSemana(ahora), manana),
    mes: sumar(delMes),
    promedioSemanal: promedioSemanal(rs, anio, ahora, contadores),
    racha: rachaActual(rs, ahora),
    emocionTopMes: emocionMasFrecuente(delMes),
    distribucionEmocionesMes: distribucionEmociones(delMes),
    hambrePromedioSemana: hambrePromedio(ultimos7),
    ultimo: ultimoRegistro(rs),
  };
}

export interface PuntoSerie {
  clave: string;
  /** Inicio del periodo (lunes o día 1). */
  desde: Date;
  completos: number;
  ocasiones: number;
  hambrePromedio: number | null;
  emociones: Record<string, number>;
}

/**
 * Serie por semana o por mes para los gráficos del dashboard.
 * Cubre desde el inicio del año hasta "ahora" (o el año completo si ya pasó), incluyendo periodos en cero.
 * El contador inicial NO se reparte en la serie (no sabemos en qué semanas ocurrió).
 */
export function seriePorPeriodo(rs: readonly Registro[], anio: number, periodo: Periodo, ahora: Date): PuntoSerie[] {
  const delAnio = registrosDelAnio(rs, anio);
  const finAnio = new Date(anio, 11, 31);
  const limite = ahora < finAnio ? ahora : finAnio;
  const puntos: PuntoSerie[] = [];
  const indice = new Map<string, PuntoSerie>();
  const clave = periodo === 'mes' ? claveMes : claveSemana;

  let cursor = periodo === 'mes' ? new Date(anio, 0, 1) : inicioSemana(new Date(anio, 0, 1));
  while (cursor <= limite) {
    const p: PuntoSerie = { clave: clave(cursor), desde: cursor, completos: 0, ocasiones: 0, hambrePromedio: null, emociones: {} };
    puntos.push(p);
    indice.set(p.clave, p);
    cursor = periodo === 'mes' ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) : sumarDias(cursor, 7);
  }

  const hambre = new Map<string, number[]>();
  for (const r of delAnio) {
    const p = indice.get(clave(fechaDe(r)));
    if (!p) continue;
    p.completos += r.cantidad;
    p.ocasiones += 1;
    if (r.emocion) p.emociones[r.emocion] = (p.emociones[r.emocion] ?? 0) + 1;
    if (r.hambre != null) hambre.set(p.clave, [...(hambre.get(p.clave) ?? []), r.hambre]);
  }
  for (const p of puntos) {
    const hs = hambre.get(p.clave);
    p.hambrePromedio = hs?.length ? hs.reduce((a, b) => a + b, 0) / hs.length : null;
  }
  return puntos;
}

export interface LocalRanking {
  nombre: string;
  visitas: number;
  completos: number;
  puntuacionPromedio: number | null;
  ultimaVisita: string;
}

/** Normaliza el nombre de un local para agrupar ("Dominó", "domino ", "DOMINO" → "domino"). */
export function claveLocal(nombre: string): string {
  return nombre.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

/** Ranking de locales establecidos: más completos primero; empata por puntuación. */
export function rankingLocales(rs: readonly Registro[]): LocalRanking[] {
  const grupos = new Map<string, { nombre: string; visitas: number; completos: number; notas: number[]; ultima: string }>();
  for (const r of vivos(rs)) {
    if (r.tipo_lugar !== 'local' || !r.nombre_local) continue;
    const k = claveLocal(r.nombre_local);
    const g = grupos.get(k) ?? { nombre: r.nombre_local, visitas: 0, completos: 0, notas: [], ultima: r.fecha_hora };
    g.visitas++;
    g.completos += r.cantidad;
    if (r.puntuacion != null) g.notas.push(r.puntuacion);
    if (new Date(r.fecha_hora) >= new Date(g.ultima)) {
      g.ultima = r.fecha_hora;
      g.nombre = r.nombre_local; // se muestra el nombre escrito más recientemente
    }
    grupos.set(k, g);
  }
  return [...grupos.values()]
    .map((g) => ({
      nombre: g.nombre,
      visitas: g.visitas,
      completos: g.completos,
      puntuacionPromedio: g.notas.length ? g.notas.reduce((a, b) => a + b, 0) / g.notas.length : null,
      ultimaVisita: g.ultima,
    }))
    .sort((a, b) => b.completos - a.completos || (b.puntuacionPromedio ?? 0) - (a.puntuacionPromedio ?? 0) || a.nombre.localeCompare(b.nombre));
}

/** Nombres de locales ya usados, para autocompletar (el más reciente primero). */
export function localesConocidos(rs: readonly Registro[]): string[] {
  const vistos = new Map<string, { nombre: string; t: number }>();
  for (const r of vivos(rs)) {
    if (!r.nombre_local) continue;
    const k = claveLocal(r.nombre_local);
    const t = new Date(r.fecha_hora).getTime();
    const v = vistos.get(k);
    if (!v || t > v.t) vistos.set(k, { nombre: r.nombre_local, t });
  }
  return [...vistos.values()].sort((a, b) => b.t - a.t).map((v) => v.nombre);
}

export interface ResumenAnual {
  anio: number;
  total: number;
  contadorInicial: number;
  ocasiones: number;
  diasConCompletos: number;
  rachaMasLarga: number;
  promedioSemanal: number;
  mesTop: { mes: number; completos: number } | null;
  diaTop: { fecha: string; completos: number } | null;
  localFavorito: LocalRanking | null;
  mejorPuntuado: LocalRanking | null;
  lugaresDistintos: number;
  emocionTop: ConteoEmocion | null;
  hambrePromedio: number | null;
  conFoto: number;
}

/** Datos del "resumen del año" (para compartir en redes a fin de año). */
export function resumenAnual(rs: readonly Registro[], anio: number, ahora: Date, contadores: ContadoresIniciales = {}): ResumenAnual {
  const delAnio = registrosDelAnio(rs, anio);
  const porMes = new Map<number, number>();
  const porDia = new Map<string, number>();
  for (const r of delAnio) {
    const f = fechaDe(r);
    porMes.set(f.getMonth(), (porMes.get(f.getMonth()) ?? 0) + r.cantidad);
    porDia.set(claveDia(f), (porDia.get(claveDia(f)) ?? 0) + r.cantidad);
  }
  const mesTop = [...porMes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const diaTop = [...porDia].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const ranking = rankingLocales(delAnio);
  const puntuados = ranking.filter((l) => l.puntuacionPromedio != null)
    .sort((a, b) => (b.puntuacionPromedio as number) - (a.puntuacionPromedio as number) || b.visitas - a.visitas);
  return {
    anio,
    total: totalAnio(rs, anio, contadores),
    contadorInicial: contadorInicial(contadores, anio),
    ocasiones: delAnio.length,
    diasConCompletos: porDia.size,
    rachaMasLarga: rachaMasLarga(rs, anio),
    promedioSemanal: promedioSemanal(rs, anio, ahora, contadores),
    mesTop: mesTop ? { mes: mesTop[0], completos: mesTop[1] } : null,
    diaTop: diaTop ? { fecha: diaTop[0], completos: diaTop[1] } : null,
    localFavorito: ranking[0] ?? null,
    mejorPuntuado: puntuados[0] ?? null,
    lugaresDistintos: ranking.length,
    emocionTop: emocionMasFrecuente(delAnio),
    hambrePromedio: hambrePromedio(delAnio),
    conFoto: delAnio.filter((r) => r.foto_id).length,
  };
}

/** Años con datos (más el actual), de más reciente a más antiguo. */
export function aniosConDatos(rs: readonly Registro[], ahora: Date): number[] {
  const s = new Set(vivos(rs).map(anioDe));
  s.add(ahora.getFullYear());
  return [...s].sort((a, b) => b - a);
}
