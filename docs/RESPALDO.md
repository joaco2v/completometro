# Respaldo de datos: opciones para personas no técnicas

El Completómetro guarda todo **en el teléfono** (IndexedDB del navegador). Es gratis y privado,
pero los datos se pierden si se borra el navegador o se cambia de teléfono. Este documento compara
las formas de respaldar, pensando en alguien que no quiere pelear con la tecnología.

## Lo que la app ya hace (versión actual)

| Opción | Qué hace la persona | Ventajas | Límites |
|---|---|---|---|
| **1. Guardar en la nube** (recomendada) | Toca "Guardar copia" → elige **Drive** (Android) o **Guardar en Archivos › iCloud Drive** (iPhone). | Funciona en todos lados, sin cuentas nuevas. La copia incluye las fotos. | Es manual (la app lo recuerda). |
| **2. WhatsApp o correo** | Mismo botón → elige WhatsApp ("Mensajes guardados" o un chat propio) o correo. | Lo que más gente ya sabe usar. | WhatsApp puede limitar archivos muy grandes (muchas fotos). |
| **3. Descargar** | "Descargar respaldo" → queda en *Descargas*. | No necesita internet. | No sirve si se pierde el teléfono. |
| **Exportar ZIP** | Para Power BI/Excel. También sirve para restaurar. | CSV + fotos + JSON. | Chrome no permite "compartir" un .zip: se descarga. |

Además:

- **Recordatorio suave**: aparece en el inicio cuando hay 3 registros y nunca se respaldó, o cuando
  pasaron **14 días** o se juntaron **15 cambios** sin respaldar. "Más tarde" lo pospone 3 días.
- **Almacenamiento persistente**: la app le pide al navegador que no borre los datos por falta de
  espacio (`navigator.storage.persist()`). Chrome lo concede casi siempre, sobre todo con la app instalada.
- **iPhone**: Safari puede borrar los datos de sitios que no se abren en 7 días **si no están instalados**.
  Instalar la app en la pantalla de inicio evita esa regla. Por eso la app insiste en instalarla.
- **Restaurar** acepta el `.json` o el `.zip` y no duplica nada (por `id`, gana el cambio más reciente).

> ¿Por qué el respaldo principal es un `.json` y no un `.zip`? Porque Chrome en Android solo deja
> compartir ciertos tipos de archivo (imágenes, PDF, texto, JSON…) y el ZIP no está en la lista.
> El `.json` lleva las fotos incrustadas, así que es un respaldo completo de un solo archivo.

## Próximo paso propuesto: respaldo automático

### A. Google Drive, carpeta privada de la app (recomendado para empezar)

Cómo lo viviría la persona:

1. En Ajustes toca **"Conectar con Google"** y acepta (una sola vez).
2. Desde ahí, la app guarda sola una copia cada vez que registras un completo (o una vez al día).
3. En un teléfono nuevo: instala la app, toca "Conectar con Google" y aparecen sus completos.

Detalles técnicos:

- Scope `https://www.googleapis.com/auth/drive.appdata`: la app solo ve **su propia carpeta oculta**,
  no los documentos de la persona. Google lo muestra como un permiso "no sensible".
- Se usa Google Identity Services (token en el navegador, sin servidor). Gratis.
- **Requisito para quien publique la app**: crear un proyecto en Google Cloud (gratis) y un
  "ID de cliente OAuth" para su dominio de GitHub Pages. Para forks, cada persona crea el suyo
  y lo pone en `.env` (`VITE_GOOGLE_CLIENT_ID`). Mientras la app esté en modo "prueba" en Google,
  solo pueden conectarse hasta 100 cuentas agregadas a mano; para abrirla a todos hay que publicarla
  (verificación de marca sencilla, sin costo).
- Limitación: el token dura ~1 hora; en segundo plano no se puede renovar sin la persona, así que
  el respaldo ocurre mientras la app está abierta (suficiente: se abre para registrar).

### B. Supabase (si se quiere sincronizar varios dispositivos en tiempo real)

- Inicio de sesión con enlace mágico al correo (sin contraseñas). Plan gratis generoso.
- Requiere crear un proyecto Supabase (base de datos + almacenamiento de fotos). Ver `docs/BACKEND.md`.
- Más trabajo y una cuenta más para el mantenedor; mejor experiencia multi-dispositivo.

### C. Descartadas o limitadas

- **iCloud**: no tiene API para apps web. En iPhone, lo práctico es la opción 1 (Guardar en Archivos).
- **Carpeta sincronizada en el computador** (File System Access API): solo Chrome de escritorio, y la app es para el teléfono.
- **Dropbox / OneDrive**: posibles con OAuth, como Google Drive, pero mucha menos gente los tiene en Chile.

**Recomendación**: implementar la opción A (Google Drive `appdata`) como "respaldo automático" opcional,
manteniendo las opciones manuales para quien no quiera conectar ninguna cuenta.
