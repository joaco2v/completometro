/**
 * Configuración por variables de entorno (archivo .env, ver .env.example).
 * Sin .env la app funciona 100 % local.
 */
export type ModoOperacion = 'local' | 'remoto';

const env = (clave: string) => ((import.meta.env[clave] as string | undefined) ?? '').trim() || null;

const modoPedido = env('VITE_MODO') ?? 'local';
const backendUrl = env('VITE_BACKEND_URL');

export const config = {
  /** Si piden "remoto" pero no hay URL, se queda en local para no romper nada. */
  modo: (modoPedido === 'remoto' && backendUrl ? 'remoto' : 'local') as ModoOperacion,
  backendUrl,
  /** ID de cliente OAuth de Google para el respaldo en Drive. Sin él, la opción no aparece. Ver docs/GOOGLE_DRIVE.md */
  googleClientId: env('VITE_GOOGLE_CLIENT_ID'),
  version: '0.4.1',
  repositorio: 'https://github.com/joaco2v/completometro',
  /** Si haces un fork, cambia estos datos por los tuyos. */
  autor: {
    nombre: 'joaco2v',
    github: 'https://github.com/joaco2v',
  },
  /** Cuenta de Instagram del proyecto: aparece en la imagen del resumen anual. */
  instagram: '@completometro',
};
