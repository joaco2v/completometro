import { useEffect, useState } from 'preact/hooks';
import { alCambiarInstalable, esAndroid, esInstalada, esIOS, instalar, puedeInstalarDirecto } from '../../servicios/plataforma';

function useInstalable() {
  const [, refrescar] = useState(0);
  useEffect(() => alCambiarInstalable(() => refrescar((n) => n + 1)), []);
  return { instalada: esInstalada(), directo: puedeInstalarDirecto() };
}

/** Pasos para instalar según el teléfono. */
export function PasosInstalar() {
  const { instalada, directo } = useInstalable();
  if (instalada) return <p>✅ La app ya está instalada en este dispositivo.</p>;
  return (
    <div class="pasos">
      {directo && <button type="button" class="boton boton-primario" onClick={instalar}>📲 Instalar ahora</button>}
      {esIOS ? (
        <ol>
          <li>Abre esta página en <strong>Safari</strong>.</li>
          <li>Toca el botón <strong>Compartir</strong> (cuadrado con flecha ↑).</li>
          <li>Elige <strong>"Agregar a pantalla de inicio"</strong> y luego <strong>Agregar</strong>.</li>
        </ol>
      ) : (
        <ol>
          <li>Abre esta página en <strong>Chrome</strong>.</li>
          <li>Toca el menú <strong>⋮</strong> (arriba a la derecha).</li>
          <li>Elige <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla principal"</strong>.</li>
        </ol>
      )}
      <p class="ayuda">Instalada, la app abre como cualquier otra, funciona sin internet y el navegador cuida mejor tus datos.</p>
    </div>
  );
}

/** Banner discreto en el inicio si la app no está instalada. */
export function BannerInstalar() {
  const { instalada, directo } = useInstalable();
  const [cerrado, setCerrado] = useState(() => {
    try { return localStorage.getItem('banner-instalar-cerrado') === '1'; } catch { return false; }
  });
  if (instalada || cerrado || (!directo && !esIOS && !esAndroid)) return null;
  const cerrar = () => {
    setCerrado(true);
    try { localStorage.setItem('banner-instalar-cerrado', '1'); } catch { /* sin almacenamiento */ }
  };
  return (
    <div class="banner banner-instalar">
      <span class="emoji-grande">📲</span>
      <div>
        <strong>Instala el Completómetro</strong>
        <p>{directo ? 'Queda en tu pantalla de inicio y funciona sin internet.' : esIOS ? 'Safari: Compartir ↑ › "Agregar a pantalla de inicio".' : 'Chrome: menú ⋮ › "Instalar app".'}</p>
        {directo && <button type="button" class="boton boton-primario boton-chico" onClick={instalar}>Instalar</button>}
      </div>
      <button type="button" class="boton-icono" aria-label="Cerrar" onClick={cerrar}>✕</button>
    </div>
  );
}
