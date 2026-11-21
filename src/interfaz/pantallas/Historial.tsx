import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { calcularAcumulados } from '../../dominio/acumulado';
import { buscarEmocion, nivelHambre } from '../../dominio/emociones';
import { claveMes, nombreMes } from '../../dominio/fechas';
import { claveLocal } from '../../dominio/metricas';
import { describirLugar, type Registro, type RegistroConAcumulado } from '../../dominio/modelo';
import { datos } from '../../datos';
import { useEstado } from '../estado';
import { entero, fechaRelativa, plural } from '../formato';
import { Foto } from '../componentes/Foto';
import { FormularioRegistro } from '../componentes/FormularioRegistro';

/** Registros en la papelera (borrado lógico), siempre al día. */
function usePapelera(): Registro[] {
  const [eliminados, setEliminados] = useState<Registro[]>([]);
  useEffect(() => {
    let vivo = true;
    const cargar = () => datos.repo.listar({ incluirEliminados: true }).then((rs) => {
      if (!vivo) return;
      setEliminados(rs.filter((r) => r.eliminado_en).sort((a, b) => (b.eliminado_en ?? '').localeCompare(a.eliminado_en ?? '')));
    });
    cargar();
    const fin = datos.repo.suscribir(cargar);
    return () => { vivo = false; fin(); };
  }, []);
  return eliminados;
}

export function Historial() {
  const { registros, ajustes, ahora, toast } = useEstado();
  const [editando, setEditando] = useState<Registro | null>(null);
  const [busqueda, setBusqueda] = useState('');
  /** null = modo normal; un Set = modo "seleccionar varios". */
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);
  const [deshacer, setDeshacer] = useState<{ ids: string[]; texto: string } | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const papelera = usePapelera();
  const personalizadas = ajustes?.emocionesPersonalizadas ?? [];

  const grupos = useMemo(() => {
    const q = claveLocal(busqueda);
    const lista = calcularAcumulados(registros, ajustes?.contadoresIniciales)
      .reverse()
      .filter((r) => !q || claveLocal(`${describirLugar(r)} ${r.notas ?? ''}`).includes(q));
    const porMes = new Map<string, RegistroConAcumulado[]>();
    for (const r of lista) {
      const k = claveMes(new Date(r.fecha_hora));
      porMes.set(k, [...(porMes.get(k) ?? []), r]);
    }
    return [...porMes];
  }, [registros, ajustes, busqueda]);
  const visibles = useMemo(() => grupos.flatMap(([, rs]) => rs.map((r) => r.id)), [grupos]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const avisarDeshacer = (ids: string[], texto: string) => {
    setDeshacer({ ids, texto });
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setDeshacer(null), 10_000);
  };

  const eliminarUno = async (r: Registro) => {
    if (!confirm(`¿Eliminar este registro (${describirLugar(r)}, ${fechaRelativa(r.fecha_hora, ahora)})?`)) return;
    await datos.repo.eliminar(r.id);
    avisarDeshacer([r.id], 'Registro eliminado');
  };

  const eliminarSeleccion = async () => {
    if (!seleccion?.size) return;
    const ids = [...seleccion];
    if (!confirm(`¿Eliminar ${plural(ids.length, 'registro', 'registros')}? Podrás recuperarlos desde "Eliminados", al final del historial.`)) return;
    const n = await datos.repo.eliminarVarios(ids);
    setSeleccion(null);
    avisarDeshacer(ids, `${plural(n, 'registro eliminado', 'registros eliminados')}`);
  };

  const restaurar = async (ids: string[]) => {
    const n = await datos.repo.restaurar(ids);
    setDeshacer(null);
    toast(`↩️ ${plural(n, 'registro recuperado', 'registros recuperados')}`);
  };

  const alternar = (ids: string[]) => {
    setSeleccion((s) => {
      const nueva = new Set(s ?? []);
      const todos = ids.every((id) => nueva.has(id));
      for (const id of ids) (todos ? nueva.delete(id) : nueva.add(id));
      return nueva;
    });
  };

  const seleccionando = seleccion != null;
  const todosVisiblesMarcados = seleccionando && visibles.length > 0 && visibles.every((id) => seleccion.has(id));

  return (
    <div class={`pantalla historial ${seleccionando ? 'con-barra-seleccion' : ''}`}>
      <div class="fila-titulo">
        <h1>Historial</h1>
        {registros.length > 0 && (
          <button type="button" class="boton boton-chico" onClick={() => setSeleccion(seleccionando ? null : new Set())}>
            {seleccionando ? 'Listo' : '☑️ Seleccionar'}
          </button>
        )}
      </div>

      {deshacer && (
        <div class="banner banner-deshacer" role="status">
          <span>🗑️ {deshacer.texto}</span>
          <button type="button" class="boton boton-chico" onClick={() => restaurar(deshacer.ids)}>Deshacer</button>
        </div>
      )}

      {registros.length > 0 && (
        <input type="search" class="buscador" placeholder="Buscar local, persona o nota…" value={busqueda} onInput={(e) => setBusqueda(e.currentTarget.value)} aria-label="Buscar" />
      )}
      {seleccionando && (
        <p class="ayuda">Toca los registros que quieres seleccionar, o un mes completo.</p>
      )}
      {registros.length === 0 && <p class="vacio">🌭<br />Aún no hay completos registrados.</p>}

      {grupos.map(([mes, rs]) => {
        const [anio, m] = mes.split('-').map(Number);
        const total = rs.reduce((s, r) => s + r.cantidad, 0);
        const ids = rs.map((r) => r.id);
        const mesMarcado = seleccionando && ids.every((id) => seleccion.has(id));
        return (
          <section key={mes} class="grupo-mes">
            <h2 class="titulo-mes">
              {seleccionando ? (
                <label class="marcar-mes">
                  <input type="checkbox" checked={mesMarcado} onChange={() => alternar(ids)} />
                  <span>{nombreMes(m - 1, true)} {anio !== ahora.getFullYear() ? anio : ''}</span>
                </label>
              ) : (
                <span>{nombreMes(m - 1, true)} {anio !== ahora.getFullYear() ? anio : ''}</span>
              )}
              <span class="ayuda">{entero(total)} {total === 1 ? 'completo' : 'completos'}</span>
            </h2>
            <ul class="lista-registros">
              {rs.map((r) => {
                const emo = buscarEmocion(r.emocion, personalizadas);
                const hambre = nivelHambre(r.hambre);
                const marcado = seleccionando && seleccion.has(r.id);
                return (
                  <li key={r.id} class={`item-registro ${marcado ? 'marcado' : ''}`}>
                    <button
                      type="button"
                      class="item-cuerpo"
                      onClick={() => (seleccionando ? alternar([r.id]) : setEditando(r))}
                      aria-label={seleccionando ? (marcado ? 'Quitar de la selección' : 'Seleccionar') : 'Editar registro'}
                      aria-pressed={seleccionando ? marcado : undefined}
                    >
                      {seleccionando && <span class={`casilla ${marcado ? 'activa' : ''}`} aria-hidden="true">{marcado ? '✓' : ''}</span>}
                      <Foto fotoId={r.foto_id} clase="miniatura" />
                      <span class="item-texto">
                        <span class="item-titulo">
                          <span class="numero">#{entero(r.numero_acumulado_anio)}</span>
                          {describirLugar(r)}
                          {r.cantidad > 1 && <span class="pastilla">×{r.cantidad}</span>}
                        </span>
                        <span class="item-detalle">
                          {fechaRelativa(r.fecha_hora, ahora)}
                          {r.puntuacion != null && ` · ⭐ ${r.puntuacion}/10`}
                          {r.latitud != null && ' · 📍'}
                        </span>
                        {(emo || hambre) && (
                          <span class="item-detalle">
                            {emo && `${emo.emoji} ${emo.nombre}`}{emo && hambre && ' · '}{hambre && `${hambre.emoji} ${hambre.nombre}`}
                          </span>
                        )}
                        {r.notas && <span class="item-notas">{r.notas}</span>}
                      </span>
                    </button>
                    {!seleccionando && (
                      <span class="item-acciones">
                        <button type="button" class="boton-icono" onClick={() => setEditando(r)} aria-label="Editar">✏️</button>
                        <button type="button" class="boton-icono" onClick={() => eliminarUno(r)} aria-label="Eliminar">🗑️</button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {papelera.length > 0 && !seleccionando && (
        <details class="tarjeta papelera">
          <summary><strong>🗑️ Eliminados ({entero(papelera.length)})</strong></summary>
          <p class="ayuda">Los registros eliminados quedan aquí por si te arrepientes. No cuentan en tus estadísticas.</p>
          <button type="button" class="boton boton-chico" onClick={() => restaurar(papelera.map((r) => r.id))}>↩️ Recuperar todos</button>
          <ul class="lista-simple">
            {papelera.slice(0, 100).map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{describirLugar(r)}</strong>{r.cantidad > 1 && ` ×${r.cantidad}`}
                  <br />
                  <small class="ayuda">{fechaRelativa(r.fecha_hora, ahora)} · eliminado {fechaRelativa(r.eliminado_en!, ahora)}</small>
                </span>
                <button type="button" class="boton boton-chico" onClick={() => restaurar([r.id])}>Recuperar</button>
              </li>
            ))}
          </ul>
          {papelera.length > 100 && <p class="ayuda">Mostrando los 100 más recientes.</p>}
        </details>
      )}

      {seleccionando && (
        <div class="barra-seleccion" role="toolbar" aria-label="Acciones sobre la selección">
          <span><strong>{entero(seleccion.size)}</strong> {seleccion.size === 1 ? 'seleccionado' : 'seleccionados'}</span>
          <button type="button" class="boton boton-chico" onClick={() => setSeleccion(todosVisiblesMarcados ? new Set() : new Set(visibles))}>
            {todosVisiblesMarcados ? 'Ninguno' : 'Todos'}
          </button>
          {seleccion.size === 1 && (
            <button type="button" class="boton boton-chico" onClick={() => { setEditando(registros.find((r) => seleccion.has(r.id)) ?? null); setSeleccion(null); }}>✏️ Editar</button>
          )}
          <button type="button" class="boton boton-chico boton-peligro" disabled={!seleccion.size} onClick={eliminarSeleccion}>🗑️ Eliminar</button>
        </div>
      )}

      {editando && <FormularioRegistro registro={editando} alCerrar={() => setEditando(null)} />}
    </div>
  );
}
