import fs from 'fs';
import path from 'path';

export async function runFrontendIntegrityTests() {
  console.log('\n🔵 [SUITE 5: Integridad del Frontend y Assets]');
  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✅ ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  const rootDir = process.cwd();

  // 1. Verificación de existencia de las 11 páginas de la aplicación
  const expectedPages = [
    'LoginPage.jsx',
    'DashboardPage.jsx',
    'AdminPage.jsx',
    'ChangePasswordPage.jsx',
    'EmployeesPage.jsx',
    'HorasPage.jsx',
    'NewsPage.jsx',
    'ProfilePage.jsx',
    'RequestsPage.jsx',
    'ReservationsPage.jsx',
    'SettingsPage.jsx'
  ];

  for (const pageName of expectedPages) {
    const pagePath = path.join(rootDir, 'src', 'pages', pageName);
    const exists = fs.existsSync(pagePath);
    if (exists) {
      const content = fs.readFileSync(pagePath, 'utf8');
      const hasExport = content.includes('export default') || content.includes('export function');
      assert(`Página src/pages/${pageName} existe y exporta un componente`, hasExport);
    } else {
      assert(`Página src/pages/${pageName} existe`, false);
    }
  }

  // 2. Verificación de componentes clave del sistema y librería UI
  const expectedComponents = [
    'src/components/Layout.jsx',
    'src/components/CommandPalette.jsx',
    'src/components/LiveToastContainer.jsx',
    'src/components/PolicyModal.jsx',
    'src/components/OnboardingModal.jsx',
    'src/components/ui/Button/Button.jsx',
    'src/components/ui/Input/Input.jsx',
    'src/components/ui/Modal/Modal.jsx',
    'src/components/ui/index.js'
  ];

  for (const compPath of expectedComponents) {
    const absPath = path.join(rootDir, compPath);
    assert(`Componente ${compPath} existe en el proyecto`, fs.existsSync(absPath));
  }

  // 3. Verificación de assets estáticos y PWA
  const expectedAssets = [
    'public/logo.png',
    'public/pwa-192x192.png',
    'public/pwa-512x512.png',
    'index.html',
    'vite.config.js',
    'vercel.json'
  ];

  for (const assetPath of expectedAssets) {
    const absPath = path.join(rootDir, assetPath);
    assert(`Asset esencial ${assetPath} existe`, fs.existsSync(absPath));
  }

  // 4. Verificación de configuración en index.html
  const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert('index.html contiene favicon apuntando a /logo.png', htmlContent.includes('/logo.png'));
  assert('index.html contiene meta viewport responsivo', htmlContent.includes('viewport'));

  // 5. Verificación de configuración moderna en vite.config.js
  const viteConfig = fs.readFileSync(path.join(rootDir, 'vite.config.js'), 'utf8');
  assert('vite.config.js incluye modern-compiler para Sass', viteConfig.includes('modern-compiler'));

  // 6. Verificación de cabeceras de seguridad en vercel.json
  const vercelConfig = fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf8');
  assert('vercel.json incluye cabecera X-Frame-Options', vercelConfig.includes('X-Frame-Options'));
  assert('vercel.json incluye cabecera X-Content-Type-Options: nosniff', vercelConfig.includes('nosniff'));

  return { passed, failed };
}
