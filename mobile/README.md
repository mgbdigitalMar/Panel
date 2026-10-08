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
