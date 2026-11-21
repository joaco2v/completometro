import { useMemo, useState } from 'preact/hooks';
import { calcularAcumulados } from '../../dominio/acumulado';
import { buscarEmocion, nivelHambre } from '../../dominio/emociones';
import { claveMes, nombreMes } from '../../dominio/fechas';
import { claveLocal } from '../../dominio/metricas';
import { describirLugar, type Registro, type RegistroConAcumulado } from '../../dominio/modelo';
import { datos } from '../../datos';
import { useEstado } from '../estado';
import { entero, fechaRelativa } from '../formato';
import { Foto } from '../componentes/Foto';
import { FormularioRegistro } from '../componentes/FormularioRegistro';

export function Historial() {
  const { registros, ajustes, ahora, toast } = useEstado();
  const [editando, setEditando] = useState<Registro | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const personalizadas = ajustes?.emocionesPersonalizadas ?? [];

  const grupos = useMemo(() => {
    const q = claveLocal(busqueda);
    const lista = calcularAcumulados(registros, ajustes?.contadoresIniciales)
      .reverse()
      .filter((r) => !q || claveLocal(`${r.nombre_local ?? ''} ${r.notas ?? ''}`).includes(q));
    const porMes = new Map<string, RegistroConAcumulado[]>();
    for (const r of lista) {
      const k = claveMes(new Date(r.fecha_hora));
      porMes.set(k, [...(porMes.get(k) ?? []), r]);
    }
    return [...porMes];
  }, [registros, ajustes, busqueda]);

  const eliminar = async (r: Registro) => {
    if (!confirm('¿Eliminar este completo del registro?')) return;
    await datos.repo.eliminar(r.id);
    toast('Registro eliminado');
  };

  return (
    <div class="pantalla">
      <h1>Historial</h1>
      {registros.length > 0 && (
        <input type="search" class="buscador" placeholder="Buscar local o nota…" value={busqueda} onInput={(e) => setBusqueda(e.currentTarget.value)} aria-label="Buscar" />
      )}
      {registros.length === 0 && <p class="vacio">🌭<br />Aún no hay completos registrados.</p>}
      {grupos.map(([mes, rs]) => {
        const [anio, m] = mes.split('-').map(Number);
        const total = rs.reduce((s, r) => s + r.cantidad, 0);
        return (
          <section key={mes} class="grupo-mes">
            <h2 class="titulo-mes">
              <span>{nombreMes(m - 1, true)} {anio !== ahora.getFullYear() ? anio : ''}</span>
              <span class="ayuda">{entero(total)} {total === 1 ? 'completo' : 'completos'}</span>
            </h2>
            <ul class="lista-registros">
              {rs.map((r) => {
                const emo = buscarEmocion(r.emocion, personalizadas);
                const hambre = nivelHambre(r.hambre);
                return (
                  <li key={r.id} class="item-registro">
                    <button type="button" class="item-cuerpo" onClick={() => setEditando(r)} aria-label="Editar registro">
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
                    <button type="button" class="boton-icono" onClick={() => eliminar(r)} aria-label="Eliminar">🗑️</button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {editando && <FormularioRegistro registro={editando} alCerrar={() => setEditando(null)} />}
    </div>
  );
}
