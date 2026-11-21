/**
 * Contratos de la capa de datos. Las pantallas SOLO conocen estas interfaces.
 * Hoy se implementan sobre IndexedDB (carpeta local/). Mañana puede haber una
 * implementación remota o de sincronización sin tocar la interfaz de usuario.
 */
import type { DatosRegistro, Registro } from '../dominio/modelo';
import type { Ajustes } from '../dominio/ajustes';

import type { DatosResena, ResenaLocal } from '../dominio/resenas';

/** Reseñas de locales (sin completo). Mismo modelo de sincronización que los registros. */
export interface ResenaRepository {
  listar(opciones?: { incluirEliminados?: boolean }): Promise<ResenaLocal[]>;
  /** Crea o actualiza la reseña de ese local (una por local). */
  guardar(datos: DatosResena): Promise<ResenaLocal>;
  eliminar(id: string): Promise<void>;
  fusionar(resenas: ResenaLocal[]): Promise<ResultadoFusion>;
  suscribir(alCambiar: () => void): () => void;
}

export interface ResultadoFusion {
  nuevos: number;
  actualizados: number;
  ignorados: number;
}

export interface RegistroRepository {
  /** Registros no eliminados (o todos, si incluirEliminados). Sin orden garantizado. */
  listar(opciones?: { incluirEliminados?: boolean }): Promise<Registro[]>;
  obtener(id: string): Promise<Registro | undefined>;
  crear(datos: DatosRegistro): Promise<Registro>;
  actualizar(id: string, cambios: Partial<DatosRegistro>): Promise<Registro>;
  /** Borrado lógico: marca eliminado_en (queda en la papelera). */
  eliminar(id: string): Promise<void>;
  /** Borrado lógico de varios en una sola operación. Devuelve cuántos se eliminaron. */
  eliminarVarios(ids: readonly string[]): Promise<number>;
  /** Saca de la papelera (quita eliminado_en). Devuelve cuántos se restauraron. */
  restaurar(ids: readonly string[]): Promise<number>;
  /**
   * Integra registros que vienen de afuera (importación o servidor) usando
   * "gana el último cambio" (actualizado_en). Evita duplicados por id.
   */
  fusionar(registros: Registro[]): Promise<ResultadoFusion>;
  /** Avisa cada vez que cambian los datos. Devuelve la función para desuscribirse. */
  suscribir(alCambiar: () => void): () => void;
}

export interface FotoGuardada {
  id: string;
  tipo: string;
  blob: Blob;
}

/** Almacenamiento de fotos, separado de los registros (hoy IndexedDB, mañana un bucket). */
export interface FotoStorage {
  guardar(blob: Blob, id?: string): Promise<string>;
  obtener(id: string): Promise<FotoGuardada | undefined>;
  eliminar(id: string): Promise<void>;
  listarIds(): Promise<string[]>;
}

export interface AjustesStore {
  leer(): Promise<Ajustes>;
  guardar(cambios: Partial<Ajustes>): Promise<Ajustes>;
  suscribir(alCambiar: () => void): () => void;
}

export interface ArchivoNube {
  id: string;
  nombre: string;
}

/**
 * Carpeta privada en la nube donde se guarda el respaldo (hoy: carpeta oculta de la app en Google Drive).
 * Mañana podría ser Dropbox, OneDrive o un bucket propio con la misma interfaz.
 */
export interface AlmacenNube {
  listar(): Promise<ArchivoNube[]>;
  descargarTexto(id: string): Promise<string>;
  descargarBlob(id: string, tipo: string): Promise<Blob>;
  crear(nombre: string, contenido: Blob): Promise<string>;
  actualizar(id: string, contenido: Blob): Promise<void>;
}

/** Cambio pendiente de enviar al backend (hoy se acumula y no se envía a ningún lado). */
export interface CambioPendiente {
  seq?: number;
  entidad: 'registro' | 'resena';
  entidad_id: string;
  operacion: 'crear' | 'actualizar' | 'eliminar' | 'importar';
  fecha: string;
}

export interface Outbox {
  pendientes(): Promise<CambioPendiente[]>;
  contar(): Promise<number>;
  /** Para el futuro motor de sincronización: quita los cambios ya enviados. */
  confirmar(seqs: number[]): Promise<void>;
}
