import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

/** Hoja que sube desde abajo (en pantallas grandes, una ventana centrada). */
export function Modal({ titulo, alCerrar, children, ancho }: { titulo: string; alCerrar: () => void; children: ComponentChildren; ancho?: boolean }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflow;
    };
  }, [alCerrar]);

  return (
    <div class="modal-fondo" onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <div class={`modal ${ancho ? 'modal-ancho' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <header class="modal-cabecera">
          <h2>{titulo}</h2>
          <button type="button" class="boton-icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </header>
        <div class="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
