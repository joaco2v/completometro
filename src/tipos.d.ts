declare module 'exifr/dist/lite.esm.mjs' {
  export function gps(archivo: Blob | ArrayBuffer): Promise<{ latitude: number; longitude: number } | undefined>;
  const exifr: { gps: typeof gps };
  export default exifr;
}

interface Navigator {
  /** Safari iOS: true si la app se abrió desde la pantalla de inicio. */
  standalone?: boolean;
}
