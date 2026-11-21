import type { FunctionComponent } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { datos } from '../../datos';
import { claveLocal, totalAnio } from '../../dominio/metricas';
import { aIsoLocal } from '../../dominio/modelo';
import type { ResenaLocal } from '../../dominio/resenas';
import { locales, mover, puntosCalor, rankingPorNota, TAMANO_TOP, topPersonalizado, type LocalTop } from '../../dominio/top';
import { dibujarPlantillaFavorito, dibujarTop5 } from '../../servicios/imagenTicket';
import { useEstado } from '../estado';
import { decimal, entero, fechaRelativa } from '../formato';
import { BuscadorLocal } from '../componentes/BuscadorLocal';
import { Modal } from '../componentes/Modal';
import { VistaImagen } from '../componentes/VistaImagen';
import type { PuntoCalor } from '../componentes/MapaCalor';

const MEDALLAS = ['🥇', '🥈', '🥉'];

export function Top() {
  const { registros, resenas, ajustes, ahora, toast } = useEstado();
  const [calificando, setCalificando] = useState<ResenaLocal | 'nueva' | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [imagen, setImagen] = useState<'top' | 'favorito' | null>(null);

  const modo = ajustes?.modoTop ?? 'auto';
  const auto = useMemo(() => rankingPorNota(registros, resenas), [registros, resenas]);
  const todos = useMemo(() => locales(registros, resenas), [registros, resenas]);
  const nombres = ajustes?.topPersonalizado ?? [];
  const top = modo === 'auto' ? auto.slice(0, TAMANO_TOP) : topPersonalizado(nombres, registros, resenas);
  const misResenas = useMemo(() => [...resenas].sort((a, b) => b.fecha.localeCompare(a.fecha)), [resenas]);
  const calor = useMemo(() => puntosCalor(registros), [registros]);

  if (!ajustes) return null;

  const guardarLista = (lista: string[]) => datos.ajustes.guardar({ topPersonalizado: lista.slice(0, TAMANO_TOP) });

  const cambiarModo = async (m: 'auto' | 'personalizado') => {
    if (m === 'personalizado' && !nombres.length) {
      await datos.ajustes.guardar({ modoTop: m, topPersonalizado: auto.slice(0, TAMANO_TOP).map((l) => l.nombre) });
    } else {
      await datos.ajustes.guardar({ modoTop: m });
    }
  };

  const eliminarResena = async (r: ResenaLocal) => {
    if (!confirm(`¿Borrar tu reseña de ${r.nombre_local}?`)) return;
    await datos.resenas.eliminar(r.id);
    toast('Reseña eliminada');
  };

  return (
    <div class="pantalla top">
      <h1>Mi top 5</h1>

      <div class="segmentado" role="group" aria-label="Cómo se arma el top">
        <button type="button" aria-pressed={modo === 'auto'} onClick={() => cambiarModo('auto')}>⭐ Según mis notas</button>
        <button type="button" aria-pressed={modo === 'personalizado'} onClick={() => cambiarModo('personalizado')}>✍️ Personalizado</button>
      </div>
      <p class="ayuda">
        {modo === 'auto'
          ? 'Ordenado por la nota promedio de cada local (tus completos y tus reseñas). Si empatan, gana el que más visitas.'
          : 'Tú eliges el orden. Útil si todavía tienes pocos datos.'}
      </p>

      <section class="tarjeta">
        {top.length === 0 ? (
          <p class="ayuda">
            {modo === 'auto'
              ? 'Aún no tienes locales con nota. Ponle nota a tus completos, califica un local abajo o arma tu top a mano.'
              : 'Agrega hasta 5 locales a tu top.'}
          </p>
        ) : (
          <ol class="lista-top">
            {top.map((l, i) => (
              <li key={l.clave}>
                <span class="top-pos">{MEDALLAS[i] ?? `${i + 1}.`}</span>
                <span class="top-cuerpo">
                  <strong>{l.nombre}</strong>
                  <span class="ayuda">{detalleLocal(l)}</span>
                </span>
                {modo === 'personalizado' ? (
                  <span class="top-acciones">
                    <button type="button" class="boton-icono" aria-label="Subir" disabled={i === 0} onClick={() => guardarLista(mover(top.map((x) => x.nombre), i, i - 1))}>▲</button>
                    <button type="button" class="boton-icono" aria-label="Bajar" disabled={i === top.length - 1} onClick={() => guardarLista(mover(top.map((x) => x.nombre), i, i + 1))}>▼</button>
                    <button type="button" class="boton-icono" aria-label="Quitar del top" onClick={() => guardarLista(top.filter((_, j) => j !== i).map((x) => x.nombre))}>✕</button>
                  </span>
                ) : (
                  l.nota != null && <span class="top-nota">{decimal(l.nota)}</span>
                )}
              </li>
            ))}
          </ol>
        )}
        {modo === 'auto' && top.length > 0 && top.length < TAMANO_TOP && (
          <p class="ayuda">Te faltan {TAMANO_TOP - top.length} para completar el top: califica más locales o usa el modo personalizado.</p>
        )}
        {modo === 'personalizado' && top.length < TAMANO_TOP && (
          <button type="button" class="boton boton-bloque" onClick={() => setAgregando(true)}>＋ Agregar local al top</button>
        )}
        <button type="button" class="boton boton-primario boton-bloque" onClick={() => setImagen('top')}>📲 Compartir mi top 5</button>
      </section>

      <section class="tarjeta">
        <div class="fila-titulo">
          <h3>Calificar un local</h3>
          <button type="button" class="boton boton-chico" onClick={() => setCalificando('nueva')}>＋ Calificar</button>
        </div>
        <p class="ayuda">Ponle nota a un local sin registrar un completo. Cuenta para tu top, pero no suma al contador.</p>
        {misResenas.length > 0 && (
          <ul class="lista-simple">
            {misResenas.map((r) => (
              <li key={r.id}>
                <button type="button" class="enlace-fila" onClick={() => setCalificando(r)}>
                  <strong>{r.nombre_local}</strong> <span class="pastilla">⭐ {r.puntuacion}/10</span>
                  <br />
                  <small class="ayuda">{r.comentario ? `${r.comentario} · ` : ''}{fechaRelativa(r.fecha, ahora)}</small>
                </button>
                <button type="button" class="boton-icono" aria-label={`Borrar reseña de ${r.nombre_local}`} onClick={() => eliminarResena(r)}>🗑️</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="tarjeta">
        <h3>¿Dónde comes más completos?</h3>
        {calor.length ? <MapaCalorPerezoso puntos={calor} /> : <p class="ayuda">Cuando registres completos con ubicación, aquí verás tu mapa de calor.</p>}
      </section>

      <section class="tarjeta plantillas">
        <h3>Plantillas para historias</h3>
        <p class="ayuda">Imágenes estilo boleta para compartir en Instagram.</p>
        <div class="plantillas-botones">
          <button type="button" class="boton" onClick={() => setImagen('top')}>🧾 Mi top 5</button>
          <button type="button" class="boton" onClick={() => setImagen('favorito')}>⭐ Mi completo favorito</button>
        </div>
      </section>

      {todos.length > TAMANO_TOP && (
        <details class="tarjeta">
          <summary><strong>Todos tus locales ({todos.length})</strong></summary>
          <ol class="lista-top lista-top-completa">
            {[...auto, ...todos.filter((l) => l.nota == null)].map((l, i) => (
              <li key={l.clave}>
                <span class="top-pos">{i + 1}.</span>
                <span class="top-cuerpo"><strong>{l.nombre}</strong><span class="ayuda">{detalleLocal(l)}</span></span>
                {l.nota != null && <span class="top-nota">{decimal(l.nota)}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}

      {calificando && (
        <FormularioResena
          existente={calificando === 'nueva' ? null : calificando}
          conocidos={todos.map((l) => l.nombre)}
          alCerrar={() => setCalificando(null)}
        />
      )}
      {agregando && (
        <AgregarAlTop
          opciones={todos.filter((l) => !top.some((t) => t.clave === l.clave)).map((l) => l.nombre)}
          alAgregar={(n) => {
            if (top.some((t) => t.clave === claveLocal(n))) return;
            guardarLista([...top.map((t) => t.nombre), n]);
            setAgregando(false);
          }}
          alCerrar={() => setAgregando(false)}
        />
      )}
      {imagen === 'top' && (
        <VistaImagen
          titulo="Mi top 5"
          generar={() => dibujarTop5(top, { completosAnio: totalAnio(registros, ahora.getFullYear(), ajustes.contadoresIniciales), localesProbados: todos.length })}
          textoCompartir={`Mi top 5 de completos 🌭 ${top.map((l, i) => `${i + 1}. ${l.nombre}`).join(' · ')}`}
          ayuda={top.length < TAMANO_TOP ? 'Los puestos vacíos quedan con una línea para que los completes en Instagram.' : undefined}
          alCerrar={() => setImagen(null)}
        />
      )}
      {imagen === 'favorito' && (
        <VistaImagen
          titulo="Mi completo favorito"
          generar={() => dibujarPlantillaFavorito()}
          textoCompartir="Mi completo favorito 🌭"
          ayuda="En Instagram, pon tu foto en el recuadro con el sticker de foto, escribe encima de las líneas y etiqueta al local en 'Dónde'."
          alCerrar={() => setImagen(null)}
        />
      )}
    </div>
  );
}

function detalleLocal(l: LocalTop): string {
  const partes = [
    l.nota != null ? `⭐ ${decimal(l.nota)}` : 'sin nota',
    l.visitas ? `${entero(l.visitas)} ${l.visitas === 1 ? 'visita' : 'visitas'}` : null,
    l.completos ? `${entero(l.completos)} ${l.completos === 1 ? 'completo' : 'completos'}` : null,
    l.resenado ? 'reseñado' : null,
  ];
  return partes.filter(Boolean).join(' · ');
}

/** El mapa de calor (Leaflet) se carga solo cuando se ve. */
function MapaCalorPerezoso({ puntos }: { puntos: PuntoCalor[] }) {
  const [C, setC] = useState<FunctionComponent<{ puntos: PuntoCalor[] }> | null>(null);
  useEffect(() => {
    import('../componentes/MapaCalor').then((m) => setC(() => m.MapaCalor)).catch(() => undefined);
  }, []);
  return C ? <C puntos={puntos} /> : <div class="mapa cargando-mapa">🗺️</div>;
}

function FormularioResena({ existente, conocidos, alCerrar }: { existente: ResenaLocal | null; conocidos: string[]; alCerrar: () => void }) {
  const { toast } = useEstado();
  const [nombre, setNombre] = useState(existente?.nombre_local ?? '');
  const [nota, setNota] = useState<number | null>(existente?.puntuacion ?? null);
  const [comentario, setComentario] = useState(existente?.comentario ?? '');
  const [coords, setCoords] = useState<{ latitud: number; longitud: number } | null>(
    existente?.latitud != null && existente.longitud != null ? { latitud: existente.latitud, longitud: existente.longitud } : null,
  );
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: Event) => {
    e.preventDefault();
    if (!nota) return setError('Elige una nota del 1 al 10.');
    try {
      await datos.resenas.guardar({
        nombre_local: nombre,
        puntuacion: nota,
        latitud: coords?.latitud ?? null,
        longitud: coords?.longitud ?? null,
        comentario,
        fecha: aIsoLocal(new Date()),
      });
      toast(`⭐ ${nombre.trim()} calificado con ${nota}/10`);
      alCerrar();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal titulo={existente ? 'Editar calificación' : 'Calificar un local'} alCerrar={alCerrar}>
      <form class="formulario" onSubmit={guardar}>
        <div class="campo">
          <label class="etiqueta" for="nombre-local">Local</label>
          <BuscadorLocal
            valor={nombre}
            conocidos={conocidos}
            cerca={coords}
            alEscribir={(n) => { setNombre(n); setCoords(null); }}
            alElegirLugar={(l) => { setNombre(l.nombre); setCoords({ latitud: l.latitud, longitud: l.longitud }); }}
          />
          {coords && <span class="ayuda">📍 Ubicación del local guardada</span>}
        </div>
        <fieldset class="campo">
          <legend class="etiqueta">Nota del local {nota != null && <strong>{nota}/10</strong>}</legend>
          <div class="chips chips-nota">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button type="button" key={n} class="chip" aria-pressed={nota === n} onClick={() => setNota(nota === n ? null : n)}>{n}</button>
            ))}
          </div>
        </fieldset>
        <label class="campo">
          <span class="etiqueta">Comentario <small>(opcional)</small></span>
          <textarea rows={2} maxLength={300} value={comentario} onInput={(e) => setComentario(e.currentTarget.value)} placeholder="Ej: el mejor italiano de Providencia" />
        </label>
        <p class="ayuda">No suma al contador de completos: es solo tu opinión del local.</p>
        {error && <p class="aviso aviso-error" role="alert">{error}</p>}
        <button type="submit" class="boton boton-primario boton-grande" disabled={!nombre.trim()}>Guardar calificación</button>
      </form>
    </Modal>
  );
}

function AgregarAlTop({ opciones, alAgregar, alCerrar }: { opciones: string[]; alAgregar: (nombre: string) => void; alCerrar: () => void }) {
  const [nombre, setNombre] = useState('');
  return (
    <Modal titulo="Agregar al top" alCerrar={alCerrar}>
      <div class="formulario">
        {opciones.length > 0 && (
          <div class="campo">
            <span class="etiqueta">Tus locales</span>
            <div class="chips">
              {opciones.slice(0, 15).map((o) => <button type="button" key={o} class="chip" onClick={() => alAgregar(o)}>{o}</button>)}
            </div>
          </div>
        )}
        <div class="campo">
          <label class="etiqueta" for="nombre-local">Otro local</label>
          <BuscadorLocal valor={nombre} conocidos={[]} cerca={null} alEscribir={setNombre} alElegirLugar={(l) => setNombre(l.nombre)} />
        </div>
        <button type="button" class="boton boton-primario boton-grande" disabled={!nombre.trim()} onClick={() => alAgregar(nombre.trim())}>Agregar</button>
      </div>
    </Modal>
  );
}
