# Activar el respaldo automático en Google Drive

El respaldo en Drive necesita un **ID de cliente OAuth** de Google. Es gratis y se crea una sola vez
por cada publicación de la app (si haces un fork, creas el tuyo). Sin este ID, la app funciona igual,
pero la opción de Drive no aparece.

> **Solo se usa el ID de cliente.** Nunca pongas el "secreto del cliente" (client secret) ni una
> clave de API en este proyecto: no hacen falta.
>
> El ID se guarda como **secreto de GitHub Actions**, así que no aparece en el código ni en los
> registros de Actions. Ojo: igual viaja dentro de la app publicada (el navegador lo necesita para
> abrir la ventana de Google), por lo que alguien con conocimientos podría verlo. Eso es normal y
> seguro: Google solo entrega permisos a los orígenes autorizados (tu dirección de GitHub Pages),
> y la app solo pide acceso a su carpeta oculta (`drive.appdata`).

## 1. Crear el proyecto (5 minutos)

1. Entra a <https://console.cloud.google.com/> con tu cuenta de Google.
2. Arriba, en el selector de proyectos › **Proyecto nuevo** › nombre `completometro` › **Crear**.
3. Menú ☰ › **APIs y servicios** › **Biblioteca** › busca **Google Drive API** › **Habilitar**.

## 2. Pantalla de consentimiento (lo que verán las personas)

1. **APIs y servicios** › **Pantalla de consentimiento de OAuth** (o "Google Auth Platform") › **Comenzar**.
2. Nombre de la app: `Completómetro`. Correo de asistencia: el tuyo. Público: **Externo**.
3. En **Acceso a datos** › **Agregar o quitar permisos**, agrega:
   - `.../auth/drive.appdata` (Ver, crear y borrar sus propios datos de configuración en tu Google Drive)
   - `.../auth/userinfo.email` (para mostrar "Conectado como …")
4. Mientras esté en modo **Prueba**, solo pueden conectarse las cuentas que agregues en
   **Público › Usuarios de prueba** (hasta 100). Agrega la tuya.
5. Para que cualquiera pueda usarla: **Público › Publicar app**. Estos permisos no son "sensibles",
   así que no requiere revisión de seguridad; Google puede pedir verificar el nombre y el logo.

## 3. Crear el ID de cliente

1. **APIs y servicios** › **Credenciales** (o "Clientes") › **Crear credenciales** › **ID de cliente de OAuth**.
2. Tipo: **Aplicación web**. Nombre: `Completómetro web`.
3. **Orígenes autorizados de JavaScript**:
   - `https://<tu-usuario>.github.io` (sin la ruta del repositorio)
   - `http://localhost:4173` y `http://localhost:5173` (para probar en tu computador)
4. No hace falta "URI de redireccionamiento". **Crear**.
5. Copia el ID: termina en `.apps.googleusercontent.com`.

## 4. Ponerlo en la app

**Publicación en GitHub Pages**: en tu repositorio › **Settings** › **Secrets and variables** › **Actions**
› pestaña **Secrets** › **New repository secret**:

- Nombre: `GOOGLE_CLIENT_ID`
- Valor: el ID copiado

O con GitHub CLI, desde la carpeta del proyecto (te pide el valor sin mostrarlo en pantalla):
`gh secret set GOOGLE_CLIENT_ID`

Luego **Actions** › **Publicar en GitHub Pages** › **Run workflow** (o haz cualquier commit).

**En tu computador**: crea `.env` con `VITE_GOOGLE_CLIENT_ID=<id>` y usa `npm run dev`.
El archivo `.env` está en `.gitignore`, así que nunca se sube a GitHub.

## 5. Pasar de "Prueba" a "Producción" (para que cualquiera pueda conectarse)

En modo Prueba solo entran las cuentas agregadas como usuarios de prueba (hasta 100).

1. En Google Cloud › **Google Auth Platform** › **Desarrollo de la marca** (o "Pantalla de consentimiento"), completa:
   - **Página principal de la app:** `https://<tu-usuario>.github.io/completometro/`
   - **Política de privacidad:** `https://<tu-usuario>.github.io/completometro/privacidad.html`
   - **Condiciones del servicio (opcional):** `https://<tu-usuario>.github.io/completometro/terminos.html`
   - **Dominios autorizados:** `<tu-usuario>.github.io`
   - Correo de contacto del desarrollador.
2. **Público** › **Publicar app** › **Confirmar**. El estado cambia a **"En producción"**.

Como la app solo pide permisos **no sensibles** (`drive.appdata` y `userinfo.email`), Google no exige
la revisión de seguridad ni pone límite de usuarios. Cualquiera con cuenta de Google puede conectarse.

**Opcional, verificar la marca:** mientras no esté verificada, la ventana de Google muestra el dominio
(`<tu-usuario>.github.io`) en vez de "Completómetro" y sin logo. Para mostrar el nombre y el logo hay que
**verificar la marca**: Google revisa el nombre, el logo, los enlaces y que seas dueño del dominio (se
verifica en [Google Search Console](https://search.google.com/search-console)). Es gratis y suele tardar
unos días hábiles. Si cambias el nombre o el logo después, hay que volver a verificar.

## Cómo funciona (resumen técnico)

- Inicio de sesión con Google Identity Services (modelo de token, todo en el navegador, sin servidor).
- Archivos en la carpeta oculta `appDataFolder`: `completometro-datos.json` + `foto-<id>.jpg`.
- Cada sincronización baja el JSON, lo junta con lo local (gana el último cambio por registro),
  sube las fotos nuevas y sube el JSON combinado. Por eso también sirve para restaurar en un
  teléfono nuevo y para usar la app en dos teléfonos.
- El token dura ~1 hora y queda solo en memoria. Los navegadores solo dejan abrir la ventana de
  Google desde un toque, así que la app renueva la sesión cuando la persona toca **Guardar completo**
  (si ya dio permiso, la ventana se abre y se cierra sola) o **Respaldar en Drive**.
- Código: `src/servicios/googleDrive.ts`, `src/servicios/respaldoDrive.ts`, `src/datos/sincronizarNube.ts`.
