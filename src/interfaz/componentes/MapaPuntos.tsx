import { useEffect, useRef } from 'preact/hooks';
import type { Registro } from '../../dominio/modelo';
import { fechaRelativa } from '../formato';
import { CENTRO_POR_DEFECTO, crearMapa, L } from './leaflet';

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Mapa con un punto por cada completo con ubicación. */
export function MapaPuntos({ registros }: { registros: Registro[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const conUbicacion = registros.filter((r) => r.latitud != null && r.longitud != null);
    const mapa = crearMapa(ref.current, CENTRO_POR_DEFECTO, 11);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--rojo').trim() || '#c8102e';
    const puntos = conUbicacion.map((r) => {
      const lugar = r.nombre_local ?? (r.tipo_lugar === 'local' ? 'Local' : 'Otro lugar');
      return L.circleMarker([r.latitud!, r.longitud!], {
        radius: 6 + Math.min(6, r.cantidad - 1) * 2,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.85,
      })
        .bindPopup(`<strong>${escapar(lugar)}</strong><br>${escapar(fechaRelativa(r.fecha_hora))}${r.cantidad > 1 ? ` · ${r.cantidad} completos` : ''}`)
        .addTo(mapa);
    });
    if (puntos.length) mapa.fitBounds(L.featureGroup(puntos).getBounds().pad(0.2), { maxZoom: 15 });
    const t = setTimeout(() => mapa.invalidateSize(), 200);
    return () => {
      clearTimeout(t);
      mapa.remove();
    };
  }, [registros]);

  return <div ref={ref} class="mapa" />;
}
