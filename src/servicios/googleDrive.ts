/**
 * Google Drive: inicio de sesión (Google Identity Services) y archivos en la carpeta
 * privada de la app ("appDataFolder"). La app NO puede ver los demás archivos del Drive.
 *
 * Todo ocurre en el navegador, sin servidor propio. El token dura ~1 hora y vive solo en memoria.
 * Pedir un token abre una ventanita de Google, por eso solo se hace cuando la persona toca algo
 * (los navegadores bloquean ventanas que no vienen de un toque).
 */
import type { AlmacenNube, ArchivoNube } from '../datos/contratos';

const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.appdata';
const SCOPE_CORREO = 'https://www.googleapis.com/auth/userinfo.email';
const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3';

// ---- tipos mínimos de Google Identity Services ----
interface RespuestaToken {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}
interface ClienteToken {
  callback: (r: RespuestaToken) => void;
  error_callback?: (e: { type?: string; message?: string }) => void;
  requestAccessToken(o?: { prompt?: string; login_hint?: string }): void;
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(c: {
        client_id: string;
        scope: string;
        callback: (r: RespuestaToken) => void;
        error_callback?: (e: { type?: string; message?: string }) => void;
      }): ClienteToken;
      hasGrantedAllScopes(r: RespuestaToken, ...scopes: string[]): boolean;
      revoke(token: string, hecho?: () => void): void;
    };
  };
}
declare global {
  interface Window {
    google?: Gis;
  }
}

export class ErrorDrive extends Error {
  constructor(mensaje: string, public codigo: 'cancelado' | 'sin_permiso' | 'sesion' | 'red' | 'otro' = 'otro') {
    super(mensaje);
  }
}

let cargaGis: Promise<Gis> | null = null;

/** Carga el script de Google (una vez). Conviene llamarlo antes de que la persona toque "Conectar". */
export function cargarGoogle(): Promise<Gis> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  cargaGis ??= new Promise<Gis>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new ErrorDrive('No pude cargar Google.', 'red')));
    s.onerror = () => {
      cargaGis = null;
      reject(new ErrorDrive('No pude conectar con Google. Revisa tu internet.', 'red'));
    };
    document.head.appendChild(s);
  });
  return cargaGis;
}

export const googleListo = () => !!window.google?.accounts?.oauth2;

/** Sesión con Google: guarda el token en memoria y lo renueva cuando la persona toca algo. */
export class SesionGoogle {
  private cliente: ClienteToken | null = null;
  private token: { valor: string; vence: number } | null = null;
  private pedido: Promise<string> | null = null;

  constructor(private clientId: string) {}

  tokenVigente(): string | null {
    return this.token && Date.now() < this.token.vence - 60_000 ? this.token.valor : null;
  }

  /** Si hay un pedido de token en curso, lo espera; si no, devuelve el vigente o null. */
  async tokenDisponible(): Promise<string | null> {
    const t = this.tokenVigente();
    if (t) return t;
    if (this.pedido) return this.pedido.catch(() => null);
    return null;
  }

  /**
   * Pide un token. DEBE llamarse directo desde un toque (sin await antes) para que el navegador
   * no bloquee la ventanita. Si Google aún no cargó, falla con un mensaje amable.
   */
  pedirToken(opciones: { correo?: string | null; elegirCuenta?: boolean } = {}): Promise<string> {
    const vigente = this.tokenVigente();
    if (vigente) return Promise.resolve(vigente);
    if (this.pedido) return this.pedido;
    if (!googleListo()) {
      cargarGoogle().catch(() => undefined);
      return Promise.reject(new ErrorDrive('Google todavía está cargando. Intenta de nuevo en unos segundos.', 'red'));
    }
    const google = window.google!;
    this.pedido = new Promise<string>((resolve, reject) => {
      this.cliente ??= google.accounts.oauth2.initTokenClient({ client_id: this.clientId, scope: `${SCOPE_DRIVE} ${SCOPE_CORREO}`, callback: () => undefined });
      this.cliente.callback = (r) => {
        if (r.error || !r.access_token) {
          reject(new ErrorDrive(r.error === 'access_denied' ? 'No diste permiso a Google.' : 'Google no entregó el permiso.', r.error === 'access_denied' ? 'cancelado' : 'otro'));
          return;
        }
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE_DRIVE)) {
          reject(new ErrorDrive('Falta marcar el permiso para que la app guarde su respaldo en tu Drive. Vuelve a conectar y deja marcada esa casilla.', 'sin_permiso'));
          return;
        }
        this.token = { valor: r.access_token, vence: Date.now() + Number(r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      };
      this.cliente.error_callback = (e) => {
        reject(new ErrorDrive(e.type === 'popup_failed_to_open'
          ? 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e intenta de nuevo.'
          : 'Se cerró la ventana de Google antes de terminar.', 'cancelado'));
      };
      this.cliente.requestAccessToken({
        prompt: opciones.elegirCuenta ? 'select_account' : '',
        ...(opciones.correo ? { login_hint: opciones.correo } : {}),
      });
    }).finally(() => {
      this.pedido = null;
    });
    return this.pedido;
  }

  olvidarToken() {
    this.token = null;
  }

  async desconectar() {
    const t = this.token?.valor;
    this.token = null;
    if (t && googleListo()) await new Promise<void>((r) => window.google!.accounts.oauth2.revoke(t, r));
  }

  async correo(): Promise<string | null> {
    const t = this.tokenVigente();
    if (!t) return null;
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${t}` } });
      return r.ok ? ((await r.json()) as { email?: string }).email ?? null : null;
    } catch {
      return null;
    }
  }
}

/** Archivos en la carpeta privada de la app en Google Drive. */
export class DriveAppData implements AlmacenNube {
  constructor(private token: () => Promise<string | null>, private alExpirar: () => void) {}

  private async llamar(url: string, init: RequestInit = {}): Promise<Response> {
    const t = await this.token();
    if (!t) throw new ErrorDrive('Hay que volver a conectar con Google.', 'sesion');
    let r: Response;
    try {
      r = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${t}` } });
    } catch {
      throw new ErrorDrive('Sin conexión a internet. Se respaldará más tarde.', 'red');
    }
    if (r.status === 401) {
      this.alExpirar();
      throw new ErrorDrive('La sesión con Google expiró. Toca para reconectar.', 'sesion');
    }
    if (r.status === 403) throw new ErrorDrive('Google no permitió el respaldo (permiso o cuota). Vuelve a conectar.', 'sin_permiso');
    if (!r.ok) throw new ErrorDrive(`Google Drive respondió con un error (${r.status}).`, 'otro');
    return r;
  }

  async listar(): Promise<ArchivoNube[]> {
    const archivos: ArchivoNube[] = [];
    let pagina: string | undefined;
    do {
      const q = new URLSearchParams({ spaces: 'appDataFolder', fields: 'nextPageToken,files(id,name)', pageSize: '1000' });
      if (pagina) q.set('pageToken', pagina);
      const r = (await (await this.llamar(`${API}/files?${q}`)).json()) as { files: { id: string; name: string }[]; nextPageToken?: string };
      archivos.push(...r.files.map((f) => ({ id: f.id, nombre: f.name })));
      pagina = r.nextPageToken;
    } while (pagina);
    return archivos;
  }

  async descargarTexto(id: string) {
    return (await this.llamar(`${API}/files/${encodeURIComponent(id)}?alt=media`)).text();
  }

  async descargarBlob(id: string, tipo: string) {
    const b = await (await this.llamar(`${API}/files/${encodeURIComponent(id)}?alt=media`)).blob();
    return new Blob([b], { type: tipo });
  }

  async crear(nombre: string, contenido: Blob) {
    const limite = `completometro${Math.random().toString(36).slice(2)}`;
    const meta = JSON.stringify({ name: nombre, parents: ['appDataFolder'] });
    const cuerpo = new Blob([
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
      `--${limite}\r\nContent-Type: ${contenido.type || 'application/octet-stream'}\r\n\r\n`,
      contenido,
      `\r\n--${limite}--`,
    ]);
    const r = await this.llamar(`${SUBIDA}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: cuerpo,
    });
    return ((await r.json()) as { id: string }).id;
  }

  async actualizar(id: string, contenido: Blob) {
    await this.llamar(`${SUBIDA}/files/${encodeURIComponent(id)}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': contenido.type || 'application/octet-stream' },
      body: contenido,
    });
  }
}
