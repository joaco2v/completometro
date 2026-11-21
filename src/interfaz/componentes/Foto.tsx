import { useEffect, useState } from 'preact/hooks';
import { datos } from '../../datos';

/** Carga una foto desde FotoStorage y la muestra (libera la memoria al desmontar). */
export function useUrlFoto(fotoId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fotoId) {
      setUrl(null);
      return;
    }
    let vivo = true;
    let creada: string | null = null;
    datos.fotos.obtener(fotoId).then((f) => {
      if (!vivo || !f) return;
      creada = URL.createObjectURL(f.blob);
      setUrl(creada);
    });
    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [fotoId]);
  return url;
}

export function Foto({ fotoId, clase, alt = 'Foto del completo' }: { fotoId: string | null; clase?: string; alt?: string }) {
  const url = useUrlFoto(fotoId);
  if (!fotoId) return <div class={`foto-vacia ${clase ?? ''}`} aria-hidden="true">🌭</div>;
  return url ? <img class={clase} src={url} alt={alt} loading="lazy" /> : <div class={`foto-vacia ${clase ?? ''}`} />;
}
