import type { ContadoresIniciales } from './acumulado';
import type { Emocion } from './emociones';
import type { Periodo } from './metricas';

export interface Ajustes {
  /** Completos ya comidos antes de usar la app, por año: { "2026": 37 }. */
  contadoresIniciales: ContadoresIniciales;
  emocionesPersonalizadas: Emocion[];
  /** Cómo agrupar los gráficos del dashboard. */
  periodoGraficos: Periodo;
  /** Identificador de este dispositivo (para la sincronización futura). */
  dispositivo_id: string;
  /** Fecha ISO del último respaldo guardado. */
  ultimoRespaldo: string | null;
  /** Registros creados o editados desde el último respaldo. */
  cambiosDesdeRespaldo: number;
  /** Si el usuario tocó "Más tarde" en el aviso de respaldo. */
  avisoRespaldoPospuestoHasta: string | null;
  /** Años cuyo banner de resumen anual ya se cerró. */
  bannerAnualCerrado: number[];
  /** Respaldo automático en Google Drive. */
  drive: EstadoDrive;
  /** "Mi top 5": automático (según notas) o elegido a mano. */
  modoTop: 'auto' | 'personalizado';
  /** Nombres de locales del top personalizado, en orden. */
  topPersonalizado: string[];
}

export interface EstadoDrive {
  conectado: boolean;
  correo: string | null;
  /** Fecha ISO de la última sincronización exitosa. */
  ultimaSync: string | null;
}

export function ajustesPorDefecto(dispositivo_id: string): Ajustes {
  return {
    contadoresIniciales: {},
    emocionesPersonalizadas: [],
    periodoGraficos: 'mes',
    dispositivo_id,
    ultimoRespaldo: null,
    cambiosDesdeRespaldo: 0,
    avisoRespaldoPospuestoHasta: null,
    bannerAnualCerrado: [],
    drive: { conectado: false, correo: null, ultimaSync: null },
    modoTop: 'auto',
    topPersonalizado: [],
  };
}

/** Reglas del aviso de respaldo. */
export const RESPALDO = {
  primerAvisoTrasRegistros: 3,
  cambiosParaAvisar: 15,
  diasParaAvisar: 14,
  diasAlPosponer: 3,
};

/**
 * ¿Mostrar el aviso suave de respaldo?
 *  - Nunca respaldó y ya tiene al menos 3 registros.
 *  - O hay cambios sin respaldar y pasaron 14 días, o se juntaron 15 cambios.
 *  - Salvo que lo haya pospuesto.
 */
export function debeAvisarRespaldo(a: Ajustes, totalRegistros: number, ahora: Date): boolean {
  if (totalRegistros === 0 || a.cambiosDesdeRespaldo === 0) return false;
  if (a.avisoRespaldoPospuestoHasta && new Date(a.avisoRespaldoPospuestoHasta) > ahora) return false;
  if (!a.ultimoRespaldo) return totalRegistros >= RESPALDO.primerAvisoTrasRegistros;
  const dias = (ahora.getTime() - new Date(a.ultimoRespaldo).getTime()) / 86_400_000;
  return dias >= RESPALDO.diasParaAvisar || a.cambiosDesdeRespaldo >= RESPALDO.cambiosParaAvisar;
}

/** ¿Mostrar el banner del resumen anual? Desde el 31 de diciembre hasta el 10 de enero (para el año que termina). */
export function anioDelBannerAnual(ahora: Date, cerrados: readonly number[]): number | null {
  const m = ahora.getMonth();
  const d = ahora.getDate();
  let anio: number | null = null;
  if (m === 11 && d === 31) anio = ahora.getFullYear();
  else if (m === 0 && d <= 10) anio = ahora.getFullYear() - 1;
  return anio != null && !cerrados.includes(anio) ? anio : null;
}
