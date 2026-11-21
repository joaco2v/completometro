/** Compartir o descargar archivos, y proteger el almacenamiento local. */

export type ResultadoEntrega = 'compartido' | 'descargado' | 'cancelado';

export function puedeCompartir(archivo: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivo] });
  } catch {
    return false;
  }
}

export function descargar(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Abre el menú "Compartir" del teléfono (Drive, WhatsApp, correo, Archivos…). Si no se puede, descarga. */
export async function compartirODescargar(archivo: File, titulo: string, texto?: string): Promise<ResultadoEntrega> {
  if (puedeCompartir(archivo)) {
    try {
      await navigator.share({ files: [archivo], title: titulo, text: texto });
      return 'compartido';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelado';
      // Otros errores (ej. permiso): seguimos con la descarga.
    }
  }
  descargar(archivo);
  return 'descargado';
}

/**
 * Pide al navegador que NO borre los datos por falta de espacio.
 * Chrome lo concede solo (sobre todo si la app está instalada). Safari lo maneja a su manera:
 * en iPhone, instalar la app en la pantalla de inicio es lo que más protege los datos.
 */
export async function pedirAlmacenamientoPersistente(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function estadoAlmacenamiento(): Promise<{ persistente: boolean | null; usadoMB: number | null; cuotaMB: number | null }> {
  try {
    const persistente = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const mb = (n?: number) => (n == null ? null : Math.round((n / 1024 / 1024) * 10) / 10);
    return { persistente, usadoMB: mb(est?.usage), cuotaMB: mb(est?.quota) };
  } catch {
    return { persistente: null, usadoMB: null, cuotaMB: null };
  }
}
