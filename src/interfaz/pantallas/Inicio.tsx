import { useMemo, useState } from 'preact/hooks';
import { resumenRapido } from '../../dominio/metricas';
import { buscarEmocion, nivelHambre } from '../../dominio/emociones';
import { anioDelBannerAnual, debeAvisarRespaldo, RESPALDO } from '../../dominio/ajustes';
import { aIsoLocal, describirLugar } from '../../dominio/modelo';
import { sumarDias } from '../../dominio/fechas';
import { datos } from '../../datos';
import { useEstado } from '../estado';
import { decimal, entero, fechaRelativa, plural } from '../formato';
import { FormularioRegistro } from '../componentes/FormularioRegistro';
import { ResumenAnualVista } from '../componentes/ResumenAnualVista';
import { BannerInstalar } from '../componentes/Instalar';
import { BotonRespaldarDrive, useDrive } from '../componentes/RespaldoDrive';
import { navegar } from '../rutas';

export function Inicio() {
  const { registros, ajustes, ahora, cargando } = useEstado();
  const [registrando, setRegistrando] = useState(false);
  const [verResumenAnual, setVerResumenAnual] = useState<number | null>(null);
  const r = useMemo(() => resumenRapido(registros, ahora, ajustes?.contadoresIniciales), [registros, ahora, ajustes]);
  const personalizadas = ajustes?.emocionesPersonalizadas ?? [];
  const emoTop = buscarEmocion(r.emocionTopMes?.id, personalizadas);
  const hambre = r.hambrePromedioSemana != null ? nivelHambre(Math.round(r.hambrePromedioSemana)) : undefined;
  const maxEmo = Math.max(1, ...r.distribucionEmocionesMes.map((e) => e.conteo));

  const drive = useDrive();
  const conDrive = drive.disponible && !!ajustes?.drive.conectado;
  // Con Drive conectado, avisa apenas haya cambios sin subir porque la sesión de Google venció.
  const avisarRespaldo = ajustes && (conDrive
    ? drive.necesitaToque && ajustes.cambiosDesdeRespaldo > 0
    : debeAvisarRespaldo(ajustes, registros.length, ahora));
  const anioBanner = ajustes ? anioDelBannerAnual(ahora, ajustes.bannerAnualCerrado) : null;

  if (cargando) return <div class="cargando">🌭</div>;

  return (
    <div class="pantalla inicio">
      {anioBanner != null && (
        <div class="banner banner-anual">
          <button type="button" class="banner-cuerpo" onClick={() => setVerResumenAnual(anioBanner)}>
            <span class="emoji-grande">🎉</span>
            <span><strong>¡Tu {anioBanner} en completos está listo!</strong><br />Míralo y compártelo en tus historias.</span>
          </button>
          <button type="button" class="boton-icono" aria-label="Cerrar" onClick={() => datos.ajustes.guardar({ bannerAnualCerrado: [...(ajustes?.bannerAnualCerrado ?? []), anioBanner] })}>✕</button>
        </div>
      )}

      {avisarRespaldo && (
        <div class="banner banner-respaldo" role="status">
          <span class="emoji-grande">💾</span>
          <div>
            <strong>{ajustes?.ultimoRespaldo ? `Tienes ${plural(ajustes.cambiosDesdeRespaldo, 'cambio', 'cambios')} sin respaldar` : 'Respalda tus completos'}</strong>
            {conDrive
              ? <p>La conexión con Google Drive expiró. Toca el botón para subir tus cambios.</p>
              : <p>Tus datos viven solo en este teléfono. Guarda una copia por si cambias de teléfono o se borra el navegador.</p>}
            <div class="acciones-banner">
              {conDrive
                ? <BotonRespaldarDrive />
                : <button type="button" class="boton boton-primario boton-chico" onClick={() => navegar('ajustes', 'respaldo')}>Respaldar ahora</button>}
              {!conDrive && (
                <button type="button" class="boton boton-chico" onClick={() => datos.ajustes.guardar({ avisoRespaldoPospuestoHasta: aIsoLocal(sumarDias(new Date(), RESPALDO.diasAlPosponer)) })}>Más tarde</button>
              )}
            </div>
          </div>
        </div>
      )}

      <section class="tarjeta contador-principal" aria-label="Total del año">
        <span class="contador-anio">Completos en {r.anio}</span>
        <span class="contador-total">{entero(r.totalAnio)}</span>
        {r.contadorInicial > 0 && <span class="ayuda">incluye {entero(r.contadorInicial)} de antes de usar la app</span>}
      </section>

      <section class="grilla-stats" aria-label="Resumen">
        <Stat valor={entero(r.hoy)} etiqueta="hoy" />
        <Stat valor={entero(r.semana)} etiqueta="esta semana" />
        <Stat valor={entero(r.mes)} etiqueta="este mes" />
        <Stat valor={decimal(r.promedioSemanal)} etiqueta="promedio semanal" />
        <Stat valor={`${entero(r.racha)} 🔥`} etiqueta={r.racha === 1 ? 'día de racha' : 'días de racha'} />
        <Stat valor={hambre?.emoji ?? '—'} etiqueta="hambre típica (7 días)" titulo={hambre?.nombre} />
      </section>

      <section class="tarjeta tarjeta-compacta" aria-label="Emociones del mes">
        <div class="fila-titulo">
          <h3>Emociones del mes</h3>
          {emoTop && <span class="ayuda">más frecuente: <strong>{emoTop.emoji} {emoTop.nombre}</strong></span>}
        </div>
        {r.distribucionEmocionesMes.length === 0 ? (
          <p class="ayuda">Aún no registras emociones este mes.</p>
        ) : (
          <ul class="mini-emociones">
            {r.distribucionEmocionesMes.slice(0, 8).map((e) => {
              const em = buscarEmocion(e.id, personalizadas)!;
              return (
                <li key={e.id} title={em.nombre}>
                  <span class="mini-emoji" aria-hidden="true">{em.emoji}</span>
                  <span class="mini-barra"><span style={{ height: `${(e.conteo / maxEmo) * 100}%` }} /></span>
                  <span class="mini-conteo" aria-label={`${em.nombre}: ${e.conteo}`}>{e.conteo}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section class="tarjeta tarjeta-compacta" aria-label="Último completo">
        {r.ultimo ? (
          <button type="button" class="ultimo" onClick={() => navegar('historial')}>
            <span class="emoji-grande" aria-hidden="true">{r.ultimo.tipo_lugar === 'local' ? '🏪' : '🏠'}</span>
            <span>
              <small>Último completo</small>
              <br />
              <strong>{describirLugar(r.ultimo)}</strong>
              {r.ultimo.cantidad > 1 && ` · ${r.ultimo.cantidad} completos`}
              {' · '}
              <span class="ayuda">{fechaRelativa(r.ultimo.fecha_hora, ahora)}</span>
            </span>
          </button>
        ) : (
          <p class="ayuda">Todavía no registras ninguno. ¡Toca el botón de abajo!</p>
        )}
      </section>

      <BannerInstalar />

      <div class="zona-registrar">
        <button type="button" class="boton-registrar" onClick={() => setRegistrando(true)}>
          <span class="boton-registrar-emoji" aria-hidden="true">🌭</span>
          <span>¡Me comí un completo!</span>
        </button>
      </div>

      {registrando && <FormularioRegistro alCerrar={() => setRegistrando(false)} />}
      {verResumenAnual != null && <ResumenAnualVista anio={verResumenAnual} alCerrar={() => setVerResumenAnual(null)} />}
    </div>
  );
}

function Stat({ valor, etiqueta, titulo }: { valor: string; etiqueta: string; titulo?: string }) {
  return (
    <div class="stat" title={titulo}>
      <span class="stat-valor">{valor}</span>
      <span class="stat-etiqueta">{etiqueta}</span>
    </div>
  );
}
