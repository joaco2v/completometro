import { useEffect, useState } from 'preact/hooks';
import {
  desconectarDrive, estadoDrive, precargarGoogle, respaldarAhora, suscribirDrive, type EstadoRespaldoDrive,
} from '../../servicios/respaldoDrive';
import { useEstado } from '../estado';
import { entero, fechaRelativa, plural } from '../formato';

export function useDrive(): EstadoRespaldoDrive {
  const [e, setE] = useState(estadoDrive);
  useEffect(() => suscribirDrive(() => setE(estadoDrive())), []);
  return e;
}

/** Tarjeta de Ajustes: conectar, estado y desconectar el respaldo automático en Google Drive. */
export function TarjetaDrive() {
  const { ajustes, ahora, toast } = useEstado();
  const drive = useDrive();
  useEffect(() => {
    precargarGoogle();
  }, []);
  if (!ajustes || !drive.disponible) return null;
  const { conectado, correo, ultimaSync } = ajustes.drive;

  // Sin await antes de respaldarAhora: el navegador solo deja abrir la ventana de Google desde un toque.
  const respaldar = (elegirCuenta = false) => {
    respaldarAhora(elegirCuenta)
      .then((r) => {
        if (!r) return;
        const t = r.traidos;
        toast(t.nuevos || t.actualizados
          ? `☁️ Listo: ${plural(t.nuevos + t.actualizados, 'registro traído', 'registros traídos')} desde Drive`
          : '☁️ Respaldado en tu Google Drive');
      })
      .catch(() => undefined);
  };

  const desconectar = async () => {
    if (!confirm('¿Desconectar Google Drive? Tus datos siguen en este teléfono y la copia en Drive no se borra.')) return;
    await desconectarDrive();
    toast('Google Drive desconectado');
  };

  return (
    <div class="opcion-respaldo recomendada">
      <h4>Opción 1 · Respaldo automático en Google Drive <span class="pastilla">recomendada</span></h4>
      {!conectado ? (
        <>
          <ol>
            <li>Toca <strong>Conectar con Google</strong>.</li>
            <li>Elige tu cuenta y toca <strong>Continuar</strong> / <strong>Permitir</strong>. Si aparece una casilla sobre Drive, déjala marcada.</li>
            <li>¡Listo! Desde ahí la app guarda sola una copia cada vez que registras un completo.</li>
          </ol>
          <p class="ayuda">
            🔒 La app solo puede usar su propia carpeta oculta en tu Drive: no ve tus fotos ni documentos.
            En un teléfono nuevo, conéctate con la misma cuenta y aparecen todos tus completos.
          </p>
          <button type="button" class="boton boton-primario boton-bloque" onClick={() => respaldar(true)} disabled={drive.sincronizando}>
            {drive.sincronizando ? 'Conectando…' : '☁️ Conectar con Google'}
          </button>
        </>
      ) : (
        <>
          <div class="drive-estado">
            <span class="emoji-grande" aria-hidden="true">{drive.sincronizando ? '🔄' : drive.error ? '⚠️' : '✅'}</span>
            <span>
              <strong>{drive.sincronizando ? 'Respaldando…' : 'Conectado'}</strong>{correo && <> como {correo}</>}
              <br />
              <small class="ayuda">
                {ultimaSync ? `Último respaldo: ${fechaRelativa(ultimaSync, ahora)}` : 'Aún sin respaldar'}
                {ajustes.cambiosDesdeRespaldo > 0 && ` · ${entero(ajustes.cambiosDesdeRespaldo)} sin respaldar`}
              </small>
            </span>
          </div>
          {drive.error && <p class="aviso aviso-error">{drive.error}</p>}
          <p class="ayuda">La copia se hace sola después de cada cambio. Si pasó más de una hora, la app aprovecha cuando guardas un completo para reconectarse (puede verse un instante la ventana de Google).</p>
          <div class="drive-acciones">
            <button type="button" class="boton boton-primario" onClick={() => respaldar()} disabled={drive.sincronizando}>☁️ Respaldar ahora</button>
            <button type="button" class="boton" onClick={desconectar} disabled={drive.sincronizando}>Desconectar</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Botón para el aviso del inicio cuando Drive está conectado pero la sesión venció. */
export function BotonRespaldarDrive({ alTerminar }: { alTerminar?: () => void }) {
  const { toast } = useEstado();
  const drive = useDrive();
  return (
    <button
      type="button"
      class="boton boton-primario boton-chico"
      disabled={drive.sincronizando}
      onClick={() => respaldarAhora().then(() => { toast('☁️ Respaldado en tu Google Drive'); alTerminar?.(); }).catch((e) => toast(`⚠️ ${(e as Error).message}`))}
    >
      {drive.sincronizando ? 'Respaldando…' : '☁️ Respaldar en Drive'}
    </button>
  );
}
