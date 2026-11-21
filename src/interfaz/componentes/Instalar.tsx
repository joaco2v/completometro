import { useEffect, useState } from 'preact/hooks';
import { alCambiarInstalable, esAndroid, esInstalada, esIOS, instalar, puedeInstalarDirecto } from '../../servicios/plataforma';
import { navegar } from '../rutas';

function useInstalable() {
  const [, refrescar] = useState(0);
  useEffect(() => alCambiarInstalable(() => refrescar((n) => n + 1)), []);
  return { instalada: esInstalada(), directo: puedeInstalarDirecto() };
}

type Guia = 'chrome-android' | 'chrome-iphone' | 'safari';

const esChromeIOS = typeof navigator !== 'undefined' && /CriOS/.test(navigator.userAgent);

/** Qué guía mostrar primero según el teléfono y navegador. */
function guiaInicial(): Guia {
  if (esIOS) return esChromeIOS ? 'chrome-iphone' : 'safari';
  return 'chrome-android';
}

const GUIAS: { id: Guia; nombre: string }[] = [
  { id: 'chrome-android', nombre: 'Chrome · Android' },
  { id: 'chrome-iphone', nombre: 'Chrome · iPhone' },
  { id: 'safari', nombre: 'Safari · iPhone' },
];

/** Pasos para dejar la app en la pantalla de inicio, en palabras simples. */
export function PasosInstalar() {
  const { instalada, directo } = useInstalable();
  const [guia, setGuia] = useState<Guia>(guiaInicial);
  if (instalada) return <p>✅ ¡Ya la tienes instalada en este teléfono! Ábrela siempre desde el ícono 🌭.</p>;
  return (
    <div class="pasos">
      <p>Es como tener una app más, pero sin pasar por la tienda de apps. Toma menos de un minuto:</p>
      {directo && (
        <button type="button" class="boton boton-primario boton-bloque" onClick={instalar}>📲 Instalar ahora (un toque)</button>
      )}
      <div class="selector-guia" role="tablist" aria-label="Elige tu navegador">
        {GUIAS.map((g) => (
          <button type="button" role="tab" key={g.id} aria-selected={guia === g.id} onClick={() => setGuia(g.id)}>{g.nombre}</button>
        ))}
      </div>

      {guia === 'chrome-android' && (
        <ol class="pasos-lista">
          <li>Abre el link de la app en <strong>Chrome</strong>.</li>
          <li>Toca los <strong>tres puntitos ⋮</strong> que están arriba a la derecha.</li>
          <li>Busca <strong>"Agregar a la pantalla principal"</strong> (en algunos teléfonos dice <strong>"Instalar app"</strong>) y tócalo.</li>
          <li>Dale a <strong>"Instalar"</strong> o <strong>"Agregar"</strong>.</li>
          <li>¡Y listo! 🎉 Te queda el ícono del completo junto a tus otras apps.</li>
        </ol>
      )}

      {guia === 'chrome-iphone' && (
        <>
          <ol class="pasos-lista">
            <li>Abre el link de la app en <strong>Chrome</strong>.</li>
            <li>Toca el botón de <strong>compartir</strong> (el cuadradito con la flechita hacia arriba ⬆️), que está en la barra de la dirección, arriba a la derecha.</li>
            <li>Baja un poco en el menú y toca <strong>"Agregar a pantalla de inicio"</strong>.</li>
            <li>Toca <strong>"Agregar"</strong>, arriba a la derecha.</li>
            <li>¡Listo! 🎉 Ya tienes el Completómetro en tu pantalla de inicio.</li>
          </ol>
          <p class="ayuda">¿No te aparece la opción? Actualiza tu iPhone o hazlo desde Safari (pestaña de al lado).</p>
        </>
      )}

      {guia === 'safari' && (
        <>
          <ol class="pasos-lista">
            <li>Abre el link de la app en <strong>Safari</strong> (la brújula azul 🧭).</li>
            <li>Toca el botón de <strong>compartir</strong> (el cuadradito con la flechita hacia arriba ⬆️), abajo al medio. Si no lo ves, toca los <strong>tres puntitos ···</strong> de abajo y ahí aparece "Compartir".</li>
            <li>Desliza hacia abajo y toca <strong>"Agregar a pantalla de inicio"</strong>.</li>
            <li>Si aparece la opción <strong>"Abrir como app web"</strong>, déjala activada. Después toca <strong>"Agregar"</strong>.</li>
            <li>¡Listo! 🎉 Ya tienes el Completómetro en tu pantalla de inicio.</li>
          </ol>
        </>
      )}

      <div class="nota-instalar">
        <strong>💡 Importante:</strong> desde ahora ábrela siempre desde el ícono 🌭 y no desde el navegador.
        {esIOS
          ? ' En el iPhone la app instalada y el navegador guardan los datos por separado, así que lo que anotes en uno no aparece en el otro.'
          : ' Así funciona sin internet y el teléfono cuida mejor tus datos.'}
        {' '}Si ya tenías completos anotados en el navegador, respáldalos antes y luego impórtalos (o conecta Google Drive) en la app instalada.
      </div>
      <p class="ayuda">¿Usas otro navegador (Samsung Internet, Firefox, Edge…)? Copia el link y ábrelo en Chrome o Safari.</p>
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
  const resumen = directo
    ? 'Déjala en tu pantalla de inicio: abre como cualquier app y funciona sin internet.'
    : esIOS
      ? 'Toca compartir ⬆️ y luego "Agregar a pantalla de inicio".'
      : 'Toca los tres puntitos ⋮ y luego "Agregar a la pantalla principal".';
  return (
    <div class="banner banner-instalar">
      <span class="emoji-grande">📲</span>
      <div>
        <strong>Instala el Completómetro</strong>
        <p>{resumen}</p>
        <div class="acciones-banner">
          {directo && <button type="button" class="boton boton-primario boton-chico" onClick={instalar}>Instalar</button>}
          <button type="button" class="boton boton-chico" onClick={() => navegar('ajustes', 'instalar')}>Ver paso a paso</button>
        </div>
      </div>
      <button type="button" class="boton-icono" aria-label="Cerrar" onClick={cerrar}>✕</button>
    </div>
  );
}
