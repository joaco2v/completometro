import { useEffect, useRef } from 'preact/hooks';
import type { Map as MapaLeaflet } from 'leaflet';
import { CENTRO_POR_DEFECTO, crearMapa, L } from './leaflet';

export interface PuntoCalor {
  latitud: number;
  longitud: number;
  peso: number;
}

/** Colores del calor: palta → amarillo → naranja → tomate. */
const PARADAS: [number, string][] = [[0.25, '#4f8a1f'], [0.5, '#f3a712'], [0.75, '#e4572e'], [1, '#c8102e']];

function paleta(): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  for (const [p, color] of PARADAS) g.addColorStop(p, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

/**
 * Capa de calor propia (sin dependencias): dibuja manchas difusas por punto en un canvas,
 * suma su intensidad y la colorea con la paleta. Se redibuja al mover o hacer zoom.
 * Con cientos de puntos es instantánea.
 */
function crearCapaCalor(puntos: PuntoCalor[]) {
  const colores = paleta();
  const max = Math.max(1, ...puntos.map((p) => p.peso));
  let canvas: HTMLCanvasElement;
  let mapa: MapaLeaflet;

  const dibujar = () => {
    const tam = mapa.getSize();
    const origen = mapa.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, origen);
    canvas.width = tam.x;
    canvas.height = tam.y;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, tam.x, tam.y);
    const radio = Math.max(18, Math.min(45, 6 * (mapa.getZoom() - 8)));
    for (const p of puntos) {
      const { x, y } = mapa.latLngToContainerPoint([p.latitud, p.longitud]);
      if (x < -radio || y < -radio || x > tam.x + radio || y > tam.y + radio) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radio);
      const a = Math.max(0.12, Math.min(1, p.peso / max));
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - radio, y - radio, radio * 2, radio * 2);
    }
    if (!tam.x || !tam.y) return;
    const img = ctx.getImageData(0, 0, tam.x, tam.y);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) {
      const alfa = d[i];
      if (!alfa) continue;
      const j = alfa * 4;
      d[i - 3] = colores[j];
      d[i - 2] = colores[j + 1];
      d[i - 1] = colores[j + 2];
      d[i] = Math.min(230, alfa * 1.6);
    }
    ctx.putImageData(img, 0, 0);
  };

  const Capa = L.Layer.extend({
    onAdd(m: MapaLeaflet) {
      mapa = m;
      canvas = L.DomUtil.create('canvas', 'capa-calor') as HTMLCanvasElement;
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      m.getPanes().overlayPane.appendChild(canvas);
      m.on('moveend zoomend resize', dibujar);
      m.on('zoomstart', () => (canvas.style.opacity = '0'));
      m.on('zoomend', () => (canvas.style.opacity = '1'));
      dibujar();
      return this;
    },
    onRemove(m: MapaLeaflet) {
      m.off('moveend zoomend resize', dibujar);
      canvas.remove();
      return this;
    },
  });
  return new Capa();
}

/** Mapa de calor: dónde has comido más completos. */
export function MapaCalor({ puntos }: { puntos: PuntoCalor[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const mapa = crearMapa(ref.current, CENTRO_POR_DEFECTO, 12);
    if (puntos.length) {
      const limites = L.latLngBounds(puntos.map((p) => [p.latitud, p.longitud] as [number, number]));
      mapa.fitBounds(limites.pad(0.15), { maxZoom: 15 });
    }
    const capa = crearCapaCalor(puntos);
    capa.addTo(mapa);
    const t = setTimeout(() => mapa.invalidateSize(), 200);
    return () => {
      clearTimeout(t);
      mapa.remove();
    };
  }, [puntos]);
  return <div ref={ref} class="mapa" />;
}

export default MapaCalor;
