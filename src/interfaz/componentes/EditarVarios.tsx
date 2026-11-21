import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { datos } from '../../datos';
import { aplicarEdicionMasiva, edicionVacia, type EdicionMasiva } from '../../dominio/edicionMasiva';
import { NIVELES_HAMBRE, todasLasEmociones } from '../../dominio/emociones';
import { claveDia } from '../../dominio/fechas';
import { localesConocidos } from '../../dominio/metricas';
import type { PreparadoPor, TipoLugar } from '../../dominio/modelo';
import { useEstado } from '../estado';
import { plural } from '../formato';
import { BuscadorLocal } from './BuscadorLocal';
import { Modal } from './Modal';

/** Un bloque con casilla "Cambiar …": si no está marcada, ese dato no se toca. */
function Campo({ titulo, activo, alCambiar, children }: { titulo: string; activo: boolean; alCambiar: (v: boolean) => void; children: ComponentChildren }) {
  return (
    <fieldset class={`campo campo-masivo ${activo ? 'activo' : ''}`}>
      <label class="campo-check">
        <input type="checkbox" checked={activo} onChange={(e) => alCambiar(e.currentTarget.checked)} />
        <span class="etiqueta">{titulo}</span>
      </label>
      {activo && <div class="campo-masivo-cuerpo">{children}</div>}
    </fieldset>
  );
}

type Activos = Record<'cantidad' | 'lugar' | 'puntuacion' | 'emocion' | 'hambre' | 'preparado' | 'notas' | 'fecha', boolean>;

/** Editar varios registros a la vez. */
export function EditarVarios({ ids, alCerrar, alTerminar }: { ids: string[]; alCerrar: () => void; alTerminar: () => void }) {
  const { registros, ajustes, ahora, toast } = useEstado();
  const [activos, setActivos] = useState<Activos>({ cantidad: false, lugar: false, puntuacion: false, emocion: false, hambre: false, preparado: false, notas: false, fecha: false });
  const [cantidad, setCantidad] = useState(1);
  const [tipoLugar, setTipoLugar] = useState<TipoLugar>('local');
  const [nombreLocal, setNombreLocal] = useState('');
  const [coords, setCoords] = useState<{ latitud: number; longitud: number } | null>(null);
  const [puntuacion, setPuntuacion] = useState<number | null>(null);
  const [emocion, setEmocion] = useState<string | null>(null);
  const [hambre, setHambre] = useState<number | null>(null);
  const [preparadoPor, setPreparadoPor] = useState<PreparadoPor | null>(null);
  const [preparadoNombre, setPreparadoNombre] = useState('');
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState(claveDia(ahora));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const seleccionados = useMemo(() => registros.filter((r) => ids.includes(r.id)), [registros, ids]);
  const conocidos = useMemo(() => localesConocidos(registros), [registros]);
  const emociones = todasLasEmociones(ajustes?.emocionesPersonalizadas ?? []);
  const activar = (k: keyof Activos) => (v: boolean) => setActivos((a) => ({ ...a, [k]: v }));

  const edicion = (): EdicionMasiva => ({
    ...(activos.cantidad && { cantidad }),
    ...(activos.lugar && {
      lugar: { tipo_lugar: tipoLugar, nombre_local: nombreLocal, latitud: coords?.latitud ?? null, longitud: coords?.longitud ?? null },
    }),
    ...(activos.puntuacion && { puntuacion }),
    ...(activos.emocion && { emocion }),
    ...(activos.hambre && { hambre }),
    ...(activos.preparado && { preparado: { preparado_por: preparadoPor, preparado_por_nombre: preparadoNombre } }),
    ...(activos.notas && { notas: notas.trim() || null }),
    ...(activos.fecha && { fecha }),
  });

  const guardar = async () => {
    const e = edicion();
    if (edicionVacia(e)) return setError('Marca al menos un dato para cambiar.');
    setError(null);
    setGuardando(true);
    try {
      const n = await datos.repo.actualizarVarios(ids, (r) => aplicarEdicionMasiva(r, e));
      toast(`✏️ ${plural(n, 'registro actualizado', 'registros actualizados')}`);
      alTerminar();
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={`Editar ${plural(seleccionados.length, 'registro', 'registros')}`} alCerrar={alCerrar}>
      <div class="formulario">
        <p class="ayuda">Marca solo lo que quieres cambiar. Lo que no marques queda igual en cada registro.</p>

        <Campo titulo="Cambiar dónde fue" activo={activos.lugar} alCambiar={activar('lugar')}>
          <div class="segmentado">
            <button type="button" aria-pressed={tipoLugar === 'local'} onClick={() => setTipoLugar('local')}>🏪 Local establecido</button>
            <button type="button" aria-pressed={tipoLugar === 'otro'} onClick={() => setTipoLugar('otro')}>🏠 En casa u otro lugar</button>
          </div>
          {tipoLugar === 'local' && (
            <>
              <BuscadorLocal
                valor={nombreLocal}
                conocidos={conocidos}
                cerca={coords}
                alEscribir={(n) => { setNombreLocal(n); setCoords(null); }}
                alElegirLugar={(l) => { setNombreLocal(l.nombre); setCoords({ latitud: l.latitud, longitud: l.longitud }); }}
              />
              <span class="ayuda">{coords ? '📍 También se usará la ubicación de este local.' : 'Si lo dejas vacío, cada registro conserva su nombre de local.'}</span>
            </>
          )}
        </Campo>

        <Campo titulo="Cambiar la nota del completo" activo={activos.puntuacion} alCambiar={activar('puntuacion')}>
          <div class="chips chips-nota">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button type="button" key={n} class="chip" aria-pressed={puntuacion === n} onClick={() => setPuntuacion(puntuacion === n ? null : n)}>{n}</button>
            ))}
          </div>
          <span class="ayuda">{puntuacion == null ? 'Sin elegir: se quita la nota.' : `Todos quedarán con ${puntuacion}/10.`}</span>
        </Campo>

        <Campo titulo="Cambiar la emoción" activo={activos.emocion} alCambiar={activar('emocion')}>
          <div class="chips">
            {emociones.map((em) => (
              <button type="button" key={em.id} class="chip" aria-pressed={emocion === em.id} onClick={() => setEmocion(emocion === em.id ? null : em.id)}>
                <span aria-hidden="true">{em.emoji}</span> {em.nombre}
              </button>
            ))}
          </div>
          {emocion == null && <span class="ayuda">Sin elegir: se quita la emoción.</span>}
        </Campo>

        <Campo titulo="Cambiar el hambre" activo={activos.hambre} alCambiar={activar('hambre')}>
          <div class="escala-hambre">
            {NIVELES_HAMBRE.map((h) => (
              <button type="button" key={h.nivel} aria-pressed={hambre === h.nivel} aria-label={h.nombre} onClick={() => setHambre(hambre === h.nivel ? null : h.nivel)}>
                <span class="emoji-grande" aria-hidden="true">{h.emoji}</span>
                <span class="hambre-texto" aria-hidden="true">{h.corto}</span>
              </button>
            ))}
          </div>
          {hambre == null && <span class="ayuda">Sin elegir: se quita el hambre.</span>}
        </Campo>

        <Campo titulo="Cambiar quién lo preparó" activo={activos.preparado} alCambiar={activar('preparado')}>
          <div class="segmentado">
            <button type="button" aria-pressed={preparadoPor === 'yo'} onClick={() => setPreparadoPor(preparadoPor === 'yo' ? null : 'yo')}>🙋 Yo</button>
            <button type="button" aria-pressed={preparadoPor === 'otra_persona'} onClick={() => setPreparadoPor(preparadoPor === 'otra_persona' ? null : 'otra_persona')}>🧑‍🍳 Otra persona</button>
          </div>
          {preparadoPor === 'otra_persona' && (
            <input type="text" value={preparadoNombre} maxLength={60} placeholder="¿Quién? (opcional)" aria-label="Nombre de quien lo preparó" onInput={(e) => setPreparadoNombre(e.currentTarget.value)} />
          )}
          <span class="ayuda">Solo se aplica a los registros que son "en casa u otro lugar".</span>
        </Campo>

        <Campo titulo="Cambiar la cantidad" activo={activos.cantidad} alCambiar={activar('cantidad')}>
          <div class="contador">
            <button type="button" class="boton-redondo" onClick={() => setCantidad(Math.max(1, cantidad - 1))} disabled={cantidad <= 1} aria-label="Uno menos">−</button>
            <output class="contador-valor">{cantidad}</output>
            <button type="button" class="boton-redondo" onClick={() => setCantidad(Math.min(50, cantidad + 1))} aria-label="Uno más">+</button>
          </div>
        </Campo>

        <Campo titulo="Mover a otro día" activo={activos.fecha} alCambiar={activar('fecha')}>
          <input type="date" value={fecha} max={claveDia(ahora)} onInput={(e) => e.currentTarget.value && setFecha(e.currentTarget.value)} />
          <span class="ayuda">Cada registro conserva su hora.</span>
        </Campo>

        <Campo titulo="Cambiar las notas" activo={activos.notas} alCambiar={activar('notas')}>
          <textarea rows={2} maxLength={500} value={notas} placeholder="Déjalo vacío para borrar las notas" onInput={(e) => setNotas(e.currentTarget.value)} />
        </Campo>

        {error && <p class="aviso aviso-error" role="alert">{error}</p>}
        <div class="pie-formulario">
          <button type="button" class="boton boton-primario boton-grande" disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : `Aplicar a ${plural(seleccionados.length, 'registro', 'registros')}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
