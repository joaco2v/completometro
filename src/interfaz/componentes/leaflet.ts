/** Carga Leaflet bajo demanda (no pesa en el arranque de la app). */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export { L };

/** Santiago de Chile, por si no hay ninguna ubicación. */
export const CENTRO_POR_DEFECTO: [number, number] = [-33.4489, -70.6693];

export function crearMapa(el: HTMLElement, centro: [number, number], zoom: number) {
  const mapa = L.map(el, { zoomControl: true, attributionControl: true }).setView(centro, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
  return mapa;
}

export const iconoCompleto = () =>
  L.divIcon({ className: 'pin-completo', html: '<span>🌭</span>', iconSize: [40, 40], iconAnchor: [20, 36] });
