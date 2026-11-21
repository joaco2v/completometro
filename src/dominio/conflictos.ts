import type { Registro } from './modelo';

/**
 * Resolución de conflictos: GANA EL ÚLTIMO CAMBIO según `actualizado_en`.
 *
 * - Si el registro no existe localmente → se agrega.
 * - Si existe y el entrante tiene `actualizado_en` más reciente → reemplaza al local (incluye borrados lógicos).
 * - Si es igual o más antiguo → se conserva el local.
 *
 * Se usa al importar un respaldo y se usará al sincronizar con un backend.
 */
export type Resolucion = 'nuevo' | 'reemplaza' | 'ignora';

export function resolverConflicto(local: Registro | undefined, entrante: Registro): Resolucion {
  if (!local) return 'nuevo';
  const tLocal = Date.parse(local.actualizado_en) || 0;
  const tEntrante = Date.parse(entrante.actualizado_en) || 0;
  return tEntrante > tLocal ? 'reemplaza' : 'ignora';
}
