import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import { ProveedorEstado } from './estado';
import { navegar, useRuta, type Ruta } from './rutas';
import { Inicio } from './pantallas/Inicio';
import { Historial } from './pantallas/Historial';
import { Top } from './pantallas/Top';
import { Ajustes } from './pantallas/Ajustes';

const PESTANAS: { ruta: Ruta; icono: string; nombre: string }[] = [
  { ruta: 'inicio', icono: '🌭', nombre: 'Inicio' },
  { ruta: 'historial', icono: '📜', nombre: 'Historial' },
  { ruta: 'top', icono: '🏆', nombre: 'Top 5' },
  { ruta: 'dashboard', icono: '📊', nombre: 'Dashboard' },
  { ruta: 'ajustes', icono: '⚙️', nombre: 'Ajustes' },
];

/** El dashboard (gráficos + mapa) se carga solo cuando se abre, para que el inicio sea instantáneo. */
function DashboardPerezoso() {
  const [C, setC] = useState<FunctionComponent | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    import('./pantallas/Dashboard').then((m) => setC(() => m.default)).catch(() => setError(true));
  }, []);
  if (error) return <p class="aviso aviso-error">No pude cargar el dashboard. Recarga la app.</p>;
  return C ? <C /> : <div class="cargando">📊</div>;
}

export function App() {
  const { ruta, seccion } = useRuta();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const temporizador = useRef<number | undefined>(undefined);

  const toast = useCallback((m: string) => {
    setMensaje(m);
    clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setMensaje(null), 3500);
  }, []);

  return (
    <ProveedorEstado toast={toast}>
      <main class="contenido">
        {ruta === 'inicio' && <Inicio />}
        {ruta === 'historial' && <Historial />}
        {ruta === 'top' && <Top />}
        {ruta === 'dashboard' && <DashboardPerezoso />}
        {ruta === 'ajustes' && <Ajustes seccion={seccion} />}
      </main>
      <nav class="barra-pestanas" aria-label="Secciones">
        {PESTANAS.map((p) => (
          <button type="button" key={p.ruta} class="pestana" aria-current={ruta === p.ruta ? 'page' : undefined} onClick={() => navegar(p.ruta)}>
            <span class="pestana-icono" aria-hidden="true">{p.icono}</span>
            <span>{p.nombre}</span>
          </button>
        ))}
      </nav>
      {mensaje && <div class="toast" role="status" aria-live="polite">{mensaje}</div>}
    </ProveedorEstado>
  );
}
