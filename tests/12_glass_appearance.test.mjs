import fs from 'fs';
import path from 'path';

export async function runGlassAppearanceTests() {
  console.log('\n🔵 [SUITE 12: Diseño Cristal (sin perder funciones del clásico)]');
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

  const root = process.cwd();
  // Normalised line endings: on Windows git checks the sources out with CRLF
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8').replace(/\r\n/g, '\n');
  const ctx = read('src', 'context', 'index.jsx');
  const layout = read('src', 'components', 'Layout.jsx');
  const chrome = read('src', 'components', 'GlassChrome.jsx');
  const dash = read('src', 'pages', 'DashboardPage.jsx');
  const glass = read('src', 'pages', 'DashboardGlass.jsx');
  const settings = read('src', 'pages', 'SettingsPage.jsx');
  const vars = read('src', 'styles', 'variables.scss');

  // 1. Un solo diseño: Cristal (el Clásico se ha retirado)
  assert('Solo existe el diseño Cristal: sin preferencia ni selector', !ctx.includes('setAppearance') && !ctx.includes('app-appearance')
    && !settings.includes("id: 'classic'") && !settings.includes('Clásico') && !settings.includes('setAppearance'));
  assert('El diseño viene fijado en el HTML (sin parpadeo) y se olvida la preferencia antigua',
    read('index.html').includes('<html lang="es" data-appearance="glass">') && read('src', 'main.jsx').includes("localStorage.removeItem('app-appearance')"));
  assert('Sin barra lateral, cajón ni cabecera del diseño Clásico', !layout.includes('getSidebarContent') && !layout.includes('Busca personas, reservas, solicitudes…')
    && layout.includes('<GlassHeader') && layout.includes('<Wallpaper />'));
  assert('Inicio: siempre el de Cristal (en táctil, su composición propia)', dash.includes('touch ? DashboardTouch : DashboardGlass') && !dash.includes('Mis módulos') && !dash.includes('appearance'));
  assert('Sin el fondo animado del diseño Clásico', !read('src', 'components', 'ui', 'index.js').includes('AnimatedBackdrop')
    && read('src', 'pages', 'ChangePasswordPage.jsx').includes('<Wallpaper />'));
  const chromeStyles = read('src', 'components', 'GlassChrome.module.scss');
  assert('Móvil Cristal: la sección abierta con nombre, el resto solo icono',
    layout.includes('<GlassTabBar') && chrome.includes('{items.map((item) => {') && chrome.includes('{active && <span className={styles.tabLabel}>'));
  assert('iPad Cristal: las secciones en la barra superior, sin dock', /\.dock \{[\s\S]*?@media \(min-width: 768px\) \{ display: none; \}/.test(chromeStyles)
    && /\.nav \{[\s\S]*?@media \(max-width: 767px\) \{ display: none; \}/.test(chromeStyles));
  assert('Cristal: logo con nombre en ordenador y solo la hoja en móvil y iPad', chrome.includes('isDark ? logoWhite : logoColor') && chrome.includes('className={styles.brandIcon}'));
  assert('Móvil Cristal: sin menú lateral que repita el perfil del avatar', !chrome.includes('onOpenMenu') && !layout.includes('onOpenMenu'));
  const chromeCss = read('src', 'components', 'GlassChrome.module.scss');
  assert('Menús y dock legibles: cristal denso', chromeCss.includes('@mixin frosted-dense') && /\.menu \{\s*@include frosted-dense;/.test(chromeCss) && chromeCss.includes('var(--lg-popover, rgba(255, 255, 255, 0.86))'));
  assert('Los avisos quedan por encima del dock', read('src', 'components', 'LiveToastContainer.jsx').includes('var(--toast-bottom, 24px)'));

  // 3. Cristal: navegación completa
  assert('Cristal: todas las secciones en la píldora (Admin solo para admins)', layout.includes("items={user?.role === 'admin' ? [...navItems, ...adminItems] : navItems}"));
  assert('Cristal: insignias de pendientes en la píldora', chrome.includes('badges[item.badgeKey]'));
  assert('Cristal: misma campana de notificaciones', layout.includes('bell={bellNode}') && layout.includes('{bellNode}'));
  assert('Cristal: sin dock lateral (todo lo que tenía ya está arriba)', !chrome.includes('GlassDock') && !layout.includes('GlassDock'));
  assert('Cristal: botón de tema claro/oscuro en la barra superior', chrome.includes('onClick={onToggleTheme}') && layout.includes('onToggleTheme={() => setMode('));
  assert('Cristal: búsqueda (Ctrl+K), perfil, ajustes y cerrar sesión siguen arriba',
    ['onSearch', "go('profile')", "go('settings')", 'onLogout'].every(k => chrome.includes(k)));
  assert('Cristal: atajos de teclado siguen con «?» y desde el buscador', layout.includes("if (e.key === '?')") && layout.includes('onShowShortcuts={openShortcuts}'));
  assert('Cristal: el logo lleva al inicio', chrome.includes("onClick={() => onNavigate('dashboard')}") && chrome.includes('aria-label="Margube, ir al inicio"'));
  assert('Cristal: la sección abierta va en azul y subrayada (dock y píldora)', /\.tabActive \{[\s\S]*?color: var\(--accent\);[\s\S]*?&::after/.test(chromeCss) && /\.navItemActive \{[\s\S]*?color: var\(--accent\);[\s\S]*?&::after/.test(chromeCss));
  assert('Cristal: cristal líquido en el buscador, el dock y la píldora', chrome.includes('clsx(styles.round, styles.liquid)') && /\.tabBar \{\s*@include p\.liquid;/.test(chromeCss) && /\.nav \{\s*@include p\.liquid;/.test(chromeCss));
  assert('Cristal: el avatar muestra jornada, reservas y pendientes del perfil clásico',
    chrome.includes('upcomingCount') && chrome.includes('openRequests') && chrome.includes('Jornada'));
  assert('Cristal: barra de carga de datos', /<TopProgress active=\{loadingData\} \/>\s*<\/GlassHeader>/.test(layout));

  // 4. Cristal: el inicio conserva todos los módulos
  const modules = [
    ['saludo y jornada', 'greeting'], ['nueva solicitud', "/requests?nueva=1"], ['nueva reserva', "/reservations?nueva=1"],
    ['4 indicadores', 'Noticias publicadas'], ['reservas semanales con meses', 'prevMonth'], ['solicitudes por mes con años', 'prevYear'],
    ['mis reservas', 'myUpcoming'], ['mis solicitudes', 'myRequests'], ['tiempo a compensar', 'hours.balance'],
    ['cumpleaños', 'upcomingBirthdays'], ['fuera de la oficina hoy', '<TodayPanel />'], ['uso de recursos', 'resourceTypePie'],
    ['ayuda de RRHH', 'Contactar con RRHH'], ['normas internas', 'onboardingDocUrl'], ['noticias', 'Noticias recientes'], ['noticias fijadas', 'pinnedNews'],
    ['reservas recientes', 'Reservas recientes'],
  ];
  for (const [name, needle] of modules) assert(`Inicio Cristal: ${name}`, glass.includes(needle));
  assert('Inicio Cristal: Semana / Mes / Año', glass.includes("{ id: 'week', label: 'Semana' }") && glass.includes("{ id: 'year', label: 'Año' }"));
  assert('Inicio Cristal: las barras tienen eje Y (recharts 3 no las dibuja sin él)', glass.includes('<YAxis hide'));
  assert('Inicio Cristal: las fijadas van primero y no se repiten abajo', glass.includes('news.filter((n) => n.pinned)') && glass.includes('news.filter((n) => !n.pinned)'));
  assert('Inicio Cristal: gráfica vacía con mensaje', glass.includes('chartEmpty &&') && glass.includes('Todavía no hay reservas esta semana.'));
  assert('Inicio Cristal: sin la barra de jornada repetida en el saludo', !glass.includes('workdayTrack'));
  assert('Inicio Cristal: «Hoy» no repite la fecha ni los botones de crear', !glass.includes('<p className={styles.panelSub}>{dateLine}</p>') && glass.split("/reservations?nueva=1").length === 2);
  assert('Inicio Cristal: filas que se estiran (sin huecos)', read('src', 'pages', 'DashboardGlass.module.scss').includes('align-items: stretch;'));

  // 4b. Móvil y tablet: composiciones táctiles propias de la web (no copian la app de Expo)
  const glassCss = read('src', 'pages', 'DashboardGlass.module.scss');
  const globalCssTouch = read('src', 'styles', 'global.scss');
  const touchKit = read('src', 'components', 'Touch.jsx');
  const srcFiles = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? srcFiles(path.join(dir, d.name)) : /\.(jsx?|tsx?|scss)$/.test(d.name) ? [path.join(dir, d.name)] : []);
  const webSources = srcFiles('src').filter((f) => !path.basename(f).startsWith('__'));
  assert('Táctil: solo por debajo de 1024 px (el escritorio no cambia)',
    read('src', 'hooks', 'useMediaQuery.js').includes("export const TOUCH_QUERY = '(max-width: 1023px)';") && touchKit.includes('useMediaQuery(TOUCH_QUERY)'));
  assert('Táctil: la web no importa nada de la app móvil ni conserva su kit de pantallas',
    webSources.every((f) => !/from ['"][./]*mobile\//.test(fs.readFileSync(path.join(root, f), 'utf8')))
    && !fs.existsSync(path.join(root, 'src', 'components', 'PhoneKit.jsx'))
    && !webSources.some((f) => /(Requests|Reservations|Horas)Phone\.jsx$/.test(f)));
  assert('Táctil: kit propio — cabecera sobre el fondo, cifras, panel de marca, accesos, filtros, filas que se abren y pliegues',
    ['export function Masthead', 'export function Ledger', 'export function Spotlight', 'export function ActionTiles',
      'export function TabStrip', 'export function Toolbar', 'export function FeedItem', 'export function Fold', 'export function TouchEmpty'].every((k) => touchKit.includes(k)));
  assert('Móvil y tablet: Inicio con su composición táctil (el de ordenador sigue igual)',
    dash.includes("const Composition = touch ? DashboardTouch : DashboardGlass;")
    && glass.includes('styles.recentList') && glassCss.includes('scroll-snap-type: x mandatory'));
  assert('Móvil: dock de la app — Inicio, Reservas, Solicitudes, Horas, Más y el «+»',
    chrome.includes("const DOCK_IDS = ['dashboard', 'reservations', 'requests', 'horas'];") && chrome.includes("id: 'mas'")
    && chrome.includes("onNavigate('requests?nueva=1')") && read('src', 'App.tsx').includes('path="/mas"'));
  assert('Dock: se encoge mientras se desplaza la pantalla y vuelve a su tamaño al parar (web y app)',
    chrome.includes('scrolling && styles.dockCompact') && read('src', 'components', 'GlassChrome.module.scss').includes('.dockCompact {')
    && read('src', 'hooks', 'useScrolling.js').includes("addEventListener('scroll', onScroll, { passive: true })")
    && read('mobile', 'src', 'navigation', 'BottomTabs.jsx').includes('tabBarCompact.interpolate')
    && read('mobile', 'src', 'components', 'common', 'Screen.jsx').includes('onScroll={tabBarSpace ? onTabScreenScroll : undefined}')
    && read('mobile', 'src', 'navigation', 'tabBarScroll.js').includes('useNativeDriver: true'));
  const more = read('src', 'pages', 'MorePage.jsx');
  assert('Móvil: «Más» con perfil, accesos, ajustes y cerrar sesión, cada uno una sola vez',
    ['Accesos rápidos', "navigate('/settings')", 'logout()', "navigate('/profile')"].every((k) => more.includes(k))
    && more.split("navigate('/profile')").length === 2 && more.split("navigate('/settings')").length === 2);
  assert('Móvil y tablet: Reservas, Solicitudes, Horas y Equipo con sus composiciones táctiles',
    read('src', 'pages', 'ReservationsPage.jsx').includes('<ReservationsTouch') && read('src', 'pages', 'RequestsPage.jsx').includes('<RequestsTouch')
    && read('src', 'pages', 'HorasPage.jsx').includes('<HorasTouchRecords') && read('src', 'pages', 'EmployeesPage.jsx').includes('<EmployeesTouch'));
  assert('Táctil: las acciones de cada fila conservan sus funciones (aprobar, rechazar, eliminar, calendario, justificante, CSV)',
    ['onApprove(r.id)', 'onReject(r.id)', 'onDelete(r.id)', 'onAddToCalendar(r)', 'onExport(agenda)'].every((k) => read('src', 'pages', 'ReservationsTouch.jsx').includes(k))
    && ['onApprove(r)', 'onReject(r)', 'onDelete(r)', 'download="justificante"', 'onExport(filtered)'].every((k) => read('src', 'pages', 'RequestsTouch.jsx').includes(k)));
  assert('Táctil: las tablas que quedan (Administración) pasan a fichas con etiquetas y acciones al pie',
    globalCssTouch.includes("td[data-label='Acciones'] {") && globalCssTouch.includes('Phones and tablets: each row becomes a record card'));
  assert('Móvil y tablet: perfil con modo de trabajo en opciones con nombre y contraseña y documentos plegados',
    read('src', 'pages', 'ProfilePage.jsx').includes('styles.modeChoice') && read('src', 'pages', 'ProfilePage.jsx').includes('aria-expanded={open}'));

  // 4c. Safari en iOS: el lienzo bajo las barras sigue al fondo (no el casi negro de --bg)
  const globalCss = read('src', 'styles', 'global.scss');
  const indexHtml = read('index.html');
  assert('Safari: el lienzo del documento usa el color del fondo Cristal en cada tema',
    globalCss.includes("html { background: var(--canvas, var(--bg)); }") && globalCss.includes("[data-appearance='glass'][data-theme='dark'] { --canvas: #0A1321; --canvas-top-rgb: 16, 25, 54; }"));
  assert('Safari: la cabecera del móvil tapa el contenido bajo la barra de estado y da el color de arriba',
    /background-color: rgba\(var\(--canvas-top-rgb\), 0\.5\);/.test(chromeStyles) && chromeStyles.includes('backdrop-filter: blur(18px) saturate(160%);'));
  assert('Safari: alturas mínimas en svh (la página no se recoloca al plegarse la barra)',
    read('src', 'components', 'Layout.module.scss').includes('min-height: 100svh;') && !read('src', 'components', 'Layout.module.scss').includes('min-height: calc(100dvh'));
  assert('Safari: el fondo Cristal llega bajo la barra de estado y la barra inferior',
    /\.wallpaper \{[\s\S]*?top: -120px;[\s\S]*?bottom: -120px;/.test(read('src', 'components', 'Wallpaper.module.scss')));
  assert('Safari: tema y apariencia aplicados antes del primer pintado (sin destello)',
    indexHtml.includes("localStorage.getItem('app-theme-mode')") && indexHtml.includes("html { background: #0A1321; }") && indexHtml.includes("html[data-theme='light'] { background: #DEEBF6; }"));
  assert('Safari: bajo las barras se ve el degradado del fondo, no una franja gris plana',
    globalCss.includes("html[data-appearance='glass'] {") && globalCss.includes('background-size: 100% 100lvh;')
    && read('src', 'components', 'Wallpaper.module.scss').includes('background: transparent;'));
  assert('Desde la pantalla de inicio se abre a pantalla completa (sin las barras de Safari)',
    read('vite.config.js').includes("display: 'standalone'") && indexHtml.includes('apple-mobile-web-app-capable') && indexHtml.includes('black-translucent') && indexHtml.includes('viewport-fit=cover'));
  const loginPhone = read('src', 'pages', 'LoginPhone.jsx');
  assert('Login móvil y tablet web: inspirado en el de la app (monograma, píldora Margube, hoja flotante, «sesión» subrayado) sin perder recordarme, la ayuda ni el aviso de inactividad',
    loginPhone.includes('<Monogram />') && loginPhone.includes('styles.pill') && loginPhone.includes('styles.grab') && loginPhone.includes('styles.underlined')
    && loginPhone.includes('Recordarme') && loginPhone.includes('¿Primer acceso o contraseña olvidada?') && loginPhone.includes('{idleText}')
    && read('src', 'pages', 'LoginPage.jsx').includes('<LoginPhone') && read('src', 'pages', 'LoginPage.jsx').includes("useNarrow(query = '(max-width: 1023px)')")
    && loginPhone.includes('<Wallpaper />'));

  // 5. Estilo
  assert('Paneles translúcidos en la intranet y el login (modales siguen sólidos)', vars.includes("[data-appearance='glass'] :is(.app-shell, .glass-scope) {"));
  const login = read('src', 'pages', 'LoginPage.jsx');
  assert('Login: mismo fondo y cristal liquid que la intranet (escritorio y móvil)',
    login.includes('<Wallpaper />') && login.includes('glass-scope') && !login.includes('AnimatedBackdrop')
    && read('src', 'pages', 'LoginPhone.jsx').includes('<Wallpaper />') && /\.sheet \{\s*@include p\.liquid;/.test(read('src', 'pages', 'LoginPhone.module.scss')));
  const wp = read('src', 'components', 'Wallpaper.module.scss');
  assert('Fondo con los colores de Margube, no atardecer', wp.includes('rgba(47, 91, 234') && wp.includes('rgba(14, 159, 154') && !wp.includes('.windows'));
  assert('El desenfoque de tarjetas solo existe en Cristal', read('src', 'styles', '_patterns.scss').includes('backdrop-filter: var(--lg-card-blur, none);'));
  assert('Fondo de pantalla, con foto opcional en public/wallpaper.jpg', read('src', 'components', 'Wallpaper.jsx').includes("const PHOTO_URL = '/wallpaper.jpg'"));
  assert('Equipo: el selector de vista no se sale de la página', read('src', 'pages', 'EmployeesPage.module.scss').includes('min-width: min(430px, 100%);'));

  return { passed, failed };
}
