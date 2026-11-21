import { useState } from 'preact/hooks';
import { datos } from '../../datos';
import { contadorInicial } from '../../dominio/acumulado';
import { useEstado } from '../estado';
import { entero, plural } from '../formato';
import { navegar } from '../rutas';
import { Modal } from './Modal';

const PALABRA = 'BORRAR';

/** Sección de Ajustes para empezar de cero: elimina todos los registros (quedan en la papelera). */
export function ZonaPeligro() {
  const { registros, resenas, ajustes } = useEstado();
  const [abierto, setAbierto] = useState(false);
  return (
    <section class="tarjeta zona-peligro" id="eliminar">
      <h3>⚠️ Eliminar todos los registros</h3>
      <p class="ayuda">Para empezar de cero. Los registros pasan a "Eliminados" (al final del Historial), desde donde todavía puedes recuperarlos.</p>
      <button type="button" class="boton boton-bloque boton-peligro" disabled={!registros.length && !resenas.length} onClick={() => setAbierto(true)}>
        🗑️ Eliminar todos los registros
      </button>
      {abierto && ajustes && <ConfirmarEliminarTodo alCerrar={() => setAbierto(false)} />}
    </section>
  );
}

function ConfirmarEliminarTodo({ alCerrar }: { alCerrar: () => void }) {
  const { registros, resenas, ajustes, ahora, toast } = useEstado();
  const [texto, setTexto] = useState('');
  const [tambienResenas, setTambienResenas] = useState(false);
  const [tambienContador, setTambienContador] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const anio = ahora.getFullYear();
  const inicial = ajustes ? contadorInicial(ajustes.contadoresIniciales, anio) : 0;
  const completos = registros.reduce((s, r) => s + r.cantidad, 0);
  const confirmado = texto.trim().toUpperCase() === PALABRA;

  const eliminar = async () => {
    if (!confirmado || !ajustes) return;
    setOcupado(true);
    try {
      const n = await datos.repo.eliminarVarios(registros.map((r) => r.id));
      if (tambienResenas) for (const r of resenas) await datos.resenas.eliminar(r.id);
      if (tambienContador) await datos.ajustes.guardar({ contadoresIniciales: { ...ajustes.contadoresIniciales, [anio]: 0 } });
      toast(`🗑️ ${plural(n, 'registro eliminado', 'registros eliminados')}. Puedes recuperarlos en Historial › Eliminados.`);
      alCerrar();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal titulo="Eliminar todos los registros" alCerrar={alCerrar}>
      <div class="formulario">
        <p>
          Vas a eliminar <strong>{plural(registros.length, 'registro', 'registros')}</strong> ({plural(completos, 'completo', 'completos')}).
          Dejarán de contar en tu total, tus estadísticas y tu top.
        </p>
        <p class="ayuda">
          Quedan en <strong>Historial › Eliminados</strong>, desde donde puedes recuperarlos.
          {ajustes?.drive.conectado && ' Como tienes Google Drive conectado, también se eliminarán de tu copia en Drive en el próximo respaldo.'}
        </p>
        <button type="button" class="boton" onClick={() => { alCerrar(); navegar('ajustes', 'respaldo'); }}>💾 Primero quiero guardar una copia</button>

        {resenas.length > 0 && (
          <label class="campo-check">
            <input type="checkbox" checked={tambienResenas} onChange={(e) => setTambienResenas(e.currentTarget.checked)} />
            <span>También borrar mis calificaciones de locales ({entero(resenas.length)}). <small class="ayuda">Estas no se pueden recuperar desde la app.</small></span>
          </label>
        )}
        {inicial > 0 && (
          <label class="campo-check">
            <input type="checkbox" checked={tambienContador} onChange={(e) => setTambienContador(e.currentTarget.checked)} />
            <span>También poner en cero el contador inicial de {anio} (hoy: {entero(inicial)}).</span>
          </label>
        )}

        <label class="campo">
          <span class="etiqueta">Para confirmar, escribe <strong>{PALABRA}</strong></span>
          <input type="text" class="confirmar-texto" value={texto} autocomplete="off" autocapitalize="characters" onInput={(e) => setTexto(e.currentTarget.value)} />
        </label>
        <button type="button" class="boton boton-grande boton-peligro" disabled={!confirmado || ocupado} onClick={eliminar}>
          {ocupado ? 'Eliminando…' : '🗑️ Eliminar todo'}
        </button>
      </div>
    </Modal>
  );
}
