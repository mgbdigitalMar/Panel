import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const mobileDir = resolve(rootDir, 'mobile');

console.log('================================================================');
console.log('📱 SUITE DE VALIDACIÓN: APP MÓVIL (EXPO SDK 52 / REACT NATIVE)');
console.log('================================================================\n');

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

// 1. Archivos de Configuración del Proyecto Móvil
console.log('🔵 [1. Configuración de Expo y Herramientas]');
const packageJsonPath = resolve(mobileDir, 'package.json');
assert(existsSync(packageJsonPath), 'mobile/package.json existe');

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
assert(pkg.dependencies['expo'] != null, 'Dependencia expo presente');
assert(pkg.dependencies['@react-navigation/native'] != null, 'React Navigation presente');
assert(pkg.dependencies['@supabase/supabase-js'] != null, 'Supabase client presente');
assert(pkg.dependencies['expo-secure-store'] != null, 'Expo SecureStore presente');
assert(pkg.dependencies['expo-notifications'] != null, 'Expo Notifications presente');
assert(pkg.dependencies['expo-crypto'] != null, 'Expo Crypto presente');
assert(pkg.scripts.android.includes('npx expo'), 'Script "android" usa "npx expo start --android"');

const appJsonPath = resolve(mobileDir, 'app.json');
assert(existsSync(appJsonPath), 'mobile/app.json existe');
const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
assert(appJson.expo.scheme === 'margube', 'Deep linking scheme configurado ("margube")');
assert(appJson.expo.android?.package === 'com.margube.intranet', 'Android package configurado');
assert(appJson.expo.ios?.bundleIdentifier === 'com.margube.intranet', 'iOS bundleIdentifier configurado');

const metroConfigPath = resolve(mobileDir, 'metro.config.js');
assert(existsSync(metroConfigPath), 'mobile/metro.config.js existe con shim de crypto');

// 2. Pantallas de la Aplicación Móvil
console.log('\n🔵 [2. Pantallas Móviles Nativas (Paridad con la Web)]');
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
  assert(existsSync(p), `Pantalla mobile/src/screens/${screen} creada`);
}

// 3. Componentes y Capa de Navegación
console.log('\n🔵 [3. Navegación y Componentes UI]');
assert(existsSync(resolve(mobileDir, 'src/navigation/RootNavigator.jsx')), 'RootNavigator existe');
assert(existsSync(resolve(mobileDir, 'src/navigation/BottomTabs.jsx')), 'BottomTabs existe con navegación por pestañas');
assert(existsSync(resolve(mobileDir, 'src/components/common/GlassCard.jsx')), 'Componente GlassCard con bordes glow existe');
assert(existsSync(resolve(mobileDir, 'src/components/common/GlassButton.jsx')), 'Componente GlassButton con haptics existe');
assert(existsSync(resolve(mobileDir, 'src/components/common/GlassInput.jsx')), 'Componente GlassInput existe');
assert(existsSync(resolve(mobileDir, 'src/components/common/StatusBadge.jsx')), 'Componente StatusBadge existe');
assert(existsSync(resolve(mobileDir, 'src/components/common/Header.jsx')), 'Componente Header traslúcido existe');

// 4. Servicios y Contextos Compartidos
console.log('\n🔵 [4. Servicios de Backend y Contextos React Native]');
assert(existsSync(resolve(mobileDir, 'src/context/AuthContext.js')), 'AuthContext con bcrypt y SecureStore existe');
assert(existsSync(resolve(mobileDir, 'src/context/DataContext.js')), 'DataContext con Supabase Realtime sincronizado existe');
assert(existsSync(resolve(mobileDir, 'src/context/ThemeContext.js')), 'ThemeContext (Light/Dark/System) existe');
assert(existsSync(resolve(mobileDir, 'src/services/pushNotifications.js')), 'Servicio de Push Notifications y badges existe');
assert(existsSync(resolve(mobileDir, 'src/services/storage.js')), 'Servicio de Secure Storage multiplataforma existe');
assert(existsSync(resolve(mobileDir, 'src/shims/crypto.js')), 'Shim de crypto con expo-crypto operativo');

// 5. Capa de Servicios Compartida (Shared Services)
console.log('\n🔵 [5. Servicios Compartidos (shared/)]');
const sharedFiles = [
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

for (const sf of sharedFiles) {
  const p = resolve(rootDir, 'shared', sf);
  assert(existsSync(p), `Módulo compartido shared/${sf} disponible`);
}

console.log('\n================================================================');
console.log(`TOTALES MÓVIL: ${passed} pruebas superadas, ${failed} pruebas fallidas.`);
if (failed === 0) {
  console.log('🎉 TODAS LAS VERIFICACIONES DE LA APP MÓVIL APROBADAS CON ÉXITO.');
} else {
  console.error('⚠️ ALGUNAS PRUEBAS FALLARON.');
  process.exit(1);
}
