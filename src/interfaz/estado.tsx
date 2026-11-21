/**
 * Estado compartido de la interfaz: registros + ajustes, siempre al día.
 * Se suscribe a los cambios del repositorio, así el resumen se actualiza apenas se guarda algo.
 */
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { datos } from '../datos';
import type { Registro } from '../dominio/modelo';
import type { Ajustes } from '../dominio/ajustes';
import type { ResenaLocal } from '../dominio/resenas';

export interface EstadoApp {
  cargando: boolean;
  registros: Registro[];
  /** Reseñas de locales (sin completo). */
  resenas: ResenaLocal[];
  ajustes: Ajustes | null;
  ahora: Date;
  toast: (mensaje: string) => void;
}

const Contexto = createContext<EstadoApp | null>(null);

export function ProveedorEstado({ children, toast }: { children: ComponentChildren; toast: (m: string) => void }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [resenas, setResenas] = useState<ResenaLocal[]>([]);
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    let vivo = true;
    const cargarRegistros = () => datos.repo.listar().then((r) => vivo && setRegistros(r));
    const cargarAjustes = () => datos.ajustes.leer().then((a) => vivo && setAjustes({ ...a }));
    const cargarResenas = () => datos.resenas.listar().then((r) => vivo && setResenas(r));
    Promise.all([cargarRegistros(), cargarAjustes(), cargarResenas()])
      .catch((e) => console.error('Error al cargar datos', e))
      .finally(() => vivo && setCargando(false));
    const d1 = datos.repo.suscribir(cargarRegistros);
    const d2 = datos.ajustes.suscribir(cargarAjustes);
    const d3 = datos.resenas.suscribir(cargarResenas);
    // "Hoy" cambia a medianoche: refrescamos cada minuto y al volver a la app.
    const reloj = setInterval(() => setAhora(new Date()), 60_000);
    const alVolver = () => document.visibilityState === 'visible' && setAhora(new Date());
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      d1();
      d2();
      d3();
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  const valor = useMemo(() => ({ cargando, registros, resenas, ajustes, ahora, toast }), [cargando, registros, resenas, ajustes, ahora, toast]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useEstado(): EstadoApp {
  const c = useContext(Contexto);
  if (!c) throw new Error('useEstado fuera de ProveedorEstado');
  return c;
}
