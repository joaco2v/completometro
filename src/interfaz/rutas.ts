/** Navegación simple por hash (#/historial), compatible con GitHub Pages sin configuración. */
import { useEffect, useState } from 'preact/hooks';

export type Ruta = 'inicio' | 'historial' | 'top' | 'dashboard' | 'ajustes';
const RUTAS: Ruta[] = ['inicio', 'historial', 'top', 'dashboard', 'ajustes'];

function leer(): { ruta: Ruta; seccion: string | null } {
  const [r, s] = location.hash.replace(/^#\/?/, '').split('/');
  return { ruta: (RUTAS as string[]).includes(r) ? (r as Ruta) : 'inicio', seccion: s || null };
}

export function navegar(ruta: Ruta, seccion?: string) {
  location.hash = `#/${ruta === 'inicio' ? '' : ruta}${seccion ? `/${seccion}` : ''}`;
}

export function useRuta() {
  const [estado, setEstado] = useState(leer);
  useEffect(() => {
    const f = () => {
      setEstado(leer());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return estado;
}
