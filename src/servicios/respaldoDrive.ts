/**
 * Respaldo automático en Google Drive: une la sesión de Google con la sincronización.
 *
 * Cuándo se respalda solo:
 *  - Unos segundos después de cada cambio, si hay una sesión vigente (dura ~1 hora).
 *  - Al guardar un completo: ese toque se aprovecha para renovar la sesión si venció
 *    (si ya diste permiso, la ventanita de Google se abre y se cierra sola).
 *  - Al volver a tener internet.
 */
import { config } from '../config';
import { datos } from '../datos';
import { sincronizarConNube, type ResultadoSincronizacion } from '../datos/sincronizarNube';
import { aIsoLocal } from '../dominio/modelo';
import { cargarGoogle, DriveAppData, ErrorDrive, SesionGoogle } from './googleDrive';

export interface EstadoRespaldoDrive {
  disponible: boolean;
  sincronizando: boolean;
  error: string | null;
  necesitaToque: boolean;
}

const sesion = config.googleClientId ? new SesionGoogle(config.googleClientId) : null;
const nube = new DriveAppData(() => sesion?.tokenDisponible() ?? Promise.resolve(null), () => sesion?.olvidarToken());

let estado: EstadoRespaldoDrive = { disponible: !!sesion, sincronizando: false, error: null, necesitaToque: false };
const oyentes = new Set<() => void>();
const cambiar = (c: Partial<EstadoRespaldoDrive>) => {
  estado = { ...estado, ...c };
  oyentes.forEach((f) => f());
};

export const estadoDrive = () => estado;
export function suscribirDrive(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

async function conectado() {
  return !!sesion && (await datos.ajustes.leer()).drive.conectado;
}

let enCurso: Promise<ResultadoSincronizacion | null> | null = null;
let otraVez = false;

/** Sincroniza si hay sesión. No abre ventanas de Google (para eso: respaldarAhora desde un toque). */
export function sincronizar(): Promise<ResultadoSincronizacion | null> {
  if (enCurso) {
    otraVez = true;
    return enCurso;
  }
  enCurso = (async () => {
    if (!(await conectado()) || !(await sesion!.tokenDisponible())) {
      if (await conectado()) cambiar({ necesitaToque: true });
      return null;
    }
    cambiar({ sincronizando: true, error: null });
    try {
      const r = await sincronizarConNube(nube, datos);
      const a = await datos.ajustes.leer();
      await datos.ajustes.guardar({
        drive: { ...a.drive, ultimaSync: aIsoLocal(new Date()) },
        ultimoRespaldo: aIsoLocal(new Date()),
        cambiosDesdeRespaldo: 0,
        avisoRespaldoPospuestoHasta: null,
      });
      cambiar({ necesitaToque: false });
      return r;
    } catch (e) {
      const err = e as ErrorDrive;
      cambiar({ error: err.message, necesitaToque: err.codigo === 'sesion' });
      throw e;
    } finally {
      cambiar({ sincronizando: false });
    }
  })().finally(() => {
    enCurso = null;
    if (otraVez) {
      otraVez = false;
      setTimeout(() => sincronizar().catch(() => undefined), 500);
    }
  });
  return enCurso;
}

/**
 * Llamar SIN await previo desde un toque (botón). Renueva la sesión si hace falta.
 * Devuelve el resultado o lanza ErrorDrive.
 */
export function respaldarAhora(elegirCuenta = false): Promise<ResultadoSincronizacion | null> {
  if (!sesion) return Promise.reject(new ErrorDrive('El respaldo en Drive no está configurado en esta copia de la app.'));
  const correo = ultimoCorreo;
  return sesion
    .pedirToken({ correo, elegirCuenta })
    .then(async () => {
      const a = await datos.ajustes.leer();
      if (!a.drive.conectado) {
        const email = await sesion.correo();
        ultimoCorreo = email;
        await datos.ajustes.guardar({ drive: { conectado: true, correo: email, ultimaSync: null } });
      }
      return sincronizar();
    })
    .catch((e) => {
      cambiar({ error: (e as Error).message });
      throw e;
    });
}

/**
 * Para el botón "Guardar completo": si Drive está conectado y la sesión venció,
 * aprovecha el toque para renovarla. Nunca falla ni bloquea el guardado.
 */
export function renovarSesionSiHaceFalta() {
  if (!sesion || !conectadoCache || sesion.tokenVigente()) return;
  sesion.pedirToken({ correo: ultimoCorreo }).catch(() => cambiar({ necesitaToque: true }));
}

export async function desconectarDrive() {
  await sesion?.desconectar();
  await datos.ajustes.guardar({ drive: { conectado: false, correo: null, ultimaSync: null } });
  cambiar({ error: null, necesitaToque: false });
}

// --- arranque: precarga Google y respalda tras cada cambio ---
let conectadoCache = false;
let ultimoCorreo: string | null = null;
let temporizador: ReturnType<typeof setTimeout> | undefined;

export function iniciarRespaldoDrive() {
  if (!sesion) return;
  const leerAjustes = async () => {
    const a = await datos.ajustes.leer();
    conectadoCache = a.drive.conectado;
    ultimoCorreo = a.drive.correo;
    if (conectadoCache) cargarGoogle().catch(() => undefined);
  };
  leerAjustes();
  datos.ajustes.suscribir(leerAjustes);
  const programar = () => {
    if (!conectadoCache) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => sincronizar().catch(() => undefined), 3000);
  };
  datos.repo.suscribir(programar);
  datos.resenas.suscribir(programar);
  window.addEventListener('online', () => conectadoCache && sincronizar().catch(() => undefined));
}

/** Precarga el script de Google (para que "Conectar" abra la ventana al primer toque). */
export const precargarGoogle = () => (sesion ? cargarGoogle().catch(() => undefined) : undefined);
