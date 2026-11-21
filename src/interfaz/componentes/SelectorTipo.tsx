import { useState } from 'preact/hooks';
import { buscarTipo, esTipoConocido, TIPOS_COMPLETO } from '../../dominio/tipos';

const OTRO = '__otro__';

/** Lista desplegable con los tipos de completo + opción de escribir uno propio, y la casilla veggie. */
export function SelectorTipo({ tipo, veggie, alCambiarTipo, alCambiarVeggie }: {
  tipo: string | null;
  veggie?: boolean;
  alCambiarTipo: (t: string | null) => void;
  /** Si no se pasa, no se muestra la casilla veggie. */
  alCambiarVeggie?: (v: boolean) => void;
}) {
  const [escribiendo, setEscribiendo] = useState(!!tipo && !esTipoConocido(tipo));
  const valorSelect = escribiendo ? OTRO : tipo ?? '';
  const info = esTipoConocido(tipo) ? buscarTipo(tipo) : undefined;

  return (
    <div class="selector-tipo">
      <select
        value={valorSelect}
        aria-label="Tipo de completo"
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v === OTRO) {
            setEscribiendo(true);
            alCambiarTipo(null);
          } else {
            setEscribiendo(false);
            alCambiarTipo(v || null);
          }
        }}
      >
        <option value="">Elige el tipo (opcional)</option>
        {TIPOS_COMPLETO.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.nombre}</option>)}
        <option value={OTRO}>✏️ Otro…</option>
      </select>
      {info && <span class="ayuda">{info.descripcion}</span>}
      {escribiendo && (
        <input
          type="text"
          value={tipo ?? ''}
          maxLength={40}
          placeholder="¿Cuál? Ej: Alemán, Brasileño, A lo pobre…"
          aria-label="Nombre del tipo de completo"
          onInput={(e) => alCambiarTipo(e.currentTarget.value || null)}
        />
      )}
      {alCambiarVeggie && (
        <label class={`check-veggie ${veggie ? 'activo' : ''}`}>
          <input type="checkbox" checked={!!veggie} onChange={(e) => alCambiarVeggie(e.currentTarget.checked)} />
          <span>🌱 Veggie <small>(vienesa vegetal)</small></span>
        </label>
      )}
    </div>
  );
}
