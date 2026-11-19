import fs from 'node:fs';

// Load-time rules for the web: they keep the first screen from waiting on work it does not need.
export async function runWebPerformanceTests() {
  let passed = 0;
  let failed = 0;
  const check = (description, condition) => {
    if (condition) passed++;
    else { failed++; console.error(`FAIL rendimiento: ${description}`); }
  };
  const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const size = (file) => fs.statSync(new URL(`../${file}`, import.meta.url)).size;

  const html = read('index.html');
  check('sin hojas de fuentes de terceros que bloqueen el primer pintado', !html.includes('fonts.googleapis.com') && !html.includes('fonts.gstatic.com'));
  // Measured: the app paints only after its JavaScript runs, so a preloaded font slowed that down
  check('las fuentes no se precargan (competían con el JavaScript que pinta la página)', !/rel="preload"[^>]*as="font"/.test(html));
  check('las fuentes se sirven desde la propia web', read('src/main.jsx').includes("import '@fontsource-variable/inter/opsz.css'"));

  // Images drawn small stay small (originals in src/assets/logos are kept for other uses)
  check('hoja de la cabecera por debajo de 30 kB', size('src/assets/logos/logo-icon-186.png') < 30 * 1024);
  check('logotipo con nombre por debajo de 30 kB', size('src/assets/logos/logo-color-90.png') < 30 * 1024);
  check('favicon por debajo de 10 kB', size('public/favicon-48.png') < 10 * 1024);
  check('fondo en WebP por debajo de 250 kB', size('public/wallpaper.webp') < 250 * 1024);
  const app = ['src/components/GlassChrome.jsx', 'src/pages/LoginPhone.jsx', 'src/pages/LoginPage.jsx', 'src/pages/ChangePasswordPage.jsx'].map(read).join('\n');
  check('la interfaz no importa los logotipos a tamaño original', !/logos\/logo-(icon|color)\.png/.test(app));
  check('la cabecera descarga un solo logotipo', app.includes('<picture>') && (read('src/components/GlassChrome.jsx').match(/<img /g) || []).length === 1);

  // The first screen does not wait on a chain of requests
  const ctx = read('src/context/index.jsx');
  check('perfil, plantilla y DNI se piden a la vez', /Promise\.all\(\[\s*supabase\.from\('profiles'\)\.select\('\*'\)\.eq\('id', id\)/.test(ctx) && !ctx.includes('loadProfile('));
  check('el código de la primera pantalla se pide al arrancar', read('src/App.tsx').includes('preloadFirstPage()'));

  const vite = read('vite.config.js');
  check('fuentes en caché tras el primer uso', vite.includes("request.destination === 'font'") && vite.includes("handler: 'CacheFirst'"));
  check('imágenes en caché y renovadas en segundo plano', vite.includes("request.destination === 'image'") && vite.includes("handler: 'StaleWhileRevalidate'"));

  // Start-up: the lists travel with the profile, and the first page is drawn once, complete
  const appTsx = read('src/App.tsx');
  check('las listas se piden junto al perfil al restaurar la sesión', appTsx.includes('startBootPrefetch()') && ctx.includes('export function startBootPrefetch'));
  check('al entrar, las listas salen junto al perfil', /const sessionData = loadSessionData\(res\.userId\)\s*prefetchUserData\(res\.userId/.test(ctx));
  check('la app se muestra con los datos ya llegados (sin un segundo pintado)', (ctx.match(/await bootSettled\(/g) || []).length >= 2);
  check('una página ya descargada se pinta sin suspender', appTsx.includes('readyPage(name)') && read('src/pageLoaders.js').includes('export function loadPage'));
  check('el login descarga el panel al primer gesto, no al cargar', /\['pointerdown', 'keydown', 'input'\]/.test(read('src/pages/LoginPage.jsx')) && read('src/pages/LoginPage.jsx').includes("loadPage('dashboard')"));
  const layout = read('src/components/Layout.jsx');
  check('paleta, atajos, política y bienvenida se cargan bajo demanda', ["import('./CommandPalette')", "import('./ShortcutsSheet')", "import('./PolicyModal')", "import('./OnboardingModal')"].every((s) => layout.includes(s)));
  check('el renderizador WebGL no viaja con el arranque', read('src/components/Wallpaper.jsx').includes("import('../glass/wallpaperGlass')") && !ctx.includes("from '../glass/wallpaperGlass'"));
  // App: same idea
  const appAuth = read('mobile/src/context/AuthContext.js');
  check('app: perfil y DNI a la vez', /Promise\.all\(\[\s*supabase\.from\('profiles'\)\.select\(PROFILE_COLUMNS\)/.test(appAuth));
  check('app: las listas salen junto al perfil', appAuth.includes('prefetchLists(id,') && read('mobile/src/context/DataContext.js').includes("viaBoot('requests'"));
  return { passed, failed };
}
