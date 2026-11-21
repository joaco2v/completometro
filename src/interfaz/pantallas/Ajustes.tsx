import { useEffect, useRef, useState } from 'preact/hooks';
import { datos } from '../../datos';
import { exportarRespaldoJson, exportarZip, importarArchivo } from '../../datos/respaldo';
import { contadorInicial } from '../../dominio/acumulado';
import { aIsoLocal } from '../../dominio/modelo';
import { compartirODescargar, descargar, estadoAlmacenamiento, pedirAlmacenamientoPersistente } from '../../servicios/archivos';
import { esIOS } from '../../servicios/plataforma';
import { config } from '../../config';
import { useEstado } from '../estado';
import { entero, fechaRelativa, plural } from '../formato';
import { PasosInstalar } from '../componentes/Instalar';

export function Ajustes({ seccion }: { seccion: string | null }) {
  const { ajustes, registros, ahora, toast } = useEstado();
  const anio = ahora.getFullYear();
  const [inicial, setInicial] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [almacen, setAlmacen] = useState<Awaited<ReturnType<typeof estadoAlmacenamiento>> | null>(null);
  const [pendientes, setPendientes] = useState<number | null>(null);
  const inputImportar = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ajustes) setInicial(String(contadorInicial(ajustes.contadoresIniciales, anio) || ''));
  }, [ajustes?.contadoresIniciales, anio]);

  useEffect(() => {
    estadoAlmacenamiento().then(setAlmacen);
    datos.outbox.contar().then(setPendientes);
  }, [registros]);

  useEffect(() => {
    if (seccion) setTimeout(() => document.getElementById(seccion)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [seccion]);

  if (!ajustes) return null;

  const guardarInicial = async () => {
    const n = Math.max(0, Math.floor(Number(inicial) || 0));
    await datos.ajustes.guardar({ contadoresIniciales: { ...ajustes.contadoresIniciales, [anio]: n } });
    toast(n ? `Listo: partes con ${entero(n)} completos en ${anio}` : 'Contador inicial en cero');
  };

  const marcarRespaldo = () => datos.ajustes.guardar({ ultimoRespaldo: aIsoLocal(new Date()), cambiosDesdeRespaldo: 0, avisoRespaldoPospuestoHasta: null });

  const conOcupado = async (clave: string, f: () => Promise<void>) => {
    setOcupado(clave);
    try {
      await f();
    } catch (e) {
      toast(`⚠️ ${(e as Error).message || 'Algo falló'}`);
    } finally {
      setOcupado(null);
    }
  };

  const respaldarCompartiendo = () => conOcupado('compartir', async () => {
    const archivo = await exportarRespaldoJson(datos);
    const r = await compartirODescargar(archivo, 'Respaldo Completómetro', 'Respaldo de mis completos 🌭');
    if (r === 'cancelado') return;
    await marcarRespaldo();
    await pedirAlmacenamientoPersistente();
    toast(r === 'compartido' ? '💾 ¡Respaldo enviado!' : '💾 Respaldo descargado en tu carpeta de Descargas');
  });

  const respaldarDescargando = () => conOcupado('descargar', async () => {
    descargar(await exportarRespaldoJson(datos));
    await marcarRespaldo();
    toast('💾 Respaldo descargado en tu carpeta de Descargas');
  });

  const exportarPowerBI = () => conOcupado('zip', async () => {
    descargar(await exportarZip(datos));
    await marcarRespaldo();
    toast('📊 ZIP descargado (CSV + fotos + JSON)');
  });

  const importar = (archivo: File | undefined) => {
    if (!archivo) return;
    conOcupado('importar', async () => {
      const r = await importarArchivo(archivo, datos);
      toast(`📥 ${plural(r.nuevos, 'nuevo', 'nuevos')}, ${plural(r.actualizados, 'actualizado', 'actualizados')}, ${plural(r.ignorados, 'repetido', 'repetidos')}${r.fotos ? `, ${plural(r.fotos, 'foto', 'fotos')}` : ''}`);
    });
    if (inputImportar.current) inputImportar.current.value = '';
  };

  const borrarEmocion = async (id: string) => {
    if (!confirm('¿Quitar esta emoción de la lista? Los registros que ya la tienen la conservan.')) return;
    await datos.ajustes.guardar({ emocionesPersonalizadas: ajustes.emocionesPersonalizadas.filter((e) => e.id !== id) });
  };

  return (
    <div class="pantalla ajustes">
      <h1>Ajustes</h1>

      <section class="tarjeta" id="contador">
        <h3>Contador inicial {anio}</h3>
        <p class="ayuda">¿Cuántos completos ya te habías comido este año antes de usar la app? El total parte desde ese número. El 1 de enero todo vuelve a cero.</p>
        <div class="fila-input">
          <input type="number" inputMode="numeric" min={0} step={1} value={inicial} placeholder="0" onInput={(e) => setInicial(e.currentTarget.value)} aria-label="Completos ya comidos" />
          <button type="button" class="boton boton-primario" onClick={guardarInicial}>Guardar</button>
        </div>
      </section>

      <section class="tarjeta" id="respaldo">
        <h3>💾 Respaldo de tus datos</h3>
        <p>Tus completos se guardan <strong>solo en este teléfono</strong>. Si borras los datos del navegador, cambias de teléfono o lo pierdes, se pierden. Por eso conviene guardar una copia de vez en cuando (la app te lo recuerda).</p>
        <ul class="estado-respaldo">
          <li>Último respaldo: <strong>{ajustes.ultimoRespaldo ? fechaRelativa(ajustes.ultimoRespaldo, ahora) : 'nunca'}</strong></li>
          <li>Cambios sin respaldar: <strong>{entero(ajustes.cambiosDesdeRespaldo)}</strong></li>
          {almacen?.persistente != null && (
            <li>Protección del navegador: <strong>{almacen.persistente ? '✅ activa' : esIOS ? 'instala la app para mayor protección' : '⏳ pendiente'}</strong></li>
          )}
        </ul>

        <div class="opcion-respaldo recomendada">
          <h4>Opción 1 · Guardar en la nube <span class="pastilla">recomendada</span></h4>
          <ol>
            <li>Toca <strong>Guardar copia</strong>.</li>
            <li>Se abre el menú para compartir del teléfono.</li>
            {esIOS
              ? <li>Elige <strong>"Guardar en Archivos"</strong> › <strong>iCloud Drive</strong> (o Google Drive si lo tienes).</li>
              : <li>Elige <strong>Drive</strong> (Google Drive) y toca <strong>Guardar</strong>.</li>}
            <li>¡Listo! Tu copia queda en la nube, con fotos y todo.</li>
          </ol>
          <button type="button" class="boton boton-primario boton-bloque" onClick={respaldarCompartiendo} disabled={!!ocupado}>
            {ocupado === 'compartir' ? 'Preparando…' : '☁️ Guardar copia'}
          </button>
        </div>

        <div class="opcion-respaldo">
          <h4>Opción 2 · Enviártela por WhatsApp o correo</h4>
          <ol>
            <li>Toca el mismo botón <strong>Guardar copia</strong> de arriba.</li>
            <li>Elige <strong>WhatsApp</strong> (mándatela a ti mismo o a "Mensajes guardados") o tu <strong>correo</strong>.</li>
          </ol>
        </div>

        <div class="opcion-respaldo">
          <h4>Opción 3 · Descargar al teléfono</h4>
          <p class="ayuda">Queda en la carpeta Descargas. Sirve si borras el navegador, pero no si pierdes el teléfono.</p>
          <button type="button" class="boton boton-bloque" onClick={respaldarDescargando} disabled={!!ocupado}>
            {ocupado === 'descargar' ? 'Preparando…' : '⬇️ Descargar respaldo'}
          </button>
        </div>

        <div class="opcion-respaldo proximamente">
          <h4>Próximamente · Respaldo automático</h4>
          <p class="ayuda">Conectar tu cuenta de Google una vez y que la app guarde sola una copia privada en tu Drive. Está en estudio (ver docs/RESPALDO.md).</p>
        </div>

        <h4>Restaurar (cambio de teléfono)</h4>
        <ol>
          <li>En el teléfono nuevo, abre la app e instálala.</li>
          <li>Toca <strong>Importar respaldo</strong> y elige el archivo <em>completometro-respaldo-….json</em> (o el .zip exportado) desde Drive, Archivos, WhatsApp o Descargas.</li>
          <li>La app junta los datos sin duplicar nada.</li>
        </ol>
        <button type="button" class="boton boton-bloque" onClick={() => inputImportar.current?.click()} disabled={!!ocupado}>
          {ocupado === 'importar' ? 'Importando…' : '📥 Importar respaldo'}
        </button>
        <input ref={inputImportar} type="file" accept=".json,.zip,application/json,application/zip" hidden onChange={(e) => importar(e.currentTarget.files?.[0])} />
      </section>

      <section class="tarjeta" id="exportar">
        <h3>📊 Exportar para Power BI o Excel</h3>
        <p class="ayuda">Descarga un ZIP con <strong>completos.csv</strong> (una fila por registro, con latitud y longitud para mapas), la carpeta <strong>fotos/</strong> y <strong>completos.json</strong>. Este ZIP también sirve para importar.</p>
        <button type="button" class="boton boton-bloque" onClick={exportarPowerBI} disabled={!!ocupado || registros.length === 0}>
          {ocupado === 'zip' ? 'Armando ZIP…' : '📦 Exportar ZIP'}
        </button>
      </section>

      <section class="tarjeta" id="emociones">
        <h3>Emociones personalizadas</h3>
        {ajustes.emocionesPersonalizadas.length === 0
          ? <p class="ayuda">Puedes crear las tuyas con "＋ Otra" al registrar un completo.</p>
          : (
            <ul class="lista-simple">
              {ajustes.emocionesPersonalizadas.map((e) => (
                <li key={e.id}>
                  <span>{e.emoji} {e.nombre}</span>
                  <button type="button" class="boton-icono" onClick={() => borrarEmocion(e.id)} aria-label={`Quitar ${e.nombre}`}>🗑️</button>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section class="tarjeta" id="instalar">
        <h3>📲 Instalar la app</h3>
        <PasosInstalar />
      </section>

      <section class="tarjeta" id="info">
        <h3>Acerca del Completómetro</h3>
        <ul class="lista-simple">
          <li><span>Versión</span><span>{config.version}</span></li>
          <li><span>Registros</span><span>{entero(registros.length)}</span></li>
          <li><span>Modo</span><span>{config.modo === 'local' ? 'Solo en este teléfono' : 'Con servidor'}</span></li>
          {pendientes != null && <li><span>Cambios por sincronizar</span><span>{entero(pendientes)}</span></li>}
          {almacen?.usadoMB != null && <li><span>Espacio usado</span><span>{almacen.usadoMB} MB</span></li>}
        </ul>
        <p class="ayuda">Gratis y de código abierto. Sin cuentas ni publicidad: tus datos no salen de tu teléfono salvo cuando tú exportas o respaldas.</p>
        <p class="ayuda"><strong>Conexión a servidor:</strong> todavía no disponible. La app ya está preparada para sincronizar en el futuro (ver docs/BACKEND.md).</p>
      </section>
    </div>
  );
}
