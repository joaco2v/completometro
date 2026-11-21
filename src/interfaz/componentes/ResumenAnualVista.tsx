import { useEffect, useMemo, useState } from 'preact/hooks';
import { resumenAnual } from '../../dominio/metricas';
import { compartirODescargar } from '../../servicios/archivos';
import { dibujarResumenAnual, tarjetasResumen } from '../../servicios/imagenResumenAnual';
import { useEstado } from '../estado';
import { entero } from '../formato';
import { Modal } from './Modal';
import { config } from '../../config';

/** "Mi año en completos": tarjetas + imagen para historias de Instagram. */
export function ResumenAnualVista({ anio, alCerrar }: { anio: number; alCerrar: () => void }) {
  const { registros, ajustes, ahora, toast } = useEstado();
  const personalizadas = ajustes?.emocionesPersonalizadas ?? [];
  const r = useMemo(() => resumenAnual(registros, anio, ahora, ajustes?.contadoresIniciales), [registros, anio, ahora, ajustes]);
  const [imagen, setImagen] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    dibujarResumenAnual(r, personalizadas).then((f) => vivo && setImagen(f)).catch(() => undefined);
    return () => { vivo = false; };
  }, [r]);

  useEffect(() => {
    if (!imagen) return;
    const u = URL.createObjectURL(imagen);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [imagen]);

  const compartir = async () => {
    if (!imagen) return;
    setOcupado(true);
    const res = await compartirODescargar(imagen, `Mi ${anio} en completos`, `Este ${anio} me comí ${r.total} completos 🌭 ${config.instagram} #Completómetro`);
    setOcupado(false);
    if (res === 'descargado') toast('Imagen descargada. Súbela a tus historias desde la galería.');
  };

  return (
    <Modal titulo={`Tu ${anio} en completos`} alCerrar={alCerrar} ancho>
      <div class="resumen-anual">
        <div class="resumen-anual-total">
          <span class="contador-total">{entero(r.total)}</span>
          <span>{r.total === 1 ? 'completo' : 'completos'} en {anio}</span>
        </div>
        <ul class="grilla-tarjetas">
          {tarjetasResumen(r, personalizadas).map((t) => (
            <li key={t.titulo} class="mini-tarjeta">
              <span class="emoji-grande" aria-hidden="true">{t.emoji}</span>
              <span class="ayuda">{t.titulo}</span>
              <strong>{t.valor}</strong>
            </li>
          ))}
        </ul>
        {url && (
          <details class="vista-previa">
            <summary>Ver la imagen para historias</summary>
            <img src={url} alt={`Resumen ${anio}`} />
          </details>
        )}
        <button type="button" class="boton boton-primario boton-grande" onClick={compartir} disabled={!imagen || ocupado}>
          📲 Compartir en historias
        </button>
        <p class="ayuda centrado">En el menú que se abre, elige Instagram › Historias. Si no aparece, la imagen se descarga y la subes desde tu galería.</p>
        <p class="ayuda centrado">¡Etiquétanos! 😃 <strong>{config.instagram}</strong></p>
      </div>
    </Modal>
  );
}
