import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { datos } from '../../datos';
import { aIsoLocal, registroVacio, type DatosRegistro, type Registro } from '../../dominio/modelo';
import { idEmocionPersonalizada, NIVELES_HAMBRE, todasLasEmociones } from '../../dominio/emociones';
import { localesConocidos, totalAnio } from '../../dominio/metricas';
import { ayudaUbicacion, coordenadasDeFoto, obtenerGps, type ErrorUbicacion, type Ubicacion } from '../../servicios/ubicacion';
import { comprimirFoto } from '../../servicios/imagen';
import { pedirAlmacenamientoPersistente } from '../../servicios/archivos';
import { renovarSesionSiHaceFalta } from '../../servicios/respaldoDrive';
import { useEstado } from '../estado';
import { aInputFecha, entero, fechaRelativa } from '../formato';
import { Modal } from './Modal';
import { SelectorMapa } from './SelectorMapa';
import { BuscadorLocal } from './BuscadorLocal';
import { SelectorTipo } from './SelectorTipo';
import { useUrlFoto } from './Foto';

type EstadoUbicacion = { tipo: 'buscando' } | { tipo: 'lista' } | { tipo: 'error'; error: ErrorUbicacion } | { tipo: 'nada' };

const PRIORIDAD: Record<string, number> = { gps: 1, foto_exif: 2, manual: 3 };

export function FormularioRegistro({ registro, alCerrar }: { registro?: Registro; alCerrar: () => void }) {
  const { registros, ajustes, toast } = useEstado();
  const editando = !!registro;
  const [d, setD] = useState<DatosRegistro>(() => (registro ? { ...registro } : registroVacio()));
  const [ubic, setUbic] = useState<EstadoUbicacion>(registro?.latitud != null ? { tipo: 'lista' } : { tipo: editando ? 'nada' : 'buscando' });
  const [fotoNueva, setFotoNueva] = useState<Blob | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [verMapa, setVerMapa] = useState(false);
  /** La ubicación vino de un local sugerido (OpenStreetMap). */
  const [desdeLocal, setDesdeLocal] = useState(false);
  const [cambiarFecha, setCambiarFecha] = useState(false);
  const [verNotas, setVerNotas] = useState(!!registro?.notas);
  const [nuevaEmocion, setNuevaEmocion] = useState<{ emoji: string; nombre: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const emociones = todasLasEmociones(ajustes?.emocionesPersonalizadas ?? []);
  const sugerencias = useMemo(() => localesConocidos(registros), [registros]);
  const set = (c: Partial<DatosRegistro>) => setD((x) => ({ ...x, ...c }));

  /** Aplica una ubicación solo si no pisa una de mayor prioridad (manual > foto > gps). */
  const aplicarUbicacion = (u: Ubicacion) => {
    setD((x) => {
      if (x.origen_coordenadas && x.latitud != null && PRIORIDAD[x.origen_coordenadas] > PRIORIDAD[u.origen_coordenadas]) return x;
      return { ...x, ...u };
    });
    setUbic({ tipo: 'lista' });
  };

  const buscarGps = async () => {
    setUbic({ tipo: 'buscando' });
    const r = await obtenerGps();
    if (r.ok) aplicarUbicacion(r.ubicacion);
    else setUbic((u) => (u.tipo === 'lista' ? u : { tipo: 'error', error: r.error }));
  };

  // Al abrir un registro nuevo, la ubicación se busca sola.
  useEffect(() => {
    if (!editando) buscarGps();
  }, []);

  const urlFotoGuardada = useUrlFoto(!quitarFoto && !fotoNueva ? registro?.foto_id : null);
  const [urlFotoNueva, setUrlFotoNueva] = useState<string | null>(null);
  useEffect(() => {
    if (!fotoNueva) return setUrlFotoNueva(null);
    const u = URL.createObjectURL(fotoNueva);
    setUrlFotoNueva(u);
    return () => URL.revokeObjectURL(u);
  }, [fotoNueva]);
  const urlFoto = urlFotoNueva ?? urlFotoGuardada;

  const alElegirFoto = async (archivo: File | undefined) => {
    if (!archivo) return;
    setProcesandoFoto(true);
    setError(null);
    try {
      // 1° el GPS de la foto (antes de comprimir, que borra los metadatos)
      const coords = await coordenadasDeFoto(archivo);
      if (coords) aplicarUbicacion(coords);
      setFotoNueva(await comprimirFoto(archivo));
      setQuitarFoto(false);
      if (coords) toast('📍 Ubicación tomada de la foto');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcesandoFoto(false);
      if (inputFoto.current) inputFoto.current.value = '';
    }
  };

  const agregarEmocion = async () => {
    if (!nuevaEmocion || !ajustes) return;
    const nombre = nuevaEmocion.nombre.trim();
    if (!nombre) return;
    const emoji = nuevaEmocion.emoji.trim() || '💭';
    let id = idEmocionPersonalizada(nombre);
    const existentes = todasLasEmociones(ajustes.emocionesPersonalizadas);
    const igual = existentes.find((e) => e.nombre.toLowerCase() === nombre.toLowerCase());
    if (igual) {
      set({ emocion: igual.id });
    } else {
      while (existentes.some((e) => e.id === id)) id += '_';
      await datos.ajustes.guardar({ emocionesPersonalizadas: [...ajustes.emocionesPersonalizadas, { id, emoji, nombre }] });
      set({ emocion: id });
    }
    setNuevaEmocion(null);
  };

  const guardar = async (e: Event) => {
    e.preventDefault();
    if (guardando) return;
    // Antes de cualquier await: aprovecha este toque para renovar la sesión de Google Drive si venció.
    renovarSesionSiHaceFalta();
    setGuardando(true);
    setError(null);
    let fotoCreada: string | null = null;
    try {
      let foto_id = quitarFoto ? null : d.foto_id;
      if (fotoNueva) {
        fotoCreada = await datos.fotos.guardar(fotoNueva);
        foto_id = fotoCreada;
      }
      const final = { ...d, foto_id };
      if (editando) {
        await datos.repo.actualizar(registro.id, final);
        if (registro.foto_id && registro.foto_id !== foto_id) await datos.fotos.eliminar(registro.foto_id);
        toast('Cambios guardados ✅');
      } else {
        await datos.repo.crear(final);
        const anio = new Date(final.fecha_hora).getFullYear();
        const total = totalAnio(await datos.repo.listar(), anio, ajustes?.contadoresIniciales);
        toast(`🌭 ¡Registrado! Llevas ${entero(total)} en ${anio}`);
        pedirAlmacenamientoPersistente();
      }
      alCerrar();
    } catch (err) {
      if (fotoCreada) await datos.fotos.eliminar(fotoCreada).catch(() => undefined);
      setError((err as Error).message || 'No se pudo guardar.');
      setGuardando(false);
    }
  };

  const esLocal = d.tipo_lugar === 'local';

  return (
    <Modal titulo={editando ? 'Editar completo' : 'Nuevo completo'} alCerrar={alCerrar}>
      <form class="formulario" onSubmit={guardar}>
        <div class="campo campo-fila">
          <span class="etiqueta">¿Cuántos?</span>
          <div class="contador" role="group" aria-label="Cantidad">
            <button type="button" class="boton-redondo" onClick={() => set({ cantidad: Math.max(1, d.cantidad - 1) })} disabled={d.cantidad <= 1} aria-label="Uno menos">−</button>
            <output class="contador-valor" aria-live="polite">{d.cantidad}</output>
            <button type="button" class="boton-redondo" onClick={() => set({ cantidad: Math.min(50, d.cantidad + 1) })} aria-label="Uno más">+</button>
          </div>
        </div>

        <div class="campo">
          <span class="etiqueta">¿Qué completo?</span>
          <SelectorTipo
            tipo={d.tipo_completo}
            veggie={d.veggie}
            alCambiarTipo={(tipo_completo) => set({ tipo_completo })}
            alCambiarVeggie={(veggie) => set({ veggie })}
          />
        </div>

        <fieldset class="campo">
          <legend class="etiqueta">¿Dónde?</legend>
          <div class="segmentado">
            <button type="button" aria-pressed={esLocal} onClick={() => set({ tipo_lugar: 'local' })}>🏪 Local establecido</button>
            <button type="button" aria-pressed={!esLocal} onClick={() => set({ tipo_lugar: 'otro' })}>🏠 En casa u otro lugar</button>
          </div>
        </fieldset>

        {esLocal ? (
          <div class="campo">
            <label class="etiqueta" for="nombre-local">Nombre del local</label>
            <BuscadorLocal
              valor={d.nombre_local ?? ''}
              conocidos={sugerencias}
              cerca={d.latitud != null && d.longitud != null ? { latitud: d.latitud, longitud: d.longitud } : null}
              alEscribir={(nombre) => set({ nombre_local: nombre })}
              alElegirLugar={(l) => {
                set({ nombre_local: l.nombre, latitud: l.latitud, longitud: l.longitud, precision_gps_m: null, origen_coordenadas: 'manual' });
                setDesdeLocal(true);
                setUbic({ tipo: 'lista' });
              }}
            />
          </div>
        ) : (
          <fieldset class="campo">
            <legend class="etiqueta">¿Quién lo preparó? <small>(opcional)</small></legend>
            <div class="segmentado">
              <button type="button" aria-pressed={d.preparado_por === 'yo'} onClick={() => set({ preparado_por: d.preparado_por === 'yo' ? null : 'yo' })}>🙋 Yo</button>
              <button type="button" aria-pressed={d.preparado_por === 'otra_persona'} onClick={() => set({ preparado_por: d.preparado_por === 'otra_persona' ? null : 'otra_persona' })}>🧑‍🍳 Otra persona</button>
            </div>
            {d.preparado_por === 'otra_persona' && (
              <input
                type="text"
                value={d.preparado_por_nombre ?? ''}
                onInput={(e) => set({ preparado_por_nombre: e.currentTarget.value })}
                placeholder="¿Quién? (opcional) Ej: mi mamá"
                aria-label="Nombre de quien lo preparó"
                maxLength={60}
              />
            )}
          </fieldset>
        )}

        <fieldset class="campo">
          <legend class="etiqueta">Nota del completo {d.puntuacion != null && <strong>{d.puntuacion}/10</strong>}</legend>
          <div class="chips chips-nota">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button type="button" key={n} class="chip" aria-pressed={d.puntuacion === n} onClick={() => set({ puntuacion: d.puntuacion === n ? null : n })}>{n}</button>
            ))}
          </div>
        </fieldset>

        <fieldset class="campo">
          <legend class="etiqueta">¿Cómo te sientes?</legend>
          <div class="chips chips-emocion">
            {emociones.map((em) => (
              <button type="button" key={em.id} class="chip" aria-pressed={d.emocion === em.id} onClick={() => set({ emocion: d.emocion === em.id ? null : em.id })}>
                <span aria-hidden="true">{em.emoji}</span> {em.nombre}
              </button>
            ))}
            {!nuevaEmocion && <button type="button" class="chip chip-agregar" onClick={() => setNuevaEmocion({ emoji: '', nombre: '' })}>＋ Otra</button>}
          </div>
          {nuevaEmocion && (
            <div class="nueva-emocion">
              <input type="text" class="input-emoji" value={nuevaEmocion.emoji} maxLength={8} placeholder="🫠" aria-label="Emoji"
                onInput={(e) => setNuevaEmocion({ ...nuevaEmocion, emoji: e.currentTarget.value })} />
              <input type="text" value={nuevaEmocion.nombre} maxLength={24} placeholder="Ej: Bajoneado" aria-label="Nombre de la emoción"
                onInput={(e) => setNuevaEmocion({ ...nuevaEmocion, nombre: e.currentTarget.value })}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarEmocion())} />
              <button type="button" class="boton boton-chico" onClick={agregarEmocion}>Agregar</button>
              <button type="button" class="boton-icono" onClick={() => setNuevaEmocion(null)} aria-label="Cancelar">✕</button>
            </div>
          )}
        </fieldset>

        <fieldset class="campo">
          <legend class="etiqueta">¿Cuánta hambre tenías?</legend>
          <div class="escala-hambre">
            {NIVELES_HAMBRE.map((h) => (
              <button type="button" key={h.nivel} aria-pressed={d.hambre === h.nivel} title={h.nombre} aria-label={h.nombre} onClick={() => set({ hambre: d.hambre === h.nivel ? null : h.nivel })}>
                <span class="emoji-grande" aria-hidden="true">{h.emoji}</span>
                <span class="hambre-texto" aria-hidden="true">{h.corto}</span>
              </button>
            ))}
          </div>
          {d.hambre === 5 && <p class="ayuda centrado">🍲 ¡Me comería toda la olla!</p>}
        </fieldset>

        <div class="campo">
          <span class="etiqueta">Foto del completo <small>(opcional)</small></span>
          {urlFoto ? (
            <div class="foto-previa">
              <img src={urlFoto} alt="Foto del completo" />
              <button type="button" class="boton boton-chico" onClick={() => { setFotoNueva(null); setQuitarFoto(true); }}>Quitar foto</button>
            </div>
          ) : (
            <button type="button" class="boton boton-bloque" onClick={() => inputFoto.current?.click()} disabled={procesandoFoto}>
              {procesandoFoto ? 'Procesando foto…' : '📷 Agregar foto'}
            </button>
          )}
          <input ref={inputFoto} type="file" accept="image/*" hidden onChange={(e) => alElegirFoto(e.currentTarget.files?.[0])} />
        </div>

        <div class="campo">
          <span class="etiqueta">Ubicación</span>
          <div class="ubicacion">
            {ubic.tipo === 'buscando' && <span>📡 Buscando ubicación…</span>}
            {ubic.tipo === 'lista' && d.latitud != null && (
              <span>
                📍 {d.origen_coordenadas === 'foto_exif' ? 'Desde la foto' : d.origen_coordenadas === 'manual' ? (desdeLocal ? 'Ubicación del local' : 'Marcada en el mapa') : 'GPS'}
                {d.precision_gps_m != null && <small> (±{entero(d.precision_gps_m)} m)</small>}
              </span>
            )}
            {ubic.tipo === 'nada' && <span>Sin ubicación</span>}
            {ubic.tipo === 'error' && <span>⚠️ Sin ubicación</span>}
            <span class="ubicacion-acciones">
              {ubic.tipo !== 'buscando' && <button type="button" class="enlace" onClick={buscarGps}>Usar GPS</button>}
              <button type="button" class="enlace" onClick={() => setVerMapa(true)}>Mapa</button>
              {d.latitud != null && <button type="button" class="enlace" onClick={() => { set({ latitud: null, longitud: null, precision_gps_m: null, origen_coordenadas: null }); setUbic({ tipo: 'nada' }); }}>Quitar</button>}
            </span>
          </div>
          {ubic.tipo === 'error' && <p class="ayuda">{ayudaUbicacion(ubic.error)}</p>}
        </div>

        <div class="campo">
          <span class="etiqueta">¿Cuándo?</span>
          {cambiarFecha ? (
            <input
              type="datetime-local"
              value={aInputFecha(d.fecha_hora)}
              max={aInputFecha(aIsoLocal(new Date()))}
              onInput={(e) => {
                const v = e.currentTarget.value;
                if (v) set({ fecha_hora: aIsoLocal(new Date(v)) });
              }}
            />
          ) : (
            <div class="ubicacion">
              <span>🕒 {fechaRelativa(d.fecha_hora)}</span>
              <button type="button" class="enlace" onClick={() => setCambiarFecha(true)}>Cambiar (me olvidé de anotarlo)</button>
            </div>
          )}
        </div>

        {verNotas ? (
          <label class="campo">
            <span class="etiqueta">Notas</span>
            <textarea rows={3} maxLength={500} value={d.notas ?? ''} onInput={(e) => set({ notas: e.currentTarget.value })} placeholder="Ej: con harta palta" />
          </label>
        ) : (
          <button type="button" class="enlace" onClick={() => setVerNotas(true)}>＋ Agregar una nota</button>
        )}

        {error && <p class="aviso aviso-error" role="alert">{error}</p>}

        <div class="pie-formulario">
          <button type="submit" class="boton boton-primario boton-grande" disabled={guardando || procesandoFoto}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : `Guardar ${d.cantidad > 1 ? `${d.cantidad} completos` : 'completo'} 🌭`}
          </button>
        </div>
      </form>

      {verMapa && (
        <SelectorMapa
          inicial={d.latitud != null && d.longitud != null ? { latitud: d.latitud, longitud: d.longitud } : null}
          alElegir={(lat, lon) => { setDesdeLocal(false); set({ latitud: lat, longitud: lon, precision_gps_m: null, origen_coordenadas: 'manual' }); setUbic({ tipo: 'lista' }); }}
          alCerrar={() => setVerMapa(false)}
        />
      )}
    </Modal>
  );
}
