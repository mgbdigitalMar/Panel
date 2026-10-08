# Margube · App móvil (Expo SDK 57)

App Android/iOS de la intranet. Usa la misma base de datos Supabase, las mismas tablas, los mismos canales Realtime y la misma lógica de negocio que la web (`../shared`). El diseño sigue el archivo «Margube · App móvil y Web» (Margube Glass).

## Puesta en marcha

```bash
cd mobile
npm install
npx expo start          # abre en un móvil con una development build
```

Las variables de conexión están en `mobile/.env` (local, no se sube a git) y en `eas.json` (builds):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_KEY=...   # clave publicable, la misma que usa la web
```

La app usa módulos nativos (biometría, notificaciones, cámara), así que **Expo Go no basta**: hay que instalar una development build (`npm run build:dev`) o la APK.

## Generar la APK

```bash
npx eas-cli@latest login
npx eas-cli@latest init        # solo la primera vez: crea el proyecto y añade extra.eas.projectId
npm run build:apk              # perfil "preview" → APK instalable
```

EAS sube el repositorio completo, así que la carpeta `../shared` debe estar en git (commit) antes de lanzar la build.

## Compilar la APK en local (Android Studio, sin EAS)

Usa el SDK de Android Studio y un **JDK 17**: el JDK 25 que trae Android Studio (`jbr`) rompe la configuración CMake del código nativo. Desde Git Bash:

```bash
export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.20.101-hotspot"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
npx expo prebuild --platform android --clean      # genera ./android (no se sube a git)
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64,arm64-v8a -Pkotlin.incremental=false
adb install -r app/build/outputs/apk/release/app-release.apk
```

`x86_64` es para el emulador y `arm64-v8a` para móviles reales. `-Pkotlin.incremental=false` evita un fallo de caché de Gradle en Windows («immutable workspace … has been modified»). Si aparece «zip END header not found», hay un `.jar` corrupto en `~/.gradle/caches/modules-2`: bórralo y vuelve a compilar.

La APK `release` lleva el JS embebido (con las variables de `.env`) y funciona sin `expo start`. Va firmada con la clave de depuración: vale para probar, no para publicar. Si cambia `app.json`, `app.config.js`, un plugin o `google-services.json`, hay que repetir el `prebuild`.

## Probar notificaciones push (APK independiente, sin Expo Go ni servidor)

El perfil `preview` genera una APK autónoma: lleva el JS dentro, no necesita `expo start` y recibe push igual que la versión final. En Android el push pasa por Firebase Cloud Messaging (FCM), así que hace falta configurarlo una vez.

1. **Proyecto EAS** (una sola vez)
   ```bash
   npm run eas:login
   npm run eas:init        # añade extra.eas.projectId a app.json → hacer commit
   ```
2. **Firebase** — en <https://console.firebase.google.com>:
   - Crear proyecto → *Añadir app Android* con el paquete `com.margube.intranet`.
   - Descargar `google-services.json` y guardarlo en `mobile/google-services.json` (se sube a git; `app.config.js` lo incluye automáticamente si existe).
   - *Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada*. Ese JSON es secreto: **no** va a git (está en `.gitignore`).
3. **Subir la clave FCM V1 a EAS**
   ```bash
   npm run eas:credentials
   # Android › preview (o production) › Google Service Account
   # › Manage your Google Service Account Key for Push Notifications (FCM V1)
   # › Set up… › Upload a new service account key  (elige el JSON del paso 2)
   ```
4. **Compilar e instalar**
   ```bash
   git add -A && git commit -m "Configura FCM"   # EAS solo sube lo que está en git
   npm run build:apk
   ```
   Al terminar, EAS da un enlace/QR: ábrelo en el móvil, descarga la APK e instálala (permitir «orígenes desconocidos»).
5. **Probar**: inicia sesión y acepta el permiso de notificaciones. El token se guarda en `push_tokens`. Con la app **en segundo plano o cerrada**, inserta una fila en `notifications` para tu usuario (o provoca una desde la web) y debe llegar el aviso. Con la app abierta no aparece banner a propósito: ya se muestra el toast en la app.

Para descartar el backend, se puede enviar un push directo al token (copiarlo de `push_tokens`) desde <https://expo.dev/notifications>.

Requisitos del backend: migración `supabase/migrations/20261006120000_push_notifications.sql` aplicada y `supabase functions deploy send-push --no-verify-jwt`.

## Comprobaciones

```bash
npx eslint App.js src          # lint (0 errores)
npx expo-doctor                # configuración y versiones
npm run bundle                 # compila el bundle JS de Android
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/context` | `AuthContext` (login, sesión, bloqueo por inactividad), `DataContext` (datos + Realtime), `ThemeContext`, `ToastContext` |
| `src/screens` | Una pantalla por cada vista del diseño; `admin/` para la parte de administración |
| `src/navigation` | `RootNavigator` (acceso → primer acceso → normas → app), `BottomTabs`, enlaces `margube://` |
| `src/services` | Almacenamiento seguro, archivos (subida, visor, CSV), push, biometría |
| `src/utils` | Fechas en español, reglas de horas/reservas/solicitudes |
| `../shared` | Servicios y constantes comunes con la web |

## Diferencias deliberadas con la web

- `margube2026` solo sirve en el primer acceso (`first_login = true`); después la app obliga a crear una contraseña propia y no permite reutilizarla. `test123` y `test1234` no se aceptan nunca.
- El directorio de empleados se carga sin la columna `password_hash`.
- Tras 30 min sin uso la sesión se pausa y se reanuda con huella o contraseña (la web cierra sesión al minuto).
- Las reservas se leen de la tabla `reservations` en lugar de la vista `reservations_full`, que no expone `employee_id`, `room_id` ni `vehicle_id`.
- Se detectan solapes de reserva antes de enviar y se proponen huecos libres.
