/**
 * Tipos de completo más conocidos en Chile.
 * Se guarda el `id`; si la persona escribe uno propio ("Otro"), se guarda ese texto tal cual.
 */
export interface TipoCompleto {
  id: string;
  emoji: string;
  nombre: string;
  descripcion: string;
}

export const TIPOS_COMPLETO: readonly TipoCompleto[] = [
  { id: 'completo', emoji: '🌭', nombre: 'Completo', descripcion: 'tomate, chucrut y mayo' },
  { id: 'italiano', emoji: '🇮🇹', nombre: 'Italiano', descripcion: 'tomate, palta y mayo' },
  { id: 'dinamico', emoji: '⚡', nombre: 'Dinámico', descripcion: 'de todo un poco: tomate, palta, mayo, chucrut, salsa americana…' },
  { id: 'luco', emoji: '🧀', nombre: 'Luco', descripcion: 'con queso derretido' },
  { id: 'as', emoji: '🥩', nombre: 'As', descripcion: 'con carne en vez de vienesa' },
  { id: 'chacarero', emoji: '🫛', nombre: 'Chacarero', descripcion: 'porotos verdes, tomate y ají verde' },
  { id: 'especial', emoji: '🥄', nombre: 'Especial', descripcion: 'solo con mayo' },
  { id: 'vienesa', emoji: '🌭', nombre: 'Vienesa sola', descripcion: 'pan y vienesa, sin agregados' },
];

/** Busca el tipo por id. Si es un texto propio, devuelve un tipo genérico con ese nombre. */
export function buscarTipo(valor: string | null | undefined): TipoCompleto | undefined {
  if (!valor) return undefined;
  return TIPOS_COMPLETO.find((t) => t.id === valor) ?? { id: valor, emoji: '✏️', nombre: valor, descripcion: '' };
}

export const esTipoConocido = (valor: string | null | undefined) => !!valor && TIPOS_COMPLETO.some((t) => t.id === valor);
