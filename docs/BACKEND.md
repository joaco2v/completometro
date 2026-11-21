# Contrato de API para un backend futuro

Hoy el Completómetro funciona **100 % local**: todo vive en IndexedDB y no hay servidor.
Este documento describe el backend esperado, para que se pueda implementar después con
**Supabase, Firebase, Google Drive (scope `drive.appdata`) o un servidor propio** sin reescribir la app.

## Cómo encaja en el código

```
src/
├─ dominio/        Modelo, métricas y resolución de conflictos (TypeScript puro)
├─ datos/
│  ├─ contratos.ts         Interfaces: RegistroRepository, FotoStorage, AjustesStore, Outbox
│  ├─ local/               Implementación actual sobre IndexedDB (+ migraciones en db.ts)
│  ├─ remoto/              Esqueleto de SyncRepository (fase 3)
│  └─ index.ts             Único lugar donde se elige la implementación
└─ interfaz/       Pantallas: solo usan las interfaces de datos/contratos.ts
```

Configuración (`.env`, ver `.env.example`):

| Variable | Valores | Efecto |
|---|---|---|
| `VITE_MODO` | `local` (por defecto) \| `remoto` | Sin URL de backend, siempre queda en `local`. |
| `VITE_BACKEND_URL` | `https://api.ejemplo.cl` | Base de los endpoints de abajo. |

### Estrategia de sincronización recomendada

La app **sigue leyendo y escribiendo en local** (rápida y offline). Un `SyncRepository`
corre en segundo plano (al abrir la app, al volver a tener internet, cada cierto tiempo):

1. **Subir**: lee el *outbox* (cola de cambios pendientes en IndexedDB) y envía los registros
   afectados con `POST /registros/lote`. Si responde bien, borra esas entradas del outbox.
2. **Bajar**: `GET /registros?desde=<marca>` y los integra con `repo.fusionar()`.
3. **Fotos**: sube con `PUT /fotos/{id}` las que el servidor no tenga; baja las que falten.
4. Guarda la `marca` devuelta por el servidor para la próxima vez.

### Resolución de conflictos: gana el último cambio

Cada registro tiene `actualizado_en` (ISO 8601 con zona horaria). Al recibir una versión
de otro dispositivo:

- Si no existe localmente → se agrega.
- Si existe y la entrante tiene `actualizado_en` **más reciente** → reemplaza a la local.
- Si es igual o más antigua → se ignora.

Los borrados son **lógicos** (`eliminado_en` con fecha) para que viajen entre dispositivos
como un cambio más. El servidor debe aplicar la misma regla. Implementación: `src/dominio/conflictos.ts`.

## Modelo de datos (JSON)

```json
{
  "id": "0b6f1c8e-2a51-4f8e-9d1a-01a000000001",
  "fecha_hora": "2026-01-09T13:20:00-03:00",
  "cantidad": 1,
  "tipo_lugar": "local",
  "nombre_local": "La Esquina del Completo",
  "puntuacion": 8,
  "preparado_por": null,
  "preparado_por_nombre": null,
  "emocion": "feliz",
  "hambre": 4,
  "latitud": -33.4372,
  "longitud": -70.6366,
  "precision_gps_m": 12,
  "origen_coordenadas": "gps",
  "foto_id": "9c1d…",
  "notas": "Primer completo del año",

  "creado_en": "2026-01-09T13:20:05-03:00",
  "actualizado_en": "2026-01-09T13:20:05-03:00",
  "eliminado_en": null,
  "dispositivo_id": "3f0a…",
  "estado_sync": "pendiente",
  "version_esquema": 2
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID v4 | Generado en el cliente. Clave primaria también en el servidor. |
| `fecha_hora` | ISO 8601 | Cuándo se comió (puede ser anterior a `creado_en` si se registró atrasado). |
| `cantidad` | entero ≥ 1 | |
| `tipo_lugar` | `local` \| `otro` | |
| `nombre_local` | texto | Solo si `tipo_lugar = local`. |
| `puntuacion` | 1–10 | Nota del completo (cualquier lugar). |
| `preparado_por`, `preparado_por_nombre` | `yo` \| `otra_persona`, texto | Solo si `tipo_lugar = otro`. Desde el esquema v2. |
| `emocion` | texto | Id de emoción (base o personalizada `p_…`). Es una **etiqueta**, no una escala. |
| `hambre` | 1–5 | Espectro: 1 = nada … 5 = me comería toda la olla. |
| `latitud`, `longitud`, `precision_gps_m` | número | `origen_coordenadas`: `gps` \| `foto_exif` \| `manual`. |
| `foto_id` | texto | Referencia a `/fotos/{id}`. |
| `creado_en`, `actualizado_en`, `eliminado_en` | ISO 8601 | Metadatos de sincronización. |
| `dispositivo_id` | texto | Qué dispositivo hizo el último cambio. |
| `estado_sync` | `pendiente` \| `sincronizado` | Solo tiene sentido en el cliente. |
| `version_esquema` | entero | Para migraciones. |

`numero_acumulado_anio` **no se guarda**: se calcula al leer (contador inicial del año + suma
de `cantidad` en orden cronológico), así nunca queda desfasado.

Ajustes que conviene sincronizar: `contadoresIniciales` (`{"2026": 37}`) y `emocionesPersonalizadas`.

## Autenticación

Todas las llamadas llevan:

```
Authorization: Bearer <token>
```

El token identifica al usuario; cada usuario ve **solo sus registros**. Cómo se obtiene depende del proveedor:

- **Supabase**: JWT de Supabase Auth (enlace mágico por correo o Google). Políticas RLS `user_id = auth.uid()`.
- **Firebase**: ID token de Firebase Auth. Reglas de Firestore por `request.auth.uid`.
- **Google Drive (`drive.appdata`)**: token OAuth de Google Identity Services. No hay endpoints propios:
  el "servidor" es un archivo JSON privado en la carpeta oculta de la app (ver `docs/RESPALDO.md`).
- **Servidor propio**: cualquier JWT.

## Endpoints

### `GET /registros?desde=<marca>`

Registros del usuario modificados después de `desde` (incluye eliminados lógicamente).
Sin `desde`: todos.

```json
{ "registros": [ { …registro… } ], "marca": "2026-11-21T15:00:00Z" }
```

### `POST /registros/lote`

Sube cambios (creaciones, ediciones y borrados lógicos). El servidor aplica "gana el último cambio" por `id`.

```json
// petición
{ "registros": [ { …registro… } ] }
// respuesta
{ "aceptados": ["id1", "id2"], "rechazados": [ { "id": "id3", "motivo": "más antiguo que el del servidor" } ] }
```

Un rechazo por antigüedad **no es un error**: el cliente recibirá la versión ganadora en el siguiente `GET`.

### `PUT /fotos/{id}`

Cuerpo binario (`Content-Type: image/jpeg`). Idempotente. Respuesta `204`.

### `GET /fotos/{id}`

Devuelve la imagen o `404`.

### `GET /resenas?desde=<marca>` · `POST /resenas/lote`

Igual que los registros, para las **reseñas de locales** (calificar un local sin registrar un completo).
Misma regla de "gana el último cambio" y borrado lógico. Una reseña por local.

```json
{ "id": "…", "nombre_local": "Fuente Alemana", "puntuacion": 9, "latitud": -33.4372, "longitud": -70.6366,
  "comentario": "El mejor as", "fecha": "2026-10-10T14:00:00-03:00",
  "creado_en": "…", "actualizado_en": "…", "eliminado_en": null, "dispositivo_id": "…", "estado_sync": "pendiente", "version_esquema": 2 }
```

### `GET /ajustes` · `PUT /ajustes`

```json
{ "contadoresIniciales": { "2026": 37 }, "emocionesPersonalizadas": [ { "id": "p_bajoneado", "emoji": "🫠", "nombre": "Bajoneado" } ], "modoTop": "auto", "topPersonalizado": [], "actualizado_en": "…" }
```

### Errores

`401` token inválido o vencido (el cliente pide iniciar sesión de nuevo) · `413` foto muy grande ·
`5xx` reintentar más tarde (los cambios siguen seguros en el outbox local).

## Checklist para implementar la fase 3

1. Implementar `SyncRepository.sincronizar()` (esqueleto en `src/datos/remoto/RemoteRepository.ts`).
2. En `src/datos/index.ts`, si `config.modo === 'remoto'`, crear el `SyncRepository` y llamarlo al abrir la app y en el evento `online`.
3. Agregar inicio de sesión en Ajustes.
4. Implementar un `FotoStorage` remoto o subir las fotos dentro de `sincronizar()`.
5. Ninguna pantalla debería cambiar.
