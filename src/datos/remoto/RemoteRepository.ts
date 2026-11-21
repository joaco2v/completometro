/**
 * ESQUELETO para la fase 3 (backend). No se usa todavía.
 *
 * La idea: un SyncRepository que envuelve al LocalRepository.
 *  - Las pantallas siguen leyendo y escribiendo en local (rápido y offline).
 *  - En segundo plano, `sincronizar()`:
 *      1. Envía el outbox con POST /registros/lote.
 *      2. Pide GET /registros?desde=<ultima_sync> y los integra con repo.fusionar()
 *         (gana el último cambio según actualizado_en).
 *      3. Sube/baja fotos con PUT/GET /fotos/{id}.
 *  - El contrato de API está en docs/BACKEND.md.
 */
import type { Registro } from '../../dominio/modelo';
import type { Outbox, RegistroRepository } from '../contratos';

export class SyncRepository {
  constructor(
    private local: RegistroRepository & Outbox,
    private backendUrl: string,
    private token: () => Promise<string>,
  ) {}

  async sincronizar(desde: string | null): Promise<void> {
    const cabeceras = { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.token()}` };

    const pendientes = await this.local.pendientes();
    if (pendientes.length) {
      const ids = [...new Set(pendientes.map((p) => p.entidad_id))];
      const registros = (await Promise.all(ids.map((id) => this.local.obtener(id)))).filter(Boolean);
      const r = await fetch(`${this.backendUrl}/registros/lote`, { method: 'POST', headers: cabeceras, body: JSON.stringify({ registros }) });
      if (!r.ok) throw new Error(`Error al enviar cambios (${r.status})`);
      await this.local.confirmar(pendientes.map((p) => p.seq!).filter((s) => s != null));
    }

    const url = new URL(`${this.backendUrl}/registros`);
    if (desde) url.searchParams.set('desde', desde);
    const r = await fetch(url, { headers: cabeceras });
    if (!r.ok) throw new Error(`Error al traer cambios (${r.status})`);
    const { registros } = (await r.json()) as { registros: Registro[] };
    await this.local.fusionar(registros.map((x) => ({ ...x, estado_sync: 'sincronizado' as const })));
  }
}
