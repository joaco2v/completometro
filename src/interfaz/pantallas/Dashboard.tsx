import { useMemo, useState } from 'preact/hooks';
import { aniosConDatos, completosVeggie, distribucionTipos, rankingLocales, registrosDelAnio, resumenAnual, seriePorPeriodo, type Periodo } from '../../dominio/metricas';
import { buscarTipo } from '../../dominio/tipos';
import { buscarEmocion, nivelHambre } from '../../dominio/emociones';
import { etiquetaPeriodo } from '../../dominio/fechas';
import { datos } from '../../datos';
import { useEstado } from '../estado';
import { decimal, entero } from '../formato';
import { Grafico } from '../componentes/Grafico';
import { MapaPuntos } from '../componentes/MapaPuntos';
import { ResumenAnualVista } from '../componentes/ResumenAnualVista';

export default function Dashboard() {
  const { registros, ajustes, ahora } = useEstado();
  const anios = useMemo(() => aniosConDatos(registros, ahora), [registros, ahora]);
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [verResumen, setVerResumen] = useState(false);
  const periodo: Periodo = ajustes?.periodoGraficos ?? 'mes';
  const personalizadas = ajustes?.emocionesPersonalizadas ?? [];

  const delAnio = useMemo(() => registrosDelAnio(registros, anio), [registros, anio]);
  const resumen = useMemo(() => resumenAnual(registros, anio, ahora, ajustes?.contadoresIniciales), [registros, anio, ahora, ajustes]);
  const serie = useMemo(() => seriePorPeriodo(registros, anio, periodo, ahora), [registros, anio, periodo, ahora]);
  const ranking = useMemo(() => rankingLocales(delAnio), [delAnio]);
  const tipos = useMemo(() => distribucionTipos(delAnio), [delAnio]);
  const veggie = useMemo(() => completosVeggie(delAnio), [delAnio]);
  const maxTipo = Math.max(1, ...tipos.map((t) => t.completos));
  const etiquetas = serie.map((p) => etiquetaPeriodo(p.clave));

  // Emociones por periodo: semanas → últimas 12; meses → todos.
  const serieEmo = periodo === 'semana' ? serie.slice(-12) : serie;
  const idsEmo = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const p of serieEmo) for (const [id, c] of Object.entries(p.emociones)) conteo.set(id, (conteo.get(id) ?? 0) + c);
    return [...conteo].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [serieEmo]);
  const maxCelda = Math.max(1, ...serieEmo.flatMap((p) => Object.values(p.emociones)));
  const maxRanking = Math.max(1, ...ranking.map((l) => l.completos));
  const hayHambre = serie.some((p) => p.hambrePromedio != null);
  const nombrePeriodo = periodo === 'semana' ? 'semana' : 'mes';

  return (
    <div class="pantalla dashboard">
      <div class="fila-titulo">
        <h1>Dashboard</h1>
        {anios.length > 1 && (
          <select value={anio} onChange={(e) => setAnio(Number(e.currentTarget.value))} aria-label="Año">
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      <section class="tarjeta contador-principal">
        <span class="contador-anio">Total {anio}</span>
        <span class="contador-total">{entero(resumen.total)}</span>
        <div class="grilla-stats grilla-stats-chica">
          <div class="stat"><span class="stat-valor">{entero(resumen.diasConCompletos)}</span><span class="stat-etiqueta">días con completo</span></div>
          <div class="stat"><span class="stat-valor">{decimal(resumen.promedioSemanal)}</span><span class="stat-etiqueta">por semana</span></div>
          <div class="stat"><span class="stat-valor">{entero(resumen.rachaMasLarga)}</span><span class="stat-etiqueta">racha récord</span></div>
        </div>
        <button type="button" class="boton boton-chico" onClick={() => setVerResumen(true)}>🎉 Ver mi resumen del año</button>
      </section>

      <div class="segmentado" role="group" aria-label="Agrupar gráficos">
        {(['semana', 'mes'] as const).map((p) => (
          <button type="button" key={p} aria-pressed={periodo === p} onClick={() => datos.ajustes.guardar({ periodoGraficos: p })}>
            {p === 'semana' ? 'Por semana' : 'Por mes'}
          </button>
        ))}
      </div>

      <section class="tarjeta">
        <h3>Completos por {nombrePeriodo}</h3>
        <Grafico nombre={`Completos por ${nombrePeriodo}`} tipo="barras" etiquetas={etiquetas} valores={serie.map((p) => p.completos)} />
        {resumen.contadorInicial > 0 && <p class="ayuda">Los {entero(resumen.contadorInicial)} completos de antes de usar la app no aparecen aquí porque no tienen fecha.</p>}
      </section>

      <section class="tarjeta">
        <h3>Hambre promedio por {nombrePeriodo}</h3>
        {hayHambre ? (
          <Grafico
            nombre={`Hambre promedio por ${nombrePeriodo}`}
            tipo="linea"
            etiquetas={etiquetas}
            valores={serie.map((p) => p.hambrePromedio)}
            min={0.5}
            max={5.5}
            marcasY={[1, 2, 3, 4, 5]}
            formatoY={(v) => (Number.isInteger(v) ? nivelHambre(v)?.emoji ?? '' : '')}
          />
        ) : <p class="ayuda">Registra tu nivel de hambre para ver este gráfico.</p>}
      </section>

      <section class="tarjeta">
        <h3>Emociones por {nombrePeriodo}{periodo === 'semana' && <small> (últimas 12)</small>}</h3>
        {idsEmo.length === 0 ? <p class="ayuda">Aún no hay emociones registradas.</p> : (
          <div class="tabla-desliza">
            <table class="mapa-calor">
              <thead>
                <tr>
                  <th />
                  {serieEmo.map((p) => <th key={p.clave} scope="col">{etiquetaPeriodo(p.clave)}</th>)}
                </tr>
              </thead>
              <tbody>
                {idsEmo.map((id) => {
                  const em = buscarEmocion(id, personalizadas)!;
                  return (
                    <tr key={id}>
                      <th scope="row" title={em.nombre}>{em.emoji} <span class="solo-ancho">{em.nombre}</span></th>
                      {serieEmo.map((p) => {
                        const c = p.emociones[id] ?? 0;
                        return (
                          <td key={p.clave} style={{ '--intensidad': c / maxCelda } as Record<string, number>} title={`${em.nombre}, ${etiquetaPeriodo(p.clave)}: ${c}`}>
                            {c || ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section class="tarjeta">
        <div class="fila-titulo">
          <h3>Tipos de completo</h3>
          {veggie > 0 && <span class="pastilla pastilla-veggie">🌱 {entero(veggie)} veggie</span>}
        </div>
        {tipos.length === 0 ? <p class="ayuda">Elige el tipo de completo al registrar (italiano, dinámico…) para ver cuáles comes más.</p> : (
          <ul class="barras-tipos">
            {tipos.map((t) => {
              const info = buscarTipo(t.tipo)!;
              return (
                <li key={t.tipo}>
                  <span class="barra-etiqueta"><span aria-hidden="true">{info.emoji}</span> {info.nombre}</span>
                  <span class="barra"><span style={{ width: `${(t.completos / maxTipo) * 100}%` }} /></span>
                  <span class="barra-valor">{entero(t.completos)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section class="tarjeta">
        <h3>Mapa de completos</h3>
        {delAnio.some((r) => r.latitud != null) ? <MapaPuntos registros={delAnio} /> : <p class="ayuda">Cuando registres completos con ubicación, aparecerán aquí.</p>}
      </section>

      <section class="tarjeta">
        <h3>Ranking de locales</h3>
        {ranking.length === 0 ? <p class="ayuda">Registra completos en locales establecidos para armar tu ranking.</p> : (
          <ol class="ranking">
            {ranking.slice(0, 10).map((l, i) => (
              <li key={l.nombre}>
                <span class="ranking-pos">{i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`}</span>
                <span class="ranking-cuerpo">
                  <span class="ranking-nombre">{l.nombre}</span>
                  <span class="barra"><span style={{ width: `${(l.completos / maxRanking) * 100}%` }} /></span>
                  <span class="ayuda">
                    {entero(l.completos)} {l.completos === 1 ? 'completo' : 'completos'} · {entero(l.visitas)} {l.visitas === 1 ? 'visita' : 'visitas'}
                    {l.puntuacionPromedio != null && ` · ⭐ ${decimal(l.puntuacionPromedio)}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {verResumen && <ResumenAnualVista anio={anio} alCerrar={() => setVerResumen(false)} />}
    </div>
  );
}
