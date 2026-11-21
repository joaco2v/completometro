/**
 * Dos escalas distintas:
 *  - Emoción: una característica (etiqueta). No hay emociones "mayores" ni "menores", por eso no tiene número.
 *  - Hambre: un espectro de 1 a 5, desde "nada" hasta "me comería toda la olla".
 */

export interface Emocion {
  id: string;
  emoji: string;
  nombre: string;
  personalizada?: boolean;
}

export const EMOCIONES_BASE: readonly Emocion[] = [
  { id: 'feliz', emoji: '😄', nombre: 'Feliz' },
  { id: 'tranquilo', emoji: '😌', nombre: 'Tranquilo' },
  { id: 'emocionado', emoji: '🤩', nombre: 'Emocionado' },
  { id: 'celebrando', emoji: '🥳', nombre: 'Celebrando' },
  { id: 'enamorado', emoji: '😍', nombre: 'Enamorado' },
  { id: 'cansado', emoji: '😴', nombre: 'Cansado' },
  { id: 'aburrido', emoji: '🥱', nombre: 'Aburrido' },
  { id: 'estresado', emoji: '😫', nombre: 'Estresado' },
  { id: 'triste', emoji: '😢', nombre: 'Triste' },
  { id: 'enojado', emoji: '😠', nombre: 'Enojado' },
];

export interface NivelHambre {
  nivel: number;
  emoji: string;
  nombre: string;
  /** Etiqueta corta que va bajo el emoji. */
  corto: string;
}

export const NIVELES_HAMBRE: readonly NivelHambre[] = [
  { nivel: 1, emoji: '🙂', nombre: 'Nada, por puro gusto', corto: 'Nada' },
  { nivel: 2, emoji: '😋', nombre: 'Un poquito', corto: 'Un poco' },
  { nivel: 3, emoji: '🍽️', nombre: 'Con hambre', corto: 'Con hambre' },
  { nivel: 4, emoji: '😩', nombre: 'Mucha hambre', corto: 'Mucha' },
  { nivel: 5, emoji: '🍲', nombre: 'Me comería toda la olla', corto: 'Toda la olla' },
];

export function nivelHambre(nivel: number | null | undefined): NivelHambre | undefined {
  return NIVELES_HAMBRE.find((n) => n.nivel === nivel);
}

/** Todas las emociones disponibles: las base + las que creó el usuario. */
export function todasLasEmociones(personalizadas: readonly Emocion[] = []): Emocion[] {
  return [...EMOCIONES_BASE, ...personalizadas.map((e) => ({ ...e, personalizada: true }))];
}

/** Busca una emoción por id. Si no existe (ej. personalizada borrada), devuelve una genérica. */
export function buscarEmocion(id: string | null | undefined, personalizadas: readonly Emocion[] = []): Emocion | undefined {
  if (!id) return undefined;
  return todasLasEmociones(personalizadas).find((e) => e.id === id) ?? { id, emoji: '💭', nombre: id };
}

/** Crea el id de una emoción personalizada a partir de su nombre. */
export function idEmocionPersonalizada(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `p_${base || 'emocion'}`;
}
