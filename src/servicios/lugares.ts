/**
 * Sugerencias de locales mientras se escribe, con datos de OpenStreetMap (servicio Photon de Komoot).
 * Gratis y sin cuenta. Se priorizan los lugares cercanos a la ubicación actual.
 * Política de uso de Photon: uso razonable; por eso se espera a 3 letras y a que dejes de escribir.
 */

export interface LugarSugerido {
  nombre: string;
  /** "Av. Providencia 1234, Providencia" */
  direccion: string;
  latitud: number;
  longitud: number;
}

interface RespuestaPhoton {
  features: {
    geometry: { coordinates: [number, number] };
    properties: {
      name?: string;
      street?: string;
      housenumber?: string;
      district?: string;
      locality?: string;
      city?: string;
      osm_key?: string;
      osm_value?: string;
    };
  }[];
}

/** Tipos de lugar de OpenStreetMap donde puede haber completos. */
const ETIQUETAS = [
  'amenity:fast_food', 'amenity:restaurant', 'amenity:cafe', 'amenity:food_court',
  'amenity:bar', 'amenity:pub', 'amenity:ice_cream', 'shop:bakery', 'shop:deli', 'shop:convenience',
];

export function armarUrl(texto: string, cerca?: { latitud: number; longitud: number } | null): string {
  const q = new URLSearchParams({ q: texto, limit: '6' });
  for (const e of ETIQUETAS) q.append('osm_tag', e);
  if (cerca) {
    q.set('lat', cerca.latitud.toFixed(4));
    q.set('lon', cerca.longitud.toFixed(4));
  }
  return `https://photon.komoot.io/api/?${q}`;
}

export function convertir(r: RespuestaPhoton): LugarSugerido[] {
  const vistos = new Set<string>();
  const lugares: LugarSugerido[] = [];
  for (const f of r.features ?? []) {
    const p = f.properties;
    if (!p.name) continue;
    const calle = [p.street, p.housenumber].filter(Boolean).join(' ');
    const comuna = p.district ?? p.locality ?? p.city;
    const direccion = [calle, comuna && comuna !== calle ? comuna : null].filter(Boolean).join(', ');
    const clave = `${p.name}|${direccion}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    lugares.push({ nombre: p.name, direccion, latitud: f.geometry.coordinates[1], longitud: f.geometry.coordinates[0] });
  }
  return lugares;
}

/** Santiago: punto de referencia si no hay ubicación (la app es chilena). */
const REFERENCIA = { latitud: -33.4489, longitud: -70.6693 };

/** Distancia aproximada en km (suficiente para ordenar). */
export function distanciaKm(a: { latitud: number; longitud: number }, b: { latitud: number; longitud: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitud - a.latitud) * rad;
  const dLon = (b.longitud - a.longitud) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitud * rad) * Math.cos(b.latitud * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Busca locales, los más cercanos primero. Devuelve [] si no hay internet o falla (nunca bloquea el registro). */
export async function buscarLugares(texto: string, cerca: { latitud: number; longitud: number } | null, senal?: AbortSignal): Promise<LugarSugerido[]> {
  if (texto.trim().length < 3 || !navigator.onLine) return [];
  const centro = cerca ?? REFERENCIA;
  try {
    const r = await fetch(armarUrl(texto.trim(), centro), { signal: senal });
    if (!r.ok) return [];
    return convertir((await r.json()) as RespuestaPhoton)
      .map((l) => ({ l, d: distanciaKm(centro, l) }))
      .sort((a, b) => a.d - b.d)
      .map(({ l }) => l);
  } catch {
    return [];
  }
}
