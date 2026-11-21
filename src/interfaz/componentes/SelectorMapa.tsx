import { useEffect, useRef, useState } from 'preact/hooks';
import { Modal } from './Modal';

/** Mapa con un pin arrastrable para corregir la ubicación a mano. */
export function SelectorMapa({ inicial, alElegir, alCerrar }: {
  inicial: { latitud: number; longitud: number } | null;
  alElegir: (lat: number, lon: number) => void;
  alCerrar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const posicion = useRef<[number, number] | null>(inicial ? [inicial.latitud, inicial.longitud] : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mapa: import('leaflet').Map | null = null;
    let vivo = true;
    import('./leaflet')
      .then(({ L, crearMapa, CENTRO_POR_DEFECTO, iconoCompleto }) => {
        if (!vivo || !ref.current) return;
        const centro = posicion.current ?? CENTRO_POR_DEFECTO;
        mapa = crearMapa(ref.current, centro, posicion.current ? 17 : 12);
        posicion.current = centro;
        const pin = L.marker(centro, { draggable: true, icon: iconoCompleto() }).addTo(mapa);
        const mover = (lat: number, lng: number) => {
          posicion.current = [lat, lng];
          pin.setLatLng([lat, lng]);
        };
        pin.on('dragend', () => {
          const p = pin.getLatLng();
          mover(p.lat, p.lng);
        });
        mapa.on('click', (e: import('leaflet').LeafletMouseEvent) => mover(e.latlng.lat, e.latlng.lng));
        setTimeout(() => mapa?.invalidateSize(), 200);
      })
      .catch(() => setError('No pude cargar el mapa. Revisa tu conexión a internet.'));
    return () => {
      vivo = false;
      mapa?.remove();
    };
  }, []);

  return (
    <Modal titulo="¿Dónde te lo comiste?" alCerrar={alCerrar} ancho>
      <p class="ayuda">Toca el mapa o arrastra el 🌭 hasta el lugar.</p>
      {error ? <p class="aviso aviso-error">{error}</p> : <div ref={ref} class="mapa mapa-selector" />}
      <div class="acciones">
        <button type="button" class="boton" onClick={alCerrar}>Cancelar</button>
        <button
          type="button"
          class="boton boton-primario"
          disabled={!!error}
          onClick={() => {
            if (posicion.current) alElegir(posicion.current[0], posicion.current[1]);
            alCerrar();
          }}
        >
          Usar esta ubicación
        </button>
      </div>
    </Modal>
  );
}
