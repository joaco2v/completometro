/**
 * Achica la foto antes de guardarla para no llenar el almacenamiento del teléfono.
 * Importante: leer el EXIF (GPS) ANTES de llamar a esto, porque el canvas borra los metadatos.
 */
const LADO_MAXIMO = 1280;
const CALIDAD = 0.8;

async function decodificar(archivo: Blob): Promise<{ img: CanvasImageSource; ancho: number; alto: number; cerrar: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
      return { img: bmp, ancho: bmp.width, alto: bmp.height, cerrar: () => bmp.close() };
    } catch {
      /* Safari antiguo: se usa <img> */
    }
  }
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('No pude abrir esa imagen. Prueba con otra foto (JPG o PNG).');
  }
  return { img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
}

export async function comprimirFoto(archivo: Blob): Promise<Blob> {
  const { img, ancho, alto, cerrar } = await decodificar(archivo);
  try {
    const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
    const w = Math.round(ancho * escala);
    const h = Math.round(alto * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', CALIDAD));
    if (!blob) throw new Error('No pude procesar la foto.');
    // Si la original ya era más liviana, nos quedamos con ella.
    return archivo.size < blob.size && archivo.type === 'image/jpeg' ? archivo : blob;
  } finally {
    cerrar();
  }
}
