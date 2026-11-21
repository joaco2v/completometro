import { useEffect, useState } from 'preact/hooks';
import { config } from '../../config';
import { compartirODescargar } from '../../servicios/archivos';
import { useEstado } from '../estado';
import { Modal } from './Modal';

/** Ventana con la vista previa de una imagen generada y el botón para compartirla en historias. */
export function VistaImagen({ titulo, generar, textoCompartir, ayuda, alCerrar }: {
  titulo: string;
  generar: () => Promise<File>;
  textoCompartir: string;
  ayuda?: string;
  alCerrar: () => void;
}) {
  const { toast } = useEstado();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    generar().then((f) => vivo && setArchivo(f)).catch((e) => vivo && setError((e as Error).message));
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!archivo) return;
    const u = URL.createObjectURL(archivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo]);

  const compartir = async () => {
    if (!archivo) return;
    setOcupado(true);
    const r = await compartirODescargar(archivo, titulo, textoCompartir);
    setOcupado(false);
    if (r === 'descargado') toast('Imagen descargada. Súbela a tus historias desde la galería.');
  };

  return (
    <Modal titulo={titulo} alCerrar={alCerrar} ancho>
      <div class="vista-imagen">
        {error && <p class="aviso aviso-error">{error}</p>}
        {url ? <img src={url} alt={titulo} /> : !error && <div class="cargando">🌭</div>}
        {ayuda && <p class="ayuda centrado">{ayuda}</p>}
        <button type="button" class="boton boton-primario boton-grande" onClick={compartir} disabled={!archivo || ocupado}>
          📲 Compartir en historias
        </button>
        {config.instagram && <p class="ayuda centrado">¡Etiquétanos! 😃 <strong>{config.instagram}</strong></p>}
      </div>
    </Modal>
  );
}
