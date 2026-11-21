# 🌭 Completómetro

Lleva la cuenta de todos los completos que te comes en el año. Una app web instalable (PWA):
gratis, sin tiendas de apps, sin cuentas y **sin internet**. Tus datos se quedan en tu teléfono.

- Registrar un completo toma segundos: cantidad, local y nota (1–10), emoción, nivel de hambre
  (de "nada" a "me comería toda la olla"), foto y ubicación automática.
- Resumen al abrir: total del año, hoy/semana/mes, promedio semanal, racha y emociones del mes.
- Dashboard: gráficos por semana o por mes, mapa de tus completos, ranking de locales y emociones.
- **Resumen del año** para compartir en historias de Instagram (banner desde el 31 de diciembre).
- Exporta a **CSV/ZIP para Power BI o Excel** y respalda en Drive, iCloud, WhatsApp o correo.

## 📲 Instalar la app (usuario)

1. Abre el link de la app en el teléfono.
2. **Android (Chrome)**: menú **⋮** › **Instalar app** (o "Agregar a pantalla principal").
   **iPhone (Safari)**: botón **Compartir** ↑ › **Agregar a pantalla de inicio**.
3. Listo: aparece el ícono 🌭 y funciona sin internet.

> En iPhone conviene instalarla: Safari puede borrar datos de páginas que no están instaladas
> y no se abren en una semana.

### Primeros pasos

- En **Ajustes › Contador inicial**, anota cuántos completos llevabas este año antes de usar la app.
- Toca **"¡Me comí un completo!"** cada vez. Si se te olvidó registrar uno, usa
  **"Cambiar (me olvidé de anotarlo)"** para ponerle la fecha y hora reales.
- La primera vez, el teléfono pedirá permiso de **ubicación**. Si lo niegas, puedes marcar el lugar en el mapa.

### Respaldo (importante)

Los datos viven solo en tu teléfono. En **Ajustes › Respaldo** tienes la guía paso a paso:
**Guardar copia** abre el menú de compartir del teléfono → elige Google Drive, "Guardar en Archivos"
(iCloud), WhatsApp o correo. Para cambiar de teléfono: instala la app en el nuevo y toca
**Importar respaldo**. La app te recordará respaldar de vez en cuando.
Opciones y planes de respaldo automático: [docs/RESPALDO.md](docs/RESPALDO.md).

## 📊 Usar los datos en Power BI

1. En la app: **Ajustes › Exportar ZIP**. Descomprímelo.
2. Power BI Desktop: **Obtener datos › Texto/CSV** › `completos.csv`.
3. El archivo es UTF-8 con BOM, separado por comas, con decimales con punto y fechas ISO.
   Si Power BI está en español y lee mal los decimales, en el editor de Power Query cambia el tipo
   de `latitud`/`longitud` con **"Usar configuración regional" › Inglés (Estados Unidos)**.
4. Para el **mapa**: visual de Mapa con `latitud` en Latitud y `longitud` en Longitud.
5. La columna `foto_archivo` indica qué imagen de la carpeta `fotos/` corresponde a cada fila.

Para probar sin datos reales: [ejemplos/completos_ejemplo.csv](ejemplos/completos_ejemplo.csv) (datos ficticios).

| Columna | Descripción |
|---|---|
| `id` | Identificador único del registro |
| `fecha_hora` | ISO 8601 con zona horaria (`2026-01-09T13:20:00-03:00`) |
| `fecha`, `hora`, `anio`, `mes`, `semana_inicio` | Para agrupar fácil (semana = lunes) |
| `numero_acumulado_anio` | N° de completo del año (incluye el contador inicial) |
| `cantidad` | Completos en ese registro |
| `tipo_lugar` | "Local establecido" / "Otro lugar" |
| `nombre_local`, `puntuacion` | Solo locales; nota de 1 a 10 |
| `emocion`, `emocion_emoji` | Emoción (etiqueta, sin valor numérico) |
| `hambre_nivel`, `hambre_texto` | 1 = nada … 5 = me comería toda la olla |
| `latitud`, `longitud`, `precision_gps_m`, `origen_coordenadas` | `gps`, `foto_exif` o `manual` |
| `foto_archivo`, `notas` | |

## 🍴 Haz tu propia copia (fork)

Cada persona que use tu link tiene sus propios datos en su teléfono (la app parte vacía).
Si igual quieres tu propia versión:

1. Crea una cuenta en GitHub (gratis) y toca **Fork** en este repositorio.
2. En tu fork: **Settings › Pages › Build and deployment › Source: GitHub Actions**.
3. Ve a **Actions**, habilita los workflows y ejecuta **"Publicar en GitHub Pages"** (o haz cualquier commit en `main`).
4. En unos minutos tu app queda en `https://<tu-usuario>.github.io/<nombre-del-repo>/`.
   Funciona con cualquier nombre de repositorio, no hay que configurar rutas.

## 🛠️ Desarrollo

Requisitos: [Node.js](https://nodejs.org) 22 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # pruebas (métricas, CSV, importación, conflictos)
npm run build      # versión de producción en dist/
npm run preview    # sirve dist/ (incluye service worker)
node scripts/generar-iconos.mjs   # regenera los íconos
```

Para probar en el teléfono durante el desarrollo, la ubicación y la instalación necesitan **https**:
lo más simple es publicar en GitHub Pages, o usar `npm run dev -- --host` en la misma red WiFi
(sin https el GPS no funciona, pero el resto sí).

### Stack

Vite + TypeScript + Preact · IndexedDB con `idb` · Leaflet + OpenStreetMap · uPlot (gráficos) ·
JSZip · exifr (GPS de las fotos) · vite-plugin-pwa (offline) · Vitest.
El dashboard, el mapa y el ZIP se cargan solo cuando se usan: el inicio pesa ~30 KB comprimido.

### Arquitectura

```
src/
├─ dominio/      Reglas puras y testeables: modelo, métricas, acumulado, conflictos, emociones, ajustes
├─ datos/        Contratos (RegistroRepository, FotoStorage, AjustesStore, Outbox),
│                implementación local IndexedDB con migraciones, CSV y respaldo
├─ servicios/    Navegador: ubicación, EXIF, compresión de fotos, compartir, instalación, imagen anual
└─ interfaz/     Pantallas (Inicio, Historial, Dashboard, Ajustes) y componentes
```

- Las pantallas **nunca** tocan IndexedDB: usan las interfaces de `datos/contratos.ts`.
- Cada registro tiene UUID, `creado_en`, `actualizado_en`, `eliminado_en` (borrado lógico) y
  `dispositivo_id`. Cada cambio queda en un **outbox** listo para sincronizar el día que haya backend.
- Conflictos: **gana el último cambio** según `actualizado_en`.
- Esquema versionado: las migraciones de IndexedDB están en `src/datos/local/db.ts`.
- Configuración por `.env` (`VITE_MODO=local|remoto`, `VITE_BACKEND_URL`). Sin `.env`, 100 % local.
- Contrato de API para el backend futuro: [docs/BACKEND.md](docs/BACKEND.md).

## Privacidad

Sin servidores, sin analítica, sin publicidad. Lo único que se descarga de internet son los mapas
de OpenStreetMap. Tus datos salen del teléfono solo cuando tú exportas o respaldas.
