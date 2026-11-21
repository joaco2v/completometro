import { aIsoLocal, registroVacio, VERSION_ESQUEMA, type Registro } from '../src/dominio/modelo';

let n = 0;

/** Crea un registro de prueba. `fecha` en hora local: new Date(2026, 10, 21, 13). */
export function reg(fecha: Date, extra: Partial<Registro> = {}): Registro {
  n++;
  const iso = aIsoLocal(fecha);
  return {
    ...registroVacio(fecha),
    id: `id-${n}`,
    creado_en: iso,
    actualizado_en: iso,
    eliminado_en: null,
    dispositivo_id: 'test',
    estado_sync: 'pendiente',
    version_esquema: VERSION_ESQUEMA,
    ...extra,
  };
}
