/**
 * Ubicación: GPS del navegador, coordenadas EXIF de la foto o pin manual.
 * Todos los errores vuelven como mensajes amables en español; nunca bloquean el registro.
 */
import type { OrigenCoordenadas } from '../dominio/modelo';
import { esAndroid, esIOS } from './plataforma';

export interface Ubicacion {
  latitud: number;
  longitud: number;
  precision_gps_m: number | null;
  origen_coordenadas: OrigenCoordenadas;
}

export type ErrorUbicacion = 'denegado' | 'no_disponible' | 'tiempo' | 'no_soportado';

export type ResultadoUbicacion = { ok: true; ubicacion: Ubicacion } | { ok: false; error: ErrorUbicacion };

/** Consulta el estado del permiso sin preguntar (Safari ≥16 y Chrome lo soportan). */
export async function estadoPermisoUbicacion(): Promise<PermissionState | 'desconocido'> {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return p?.state ?? 'desconocido';
  } catch {
    return 'desconocido';
  }
}

export function obtenerGps(timeoutMs = 15000): Promise<ResultadoUbicacion> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator) || !window.isSecureContext) {
      resolve({ ok: false, error: 'no_soportado' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        ok: true,
        ubicacion: {
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
          precision_gps_m: Math.round(pos.coords.accuracy),
          origen_coordenadas: 'gps',
        },
      }),
      (err) => resolve({
        ok: false,
        error: err.code === err.PERMISSION_DENIED ? 'denegado' : err.code === err.TIMEOUT ? 'tiempo' : 'no_disponible',
      }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** Lee las coordenadas GPS guardadas dentro de la foto. Devuelve null si no tiene. */
export async function coordenadasDeFoto(archivo: Blob): Promise<Ubicacion | null> {
  try {
    const { gps } = await import('exifr/dist/lite.esm.mjs');
    const r = await gps(archivo);
    if (!r || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return null;
    if (r.latitude === 0 && r.longitude === 0) return null;
    return { latitud: r.latitude, longitud: r.longitude, precision_gps_m: null, origen_coordenadas: 'foto_exif' };
  } catch {
    return null;
  }
}

/** Explicación para el usuario según el error y su teléfono. */
export function ayudaUbicacion(error: ErrorUbicacion): string {
  switch (error) {
    case 'denegado':
      if (esIOS) return 'La ubicación está bloqueada. En el iPhone ve a Ajustes › Privacidad y seguridad › Localización › Sitios web de Safari y elige "Al usarse". Mientras tanto, puedes marcar el lugar en el mapa.';
      if (esAndroid) return 'La ubicación está bloqueada. Toca el candado junto a la dirección (o ⋮ › Información del sitio) › Permisos › Ubicación › Permitir. Mientras tanto, puedes marcar el lugar en el mapa.';
      return 'La ubicación está bloqueada para este sitio. Actívala desde el candado junto a la dirección, o marca el lugar en el mapa.';
    case 'tiempo':
      return 'El GPS se demoró mucho. Puedes reintentar o marcar el lugar en el mapa.';
    case 'no_soportado':
      return 'Este navegador no entrega la ubicación (se necesita https). Marca el lugar en el mapa.';
    default:
      return 'No pude obtener la ubicación. Revisa que el GPS del teléfono esté activado o marca el lugar en el mapa.';
  }
}
