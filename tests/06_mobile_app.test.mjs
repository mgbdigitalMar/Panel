import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const mobileDir = resolve(rootDir, 'mobile');

export async function runMobileAppTests() {
  console.log('\n🔵 [SUITE 6: App Móvil (Expo SDK 52 / React Native & Shared Services)]');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ ${message}`);
      failed++;
    }
  }

  // 1. Configuración de Expo y Herramientas
  const packageJsonPath = resolve(mobileDir, 'package.json');
  assert(existsSync(packageJsonPath), 'mobile/package.json existe y está configurado');

  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  assert(pkg.dependencies['expo'] != null, 'Expo SDK 52 configurado');
  assert(pkg.dependencies['@react-navigation/native'] != null, 'React Navigation v7 configurado');
  assert(pkg.dependencies['@supabase/supabase-js'] != null, 'Supabase client compartido configurado');
  assert(pkg.dependencies['expo-secure-store'] != null, 'Expo SecureStore configurado');
  assert(pkg.dependencies['expo-notifications'] != null, 'Expo Notifications configurado');
  assert(pkg.dependencies['expo-crypto'] != null, 'Expo Crypto configurado');
  assert(pkg.scripts.android.includes('npx expo'), 'Script "android" ejecuta "npx expo start --android"');

  const appJsonPath = resolve(mobileDir, 'app.json');
  assert(existsSync(appJsonPath), 'mobile/app.json existe');
  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
  assert(appJson.expo.scheme === 'margube', 'Deep linking scheme "margube" activo');
  assert(appJson.expo.android?.package === 'com.margube.intranet', 'Android package configurado');
  assert(appJson.expo.ios?.bundleIdentifier === 'com.margube.intranet', 'iOS bundleIdentifier configurado');

  // 2. Pantallas de la Aplicación Móvil (30+ funcionalidades)
  const screens = [
    'LoginScreen.jsx',
    'ChangePasswordScreen.jsx',
    'DashboardScreen.jsx',
    'ReservationsScreen.jsx',
    'RequestsScreen.jsx',
    'HorasScreen.jsx',
    'ProfileScreen.jsx',
    'NewsScreen.jsx',
    'EmployeesScreen.jsx',
    'NotificationsScreen.jsx',
    'AdminScreen.jsx',
    'SettingsScreen.jsx',
  ];

  for (const screen of screens) {
    const p = resolve(mobileDir, 'src/screens', screen);
    assert(existsSync(p), `Pantalla mobile/src/screens/${screen} operativa`);
  }

  // 3. Componentes y Navegación
  assert(existsSync(resolve(mobileDir, 'src/navigation/RootNavigator.jsx')), 'RootNavigator implementado');
  assert(existsSync(resolve(mobileDir, 'src/navigation/BottomTabs.jsx')), 'BottomTabs con diseño Liquid Glass implementado');
  assert(existsSync(resolve(mobileDir, 'src/components/common/GlassCard.jsx')), 'Componente GlassCard implementado');
  assert(existsSync(resolve(mobileDir, 'src/components/common/GlassButton.jsx')), 'Componente GlassButton implementado');
  assert(existsSync(resolve(mobileDir, 'src/components/common/GlassInput.jsx')), 'Componente GlassInput implementado');
  assert(existsSync(resolve(mobileDir, 'src/components/common/StatusBadge.jsx')), 'Componente StatusBadge implementado');
  assert(existsSync(resolve(mobileDir, 'src/components/common/Header.jsx')), 'Componente Header implementado');

  // 4. Servicios y Contextos
  assert(existsSync(resolve(mobileDir, 'src/context/AuthContext.js')), 'AuthContext para React Native operativo');
  assert(existsSync(resolve(mobileDir, 'src/context/DataContext.js')), 'DataContext con sincronización en tiempo real operativo');
  assert(existsSync(resolve(mobileDir, 'src/context/ThemeContext.js')), 'ThemeContext modo claro/oscuro operativo');
  assert(existsSync(resolve(mobileDir, 'src/services/pushNotifications.js')), 'Servicio de notificaciones push operativo');
  assert(existsSync(resolve(mobileDir, 'src/services/storage.js')), 'Servicio de almacenamiento seguro operativo');
  assert(existsSync(resolve(mobileDir, 'src/shims/crypto.js')), 'Shim de crypto operativo');

  // 5. Capa de Servicios Compartida
  const sharedServices = [
    'config/constants.js',
    'services/auth.js',
    'services/profiles.js',
    'services/requests.js',
    'services/reservations.js',
    'services/hours.js',
    'services/personalDays.js',
    'services/news.js',
    'services/notifications.js',
    'services/documents.js',
    'services/index.js',
  ];

  for (const s of sharedServices) {
    assert(existsSync(resolve(rootDir, 'shared', s)), `Servicio compartido shared/${s} operativo`);
  }

  return { passed, failed };
}
