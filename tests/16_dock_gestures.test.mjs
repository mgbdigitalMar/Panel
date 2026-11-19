import { DOCK_STYLE, DOCK_WEB_VARIABLES, dockTint, dockCellWidth, dockIndexAt, dockIndicatorX, dockPointInside } from '../shared/config/dock.js';

export async function runDockGestureTests() {
  let passed = 0;
  let failed = 0;
  const check = (description, condition) => {
    if (condition) passed++;
    else { failed++; console.error(`FAIL dock: ${description}`); }
  };
  for (const width of [240, 310, 350, 600]) {
    const cell = dockCellWidth(width, 5);
    for (let index = 0; index < 5; index++) {
      const center = 5 + index * (cell + 2) + cell / 2;
      check(`center ${index} at ${width}`, dockIndexAt(center, width, 5) === index);
      check(`marker ${index} at ${width}`, Math.abs(dockIndicatorX(center, width, 5) - index * (cell + 2)) < 0.001);
    }
    check(`left clamp ${width}`, dockIndexAt(-1000, width, 5) === 0 && dockIndicatorX(-1000, width, 5) === 0);
    check(`right clamp ${width}`, dockIndexAt(1000, width, 5) === 4 && dockIndicatorX(1000, width, 5) <= width - 10 - cell);
  }
  check('empty dock cannot navigate', dockIndexAt(40, 200, 0) === -1);
  check('unmeasured dock cannot navigate', dockIndexAt(40, 0, 5) === -1 && !dockPointInside(0, 0, 0, 64));
  check('thumb can drift slightly', dockPointInside(80, -20, 310, 64));
  check('dragging far above cancels', !dockPointInside(80, -60, 310, 64));
  check('dragging far below cancels', !dockPointInside(80, 120, 310, 64));
  check('dragging far beyond either edge cancels', !dockPointInside(-50, 30, 310, 64) && !dockPointInside(370, 30, 310, 64));
  check('web and app share dock height', DOCK_WEB_VARIABLES['--dock-height'] === `${DOCK_STYLE.height}px`);
  check('web and app share action size', DOCK_WEB_VARIABLES['--dock-action-size'] === `${DOCK_STYLE.actionSize}px`);
  check('off material is opaque', dockTint(0) === 'rgba(17,24,34,1)');
  check('intense material uses the same tint', dockTint(1) === 'rgba(17,24,34,0.72)');
  // Changing section from the dock moves the content like the app (forTabShift, BottomTabs.jsx)
  const fs = await import('node:fs');
  const layout = fs.readFileSync(new URL('../src/components/Layout.jsx', import.meta.url), 'utf8');
  const tokens = fs.readFileSync(new URL('../src/motion/tokens.js', import.meta.url), 'utf8');
  const appMotion = fs.readFileSync(new URL('../mobile/src/theme/motion.js', import.meta.url), 'utf8');
  check('web uses the app tab shift', /TAB_SHIFT = 12/.test(tokens) && /TAB_SHIFT = 12/.test(appMotion));
  check('web uses the app tab duration', /tab: 0\.22/.test(tokens) && /tab: 220/.test(appMotion));
  check('content enters from the side of its tab', layout.includes('x: dir * TAB_SHIFT') && layout.includes('x: -dir * TAB_SHIFT') && layout.includes('dockPosition(page) - dockPosition(tabShift.page)'));
  // One animation system: Motion on the web (one engine), Reanimated in the app
  const { execSync } = await import('node:child_process');
  const srcFiles = execSync('git ls-files src', { cwd: new URL('..', import.meta.url) }).toString().split('\n').filter((f) => /\.(jsx?|tsx?)$/.test(f) && fs.existsSync(new URL(`../${f}`, import.meta.url)));
  const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const pkg = JSON.parse(read('package.json'));
  check('web animates with motion/react only (no second engine)', !pkg.dependencies['framer-motion'] && srcFiles.every((f) => !read(f).includes("from 'framer-motion'") && !read(f).includes('from "framer-motion"')));
  check('lists move instead of jumping (web tables and feeds)', /useAutoAnimate\(LIST_MOTION\)/.test(read('src/components/Desk.jsx')) && read('src/components/Desk.jsx').includes('<tbody ref={body}>') && /useAutoAnimate\(LIST_MOTION\)/.test(read('src/components/Touch.jsx')));
  check('list timing shared by web and app', tokens.includes("LIST_MOTION = { duration: 200, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }") && /inOut: \[0\.77, 0, 0\.175, 1\]/.test(appMotion));
  const ui = read('mobile/src/components/common/UI.jsx');
  check('app rows fade in and out and slide into place', ui.includes('entering={ROW_ENTER} exiting={ROW_EXIT} layout={ROW_MOVE}') && ui.includes('export function ListItem'));
  check('app rows already on screen do not animate when it opens', read('mobile/src/components/common/Screen.jsx').includes('<LayoutAnimationConfig skipEntering>') && ui.includes('<LayoutAnimationConfig skipEntering>{children}</LayoutAnimationConfig>'));
  check('app lists that change use ListItem', ['mobile/src/screens/NotificationsScreen.jsx', 'mobile/src/screens/EmployeesScreen.jsx', 'mobile/src/screens/admin/AdminUsersScreen.jsx', 'mobile/src/screens/admin/AdminHoursScreen.jsx', 'mobile/src/screens/admin/AdminDocumentsScreen.jsx'].every((f) => read(f).includes('<ListItem key=')));
  check('sections are prefetched once the first page is up (no blank frame on first visit)', layout.includes("...['reservations', 'requests', 'horas'") && layout.includes("() => import('./ui/Select/SelectMenu')") && layout.includes('navigator.connection?.saveData'));
  // Dropdowns: anchored under their field and animated, never the system's full-screen picker
  check('no native <select> left in the web', srcFiles.every((f) => !/<select[\s>]/.test(read(f))));
  const selectMenu = read('src/components/ui/Select/SelectMenu.jsx');
  check('dropdowns are react-aria listboxes anchored under the field', selectMenu.includes('<Popover className={clsx(styles.popover, \'t-pop-aria\')} placement="bottom start"') && selectMenu.includes('<ListBox'));
  check('DeskSelect uses the same dropdown', /export function DeskSelect[^]*?<Select variant="pill"/.test(read('src/components/Desk.jsx')));
  check('react-aria loads after the page paints', read('src/components/ui/Select/Select.jsx').includes("lazy(() => import('./SelectMenu'))"));
  const transitions = read('src/styles/_transitions.scss');
  check('dropdowns grow from their field and leave faster', /\.t-pop-aria\[data-entering\] \{\s*opacity: 0;\s*translate: 0 -6px;\s*scale: 0\.97;/.test(transitions) && /\.t-pop-aria\[data-exiting\][^}]*transition-duration: 120ms/.test(transitions));
  check('dropdowns fade only under reduced motion', /prefers-reduced-motion: reduce\) \{\s*\.t-pop-aria,/.test(transitions));
  // Forms
  const globalCss = read('src/styles/global.scss');
  check('native checkboxes get the animated brand box', globalCss.includes(":where(input[type='checkbox']:checked)::after") && globalCss.includes('scale var(--dur-fast) var(--ease-bounce)'));
  check('a field nudges once when its error appears (not under reduced motion)', /\.hasError \{[^}]*animation: field-nudge 320ms/.test(read('src/components/ui/Input/Input.module.scss')));
  // Time fields: two scrolling columns in a glass popover, not the browser's time input
  const timeInput = read('src/components/ui/TimeInput/TimeInput.jsx');
  check('time fields use the picker', read('src/components/ui/Input/Input.jsx').includes("type === 'time' ? (") && read('src/components/ui/Input/Input.jsx').includes('<TimeInput'));
  check('the picker opens under its field with the dropdowns motion', timeInput.includes("<Popover className={clsx(styles.popover, 't-pop-aria')} placement=\"bottom start\""));
  check('hours and minutes are keyboard listboxes', timeInput.includes('aria-label="Hora"') && timeInput.includes('aria-label="Minutos"') && timeInput.includes('autoFocus={Boolean(hour)}'));
  check('choosing the minutes closes it; an empty field opens at the start of the day', timeInput.includes('pick(hour || DEFAULT_HOUR, m, true)') && timeInput.includes("const DEFAULT_HOUR = '09';"));
  return { passed, failed };
}
