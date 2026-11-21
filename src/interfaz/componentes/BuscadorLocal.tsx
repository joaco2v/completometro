import { useEffect, useRef, useState } from 'preact/hooks';
import { claveLocal } from '../../dominio/metricas';
import { buscarLugares, type LugarSugerido } from '../../servicios/lugares';

/**
 * Campo "Nombre del local" con sugerencias: primero los locales donde ya fuiste,
 * luego locales de OpenStreetMap cercanos. Elegir uno de OSM también fija la ubicación.
 */
export function BuscadorLocal({ valor, conocidos, cerca, alEscribir, alElegirLugar }: {
  valor: string;
  conocidos: string[];
  cerca: { latitud: number; longitud: number } | null;
  alEscribir: (nombre: string) => void;
  alElegirLugar: (lugar: LugarSugerido) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [lugares, setLugares] = useState<LugarSugerido[]>([]);
  const [buscando, setBuscando] = useState(false);
  const cerrarTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const q = claveLocal(valor);
  const propios = q ? conocidos.filter((c) => claveLocal(c).includes(q) && claveLocal(c) !== q).slice(0, 3) : conocidos.slice(0, 3);

  useEffect(() => {
    if (!abierto || valor.trim().length < 3) {
      setLugares([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarLugares(valor, cerca, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setLugares(r);
        setBuscando(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
      setBuscando(false);
    };
  }, [valor, abierto]);

  const hayAlgo = propios.length > 0 || lugares.length > 0 || buscando;

  return (
    <div class="buscador-local">
      <input
        id="nombre-local"
        type="text"
        value={valor}
        onInput={(e) => { alEscribir(e.currentTarget.value); setAbierto(true); }}
        onFocus={() => { clearTimeout(cerrarTimer.current); setAbierto(true); }}
        onBlur={() => { cerrarTimer.current = setTimeout(() => setAbierto(false), 200); }}
        onKeyDown={(e) => e.key === 'Escape' && setAbierto(false)}
        placeholder="Ej: Fuente Alemana"
        autocomplete="off"
        maxLength={80}
        role="combobox"
        aria-expanded={abierto && hayAlgo}
        aria-autocomplete="list"
        aria-controls="sugerencias-local"
      />
      {abierto && hayAlgo && (
        <ul class="sugerencias" id="sugerencias-local" role="listbox">
          {propios.map((n) => (
            <li key={`p-${n}`} role="option" aria-selected="false">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { alEscribir(n); setAbierto(false); }}>
                <span aria-hidden="true">🔁</span>
                <span><strong>{n}</strong><small>Ya fuiste</small></span>
              </button>
            </li>
          ))}
          {lugares.map((l) => (
            <li key={`o-${l.nombre}-${l.latitud}`} role="option" aria-selected="false">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { alElegirLugar(l); setAbierto(false); }}>
                <span aria-hidden="true">📍</span>
                <span><strong>{l.nombre}</strong>{l.direccion && <small>{l.direccion}</small>}</span>
              </button>
            </li>
          ))}
          {buscando && <li class="sugerencias-estado">Buscando locales…</li>}
          {lugares.length > 0 && <li class="sugerencias-estado">Datos © OpenStreetMap</li>}
        </ul>
      )}
    </div>
  );
}
