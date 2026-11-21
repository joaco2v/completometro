/**
 * Configuración por variables de entorno (archivo .env, ver .env.example).
 * Sin .env la app funciona 100 % local.
 */
export type ModoOperacion = 'local' | 'remoto';

const modoPedido = (import.meta.env.VITE_MODO ?? 'local') as string;
const backendUrl = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '').trim() || null;

export const config = {
  /** Si piden "remoto" pero no hay URL, se queda en local para no romper nada. */
  modo: (modoPedido === 'remoto' && backendUrl ? 'remoto' : 'local') as ModoOperacion,
  backendUrl,
  version: '0.1.0',
  repositorio: 'https://github.com/joaco2v/completometro',
};
