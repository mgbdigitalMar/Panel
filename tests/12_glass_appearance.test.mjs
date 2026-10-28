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
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
  const ctx = read('src', 'context', 'index.jsx');
  const layout = read('src', 'components', 'Layout.jsx');
  const chrome = read('src', 'components', 'GlassChrome.jsx');
  const dash = read('src', 'pages', 'DashboardPage.jsx');
  const glass = read('src', 'pages', 'DashboardGlass.jsx');
  const settings = read('src', 'pages', 'SettingsPage.jsx');
  const vars = read('src', 'styles', 'variables.scss');

  // 1. Preferencia de diseño
  assert('Cristal es el diseño por defecto y Clásico se puede elegir', ctx.includes("=== 'classic' ? 'classic' : 'glass'") && ctx.includes('setAppearance'));
  assert('Se aplica antes de pintar (sin parpadeo)', read('src', 'main.jsx').includes("'data-appearance'"));
  assert('Ajustes: selector Cristal / Clásico', settings.includes("{ id: 'glass',") && settings.includes("{ id: 'classic',") && settings.includes('setAppearance(id)'));

  // 2. El clásico sigue intacto
  assert('Clásico: barra lateral con perfil, secciones, ajustes y cerrar sesión', layout.includes('{!glass && (') && layout.includes('getSidebarContent(false)'));
  assert('Clásico: barra superior con buscador, hora, tema y campana', layout.includes('Busca personas, reservas, solicitudes…'));
  assert('Clásico: inicio de siempre cuando no es Cristal', dash.includes("if (appearance === 'glass')") && dash.includes('Mis módulos'));
  assert('Móvil clásico: el menú desplegable sigue', layout.includes('getSidebarContent(true)'));
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
  assert('Cristal: barra de carga de datos', layout.includes('<TopProgress active={loadingData} />\n          </GlassHeader>'));

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

  // 4b. Móvil: la web se ve como la app
  const glassCss = read('src', 'pages', 'DashboardGlass.module.scss');
  assert('Móvil: el inicio es el de ordenador, adaptado (fijadas en carrusel y reservas recientes en filas)',
    !glass.includes('DashboardPhone') && glass.includes('styles.recentList') && glassCss.includes('scroll-snap-type: x mandatory'));
  assert('Móvil: dock de la app — Inicio, Reservas, Solicitudes, Horas, Más y el «+»',
    chrome.includes("const DOCK_IDS = ['dashboard', 'reservations', 'requests', 'horas'];") && chrome.includes("id: 'mas'")
    && chrome.includes("onNavigate('requests?nueva=1')") && read('src', 'App.tsx').includes('path="/mas"'));
  assert('Móvil: «Más» con perfil, accesos, apariencia, ajustes y cerrar sesión',
    ['Accesos rápidos', 'Apariencia', "navigate('/settings')", 'logout()', "navigate('/profile')"].every((k) => read('src', 'pages', 'MorePage.jsx').includes(k)));
  assert('Móvil: Reservas, Solicitudes y Horas con las pantallas de la app',
    read('src', 'pages', 'ReservationsPage.jsx').includes('<ReservationsPhone') && read('src', 'pages', 'RequestsPage.jsx').includes('<RequestsPhone')
    && read('src', 'pages', 'HorasPage.jsx').includes('<HorasPhoneSummary'));
  assert('Móvil: perfil con modo de trabajo en segmentos y contraseña y documentos plegados',
    read('src', 'pages', 'ProfilePage.jsx').includes('<Segmented') && read('src', 'pages', 'ProfilePage.jsx').includes('aria-expanded={open}'));

  // 5. Estilo
  assert('Paneles translúcidos en la intranet y el login (modales siguen sólidos)', vars.includes("[data-appearance='glass'] :is(.app-shell, .glass-scope) {"));
  const login = read('src', 'pages', 'LoginPage.jsx');
  assert('Login: mismo fondo que la intranet en Cristal (escritorio y móvil)', (login.match(/glass \? <Wallpaper \/>/g) || []).length === 2 && login.includes("' glass-scope'"));
  const wp = read('src', 'components', 'Wallpaper.module.scss');
  assert('Fondo con los colores de Margube, no atardecer', wp.includes('rgba(47, 91, 234') && wp.includes('rgba(14, 159, 154') && !wp.includes('.windows'));
  assert('El desenfoque de tarjetas solo existe en Cristal', read('src', 'styles', '_patterns.scss').includes('backdrop-filter: var(--lg-card-blur, none);'));
  assert('Fondo de pantalla, con foto opcional en public/wallpaper.jpg', read('src', 'components', 'Wallpaper.jsx').includes("const PHOTO_URL = '/wallpaper.jpg'"));
  assert('Equipo: el selector de vista no se sale de la página', read('src', 'pages', 'EmployeesPage.module.scss').includes('min-width: min(430px, 100%);'));

  return { passed, failed };
}
