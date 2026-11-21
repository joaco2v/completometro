/** Detección de plataforma para mostrar instrucciones adecuadas (Chrome primero, luego Safari). */

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const esIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document);
export const esAndroid = /Android/i.test(ua);
export const esSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/.test(ua);

export function esInstalada(): boolean {
  return (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}

/** Evento de instalación de Chrome/Edge/Android (Safari no lo tiene: allá se usa "Compartir > Agregar a inicio"). */
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let eventoInstalar: EventoInstalar | null = null;
const oyentes = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalar = e as EventoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalar = null;
    oyentes.forEach((f) => f());
  });
}

export const puedeInstalarDirecto = () => eventoInstalar != null;

export function alCambiarInstalable(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export async function instalar(): Promise<boolean> {
  if (!eventoInstalar) return false;
  await eventoInstalar.prompt();
  const { outcome } = await eventoInstalar.userChoice;
  eventoInstalar = null;
  oyentes.forEach((f) => f());
  return outcome === 'accepted';
}
