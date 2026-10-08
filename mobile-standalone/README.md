# Margube · App Móvil (Expo SDK 57 / React Native 0.86)

Aplicación móvil independiente (iOS y Android) para la intranet de Margube. Esta versión es **100% autónoma y autosuficiente**, lista para trabajar en su propio repositorio sin depender de rutas externas del monorepo web.

---

## 🚀 Puesta en marcha rápida

### 1. Requisitos previos
- **Node.js** v18 o superior.
- **npm** v9 o superior.
- Dispositivo físico o emulador (Android / iOS).
- *(Opcional)* Cuenta en [Expo Application Services (EAS)](https://expo.dev/) para compilar APKs en la nube.

### 2. Instalación
```bash
# Instalar las dependencias exactas
npm install
```

### 3. Variables de entorno
Crea o revisa el archivo `.env` en la raíz del proyecto (tienes `.env.example` como plantilla):

```env
EXPO_PUBLIC_SUPABASE_URL=https://exaggikhxozcfsifwxeq.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_SaExpxl0EopS3TJPqqJDcg_SSU2Myvc
```

> **Nota:** Las credenciales públicas de Supabase también están configuradas en los perfiles `development`, `preview` y `production` de `eas.json` para las compilaciones de EAS Build.

### 4. Iniciar la aplicación
```bash
# Iniciar el bundler de Expo
npx expo start

# Opciones directas:
npx expo start --android    # Iniciar e intentar abrir en emulador/dispositivo Android
npx expo start --ios        # Iniciar e intentar abrir en simulador iOS
```

> **Importante:** La app utiliza módulos nativos (biometría con `expo-local-authentication`, notificaciones remotas con `expo-notifications`, selector de archivos y cámara con `expo-image-picker`). Para disponer de todas estas funciones en un dispositivo se recomienda usar una **Development Build** (`npm run build:dev`) o instalar la **APK de preview** (`npm run build:apk`).

---

## 📦 Cómo mover esta carpeta a un nuevo repositorio Git

Esta carpeta ya contiene todos los archivos necesarios y su propio `.gitignore`. Para subirla a un nuevo repositorio en GitHub:

```bash
# 1. Sitúate en la raíz de esta carpeta
cd /ruta/a/esta/carpeta

# 2. Inicializa git (si no está inicializado)
git init

# 3. Añade todos los archivos
git add .

# 4. Crea el primer commit
git commit -m "feat: initial commit for standalone mobile app"

# 5. Configura la rama principal y añade tu nuevo remoto
git branch -M main
git remote add origin https://github.com/TU-USUARIO-O-ORG/TU-NUEVO-REPO.git

# 6. Sube los cambios
git push -u origin main
```

---

## 🏗️ Compilación y Generación de APK (EAS Build)

El proyecto incluye `eas.json` listo para generar APKs descargables sin necesidad de configurar Android Studio:

```bash
# 1. Iniciar sesión en Expo EAS
npx eas-cli@latest login

# 2. Vincular el proyecto con tu cuenta de Expo (solo la primera vez)
npx eas-cli@latest init

# 3. Compilar APK instalable (perfil Preview)
npm run build:apk

# 4. Compilar APK de desarrollo (perfil Development)
npm run build:dev
```

### Ejecución nativa local (Android Studio / Gradle):
Si dispones de Android SDK y prefieres compilar localmente:
```bash
npm run run:android
```

---

## 🧪 Verificaciones y Diagnóstico

El proyecto cuenta con scripts de validación listos para usar:

```bash
# Verificar integridad de dependencias y compatibilidad con Expo SDK 57
npm run doctor

# Comprobar que el empaquetador Metro compila el bundle JS de Android al 100%
npm run bundle

# Ejecutar el linter para comprobar sintaxis y estilo de código
npm run lint
```

---

## 📁 Estructura del Proyecto

```
├── assets/             # Iconos adaptativos (Android), splash screens, logos y PDFs internos
├── shared/             # Servicios y constantes compartidas (internalizado y autosuficiente)
│   ├── config/         # Constantes de negocio, roles, estados y límites de archivo
│   ├── services/       # Clientes de Supabase para Auth, Documentos, Horas, Noticias, Notificaciones, etc.
│   └── utils/          # Utilidades comunes y manejo de errores (UserFacingError, logError)
├── src/
│   ├── components/     # Componentes visuales (Margube Glass, UI, GlassCard, LockOverlay, etc.)
│   ├── context/        # Contextos globales (AuthContext, DataContext con Realtime, Theme, Toast)
│   ├── hooks/          # Hooks personalizados (usePendingApprovals, etc.)
│   ├── lib/            # Cliente de Supabase y shims de bcrypt
│   ├── navigation/     # RootNavigator, BottomTabs y enrutamiento desde notificaciones push
│   ├── screens/        # Vistas de la aplicación (Dashboard, Fichaje, Documentos, Perfil, etc.)
│   │   └── admin/      # Vistas de gestión para administradores
│   ├── services/       # Módulos nativos: Biometría, push notifications, storage y subida de archivos
│   ├── shims/          # Shim de Node.js `crypto` usando `expo-crypto` para bcryptjs
│   ├── theme/          # Sistema de diseño, tokens de color (Dark Glass) y tipografía Geist
│   └── utils/          # Formato de fechas en español, iconos y reglas de dominio
├── supabase/           # Migraciones SQL y Edge Functions (send-push) para notificaciones
├── .env                # Variables de entorno locales con URLs y claves públicas de Supabase
├── .env.example        # Plantilla de variables de entorno
├── .gitignore          # Archivo de exclusión Git adaptado para React Native / Expo
├── App.js              # Punto de entrada de la UI, fuentes Geist y proveedores de contexto
├── app.json            # Configuración de la aplicación Expo, permisos de Android/iOS y plugins
├── eas.json            # Configuración de compilación en la nube para Expo EAS
├── eslint.config.js    # Configuración de ESLint con soporte para el alias `@shared/*`
├── index.js            # Registro del componente raíz en Expo
├── metro.config.js     # Configuración de Metro Bundler (resuelve `@shared/*` -> `./shared`)
├── package.json        # Dependencias y scripts del proyecto
└── README.md           # Esta guía de uso y despliegue
```

---

## 🔒 Seguridad y Diferencias con la Web

- **Autenticación:** La app valida contra la tabla `profiles` mediante hash bcrypt.
- **Primer inicio (`first_login = true`):** La contraseña temporal `margube2026` exige el cambio inmediato y prohíbe reutilizaciones.
- **Bloqueo por inactividad:** A los 30 minutos sin interacción se activa la pantalla de bloqueo `LockOverlay`, permitiendo desbloqueo instantáneo con huella/Face ID o contraseña.
- **Subida de justificantes:** Admite selección de imágenes y documentos PDF con verificación de tamaño máximo (15 MB) y almacenamiento en buckets de Supabase Storage.
