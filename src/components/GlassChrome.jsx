import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform, animate } from 'motion/react';
import clsx from 'clsx';
import {
  Search, UserRound, SlidersHorizontal, LogOut, Clock, LayoutGrid, Plus, Calendar, Inbox,
  Timer, ChevronDown, Home, CalendarDays,
} from 'lucide-react';
import logoIcon from '../assets/logos/logo-icon-186.png';
import logoColor from '../assets/logos/logo-color-90.png';
import logoWhite from '../assets/logos/logo-white.png';
import { LEAF_PATH, VEIN_PATH } from './ui/Loader/Loader';
import { useScrolling } from '../hooks/useScrolling';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useDockScrub } from '../hooks/useDockScrub';
import { DOCK_STYLE, DOCK_GAP, dockCellWidth, dockWebVariables } from '../../shared/config/dock';
import { useTheme } from '../context';
import { EASE, SPRING, popoverMotion } from '../motion/tokens';
import { createGlassThemeToggle } from '../glass/glass-theme-toggle';
import styles from './GlassChrome.module.scss';

// Short labels for the top pill; the full name stays in the tooltip and for screen readers
const SHORT = {
  mas: 'Más', dashboard: 'Inicio', reservations: 'Reservas', requests: 'Solicitudes', horas: 'Horas',
  news: 'Noticias', employees: 'Equipo', admin: 'Admin',
  assistant: 'Asistente',
};

/** Hook for the small dropdowns of the bar: closes on an outside click and on Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

/**
 * Top bar of the glass appearance.
 * Computers (1024 px and up): the logo with the open section, a wide search capsule, «Nuevo», the
 * clock, theme, bell and profile. The sections live in the floating rail (GlassRail).
 * Tablets: logo, search button, the section pill in the middle and the same tools.
 * Phones: logo, search and bell; the sections go to the bottom dock.
 */
// Same width as the .crumbs capsule in GlassChrome.module.scss
const CRUMBS_CAPSULE = '(min-width: 1367px)';

export function GlassHeader({
  items, page, badges, onNavigate, onSearch, clockStr, bell, avatar, section,
  user, workday, upcomingCount = 0, openRequests = 0, onLogout, isDark, onToggleTheme, children,
}) {
  const SectionIcon = section?.icon;
  // The logo sits in a glass capsule only on computers (.crumbs). On phones and tablets it stands
  // alone, so it must not be glass: refracting a bare box drew a square of wallpaper behind the leaf
  const crumbsGlass = useMediaQuery(CRUMBS_CAPSULE);
  return (
    <header className={styles.header} role="banner">
      <div className={styles.left}>
        {/* Computer: the logo with the name · phones and tablets: just the leaf. Both go home. */}
        <div className={styles.crumbs} data-liquid={crumbsGlass ? '' : undefined}>
          <button type="button" className={styles.brand} onClick={() => onNavigate('dashboard')} aria-label="Margube, ir al inicio" title="Inicio">
            {/* One image, chosen by width: the hidden one of two <img>s was downloaded as well */}
            <picture>
              <source media="(min-width: 1367px)" srcSet={isDark ? logoWhite : logoColor} />
              <img src={logoIcon} alt="" className={styles.brandMark} />
            </picture>
          </button>
          {section?.label && (
            <span className={styles.crumb}>
              {SectionIcon && <SectionIcon size={15} aria-hidden="true" />}
              {section.label}
            </span>
          )}
        </div>
        <button type="button" data-liquid className={clsx(styles.round, styles.liquid, styles.searchRound)} onClick={onSearch} aria-label="Buscar (Ctrl+K)" aria-haspopup="dialog" title="Buscar · Ctrl K">
          <Search size={17} aria-hidden="true" />
        </button>
      </div>

      {/* Tablets: the sections in a pill (computers have the rail, phones the dock) */}
      <nav className={styles.nav} data-liquid aria-label="Navegación principal">
        {items.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          const badge = item.badgeKey ? badges[item.badgeKey] || 0 : 0;
          return (
            <button
              key={item.id}
              type="button"
              className={clsx(styles.navItem, active && styles.navItemActive)}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={badge ? `${item.label}, ${badge} pendientes` : item.label}
              title={item.label}
            >
              {active && (
                <motion.span
                  layoutId="glass-nav-pill"
                  className={styles.navPill}
                  transition={SPRING.indicator}
                  aria-hidden="true"
                />
              )}
              <Icon size={16} aria-hidden="true" />
              <span className={styles.navLabel}>{SHORT[item.id] || item.label}</span>
              {badge > 0 && <span className={styles.navBadge} aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* Computers: one wide capsule opens the command palette */}
      <button type="button" data-liquid className={styles.searchBar} onClick={onSearch} aria-haspopup="dialog" aria-label="Buscar (Ctrl+K)">
        <Search size={17} aria-hidden="true" />
        <span className={styles.searchText}>Buscar personas, salas, solicitudes…</span>
        <kbd className={styles.keycap} aria-hidden="true">Ctrl K</kbd>
      </button>

      <div className={styles.right}>
        <NewMenu onNavigate={onNavigate} />
        <span className={styles.clock} data-liquid aria-label={`Hora actual ${clockStr}`}>
          <Clock size={14} aria-hidden="true" />{clockStr}
        </span>
        <ThemeSwitch isDark={isDark} onToggle={onToggleTheme} />
        {bell}
        <ProfileMenu
          avatar={avatar}
          user={user}
          workday={workday}
          upcomingCount={upcomingCount}
          openRequests={openRequests}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
      </div>
      {children}
    </header>
  );
}

/**
 * Light/dark switch: the liquid-glass-ui skill's glass toggle (pixel moon and sun on a squircle
 * thumb, glass/glass-theme-toggle.js), mounted as is. It only shows and requests the theme: the
 * change goes through the app's own setter (ThemeProvider.setMode, with its circular reveal and its
 * saved preference), so the module gets its own host as `scope` and never writes <html> itself.
 */
function ThemeSwitch({ isDark, onToggle }) {
  const hostRef = useRef(null);
  const toggleRef = useRef(null);
  const state = useRef({ isDark, onToggle });
  state.current = { isDark, onToggle };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const toggle = createGlassThemeToggle(host, {
      scope: host,
      persist: false,
      theme: state.current.isDark ? 'dark' : 'light',
      ariaLabel: 'Tema oscuro',
    });
    toggle.title = 'Tema claro u oscuro';
    const onChange = (event) => {
      // A change the app already made (synced below) is not a request
      if ((event.detail.theme === 'dark') !== state.current.isDark) state.current.onToggle();
    };
    toggle.addEventListener('glassthemechange', onChange);
    toggleRef.current = toggle;
    return () => { toggle.removeEventListener('glassthemechange', onChange); toggle.remove(); toggleRef.current = null; };
  }, []);

  // The theme changed elsewhere (Ajustes, the system): the switch follows
  useEffect(() => { toggleRef.current?.setGlassTheme(isDark ? 'dark' : 'light'); }, [isDark]);

  return <span ref={hostRef} className={styles.themeSwitch} />;
}

const NEW_ITEMS = [
  { to: 'reservations?nueva=1', label: 'Nueva reserva', hint: 'Sala o vehículo', icon: Calendar, tone: 'accent' },
  { to: 'requests?nueva=1', label: 'Nueva solicitud', hint: 'Asuntos propios, remoto, externo o compra', icon: Inbox, tone: 'teal' },
  { to: 'horas?nueva=1', label: 'Registrar horas', hint: 'Tiempo a compensar', icon: Timer, tone: 'violet' },
];

/** «Nuevo»: the three things people create every day, one click from any page (computers). */
function NewMenu({ onNavigate }) {
  const reduce = useReducedMotion();
  const { open, setOpen, ref } = usePopover();
  const go = (to) => { setOpen(false); onNavigate(to); };
  return (
    <div className={styles.newWrap} ref={ref}>
      <button type="button" className={styles.newBtn} onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <Plus size={17} aria-hidden="true" />
        <span>Nuevo</span>
        <ChevronDown size={15} aria-hidden="true" className={clsx(styles.newChevron, open && styles.newChevronOpen)} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            data-liquid="dense"
            className={clsx(styles.menu, styles.newMenu)}
            {...popoverMotion(reduce)}
          >
            {NEW_ITEMS.map(({ to, label, hint, icon: Icon, tone }) => (
              <button key={to} type="button" className={styles.newItem} onClick={() => go(to)}>
                <span className={styles.newIcon} data-tone={tone} aria-hidden="true"><Icon size={17} /></span>
                <span className={styles.newText}><strong>{label}</strong><small>{hint}</small></span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The avatar (its ring is the workday) opens the account menu: the person's
 * figures (workday, own upcoming reservations and pending requests) and the account links. */
function ProfileMenu({ avatar, user, workday, upcomingCount, openRequests, onNavigate, onLogout }) {
  const { open, setOpen, ref } = usePopover();
  const go = (id) => { setOpen(false); onNavigate(id); };
  // Computers: the avatar only opens Mi perfil (settings and logout are in the rail).
  // Tablets keep the account menu, as they have no rail.
  const desk = useMediaQuery('(min-width: 1024px)');
  const reduce = useReducedMotion();

  return (
    <div className={styles.profile} ref={ref}>
      <button
        type="button"
        className={styles.avatarBtn}
        onClick={() => (desk ? onNavigate('profile') : setOpen((o) => !o))}
        aria-haspopup={desk ? undefined : 'true'}
        aria-expanded={desk ? undefined : open}
        aria-label={desk ? `Mi perfil: ${user?.name || 'tu cuenta'}. Jornada al ${workday}%` : `${user?.name || 'Mi cuenta'}. Jornada al ${workday}%`}
        title={desk ? 'Mi perfil' : `Jornada: ${workday}%`}
      >
        {avatar}
      </button>
      <AnimatePresence>
        {open && !desk && (
          <motion.div
            data-liquid="dense"
            className={styles.menu}
            {...popoverMotion(reduce)}
          >
            <div className={styles.menuHead}>
              <strong>{user?.name}</strong>
              <span>{[user?.position, user?.dept].filter(Boolean).join(' · ')}</span>
            </div>
            <div className={styles.menuStats}>
              <span><Clock size={14} aria-hidden="true" /><strong>{workday}%</strong> Jornada</span>
              <button type="button" onClick={() => go('reservations')}>
                <Calendar size={14} aria-hidden="true" /><strong>{upcomingCount}</strong> {upcomingCount === 1 ? 'reserva' : 'reservas'}
              </button>
              <button type="button" onClick={() => go('requests')}>
                <Inbox size={14} aria-hidden="true" /><strong>{openRequests}</strong> {openRequests === 1 ? 'pendiente' : 'pendientes'}
              </button>
            </div>
            <div className={styles.menuLinks}>
              <button type="button" onClick={() => go('profile')}><UserRound size={16} aria-hidden="true" /> Mi perfil</button>
              <button type="button" onClick={() => go('settings')}><SlidersHorizontal size={16} aria-hidden="true" /> Ajustes</button>
              <button type="button" className={styles.menuDanger} onClick={() => { setOpen(false); onLogout(); }}>
                <LogOut size={16} aria-hidden="true" /> Cerrar sesión
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Computers (1024 px and up): the sections in a floating rail of smoked glass on the left. The leaf
 * on top goes home; each section is an icon with its name in a tooltip (and for screen readers);
 * the open one is a lit disc. Pending counts ride on the icon. At the foot: Administración (admins),
 * Ajustes and Cerrar sesión. The keyboard shortcuts stay on «?» and in the search.
 */
export function GlassRail({ items, page, badges, onNavigate, onLogout }) {
  const main = items.filter((i) => i.id !== 'admin');
  const foot = [
    ...items.filter((i) => i.id === 'admin'),
    { id: 'settings', label: 'Ajustes', icon: SlidersHorizontal },
  ];
  const renderItem = (item) => {
    const Icon = item.icon;
    const active = page === item.id;
    const badge = item.badgeKey ? badges[item.badgeKey] || 0 : 0;
    return (
      <li key={item.id}>
        <button
          type="button"
          className={clsx(styles.railItem, active && styles.railItemActive)}
          onClick={() => onNavigate(item.id)}
          aria-current={active ? 'page' : undefined}
          aria-label={badge ? `${item.label}, ${badge} pendientes` : item.label}
        >
          {active && (
            <motion.span layoutId="glass-rail-disc" className={styles.railDisc} transition={SPRING.indicator} aria-hidden="true" />
          )}
          <Icon size={19} aria-hidden="true" />
          {badge > 0 && <span className={styles.railBadge} aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
          <span className={styles.railTip} aria-hidden="true">{item.label}</span>
        </button>
      </li>
    );
  };

  return (
    <nav className={styles.rail} data-liquid aria-label="Navegación principal">
      <button type="button" className={styles.railBrand} onClick={() => onNavigate('dashboard')} aria-label="Margube, ir al inicio">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={LEAF_PATH} />
          <path d={VEIN_PATH} />
        </svg>
      </button>
      <ul className={styles.railList}>{main.map(renderItem)}</ul>
      <ul className={clsx(styles.railList, styles.railFoot)}>
        {foot.map(renderItem)}
        <li>
          <button type="button" className={clsx(styles.railItem, styles.railLogout)} onClick={onLogout} aria-label="Cerrar sesión">
            <LogOut size={19} aria-hidden="true" />
            <span className={styles.railTip} aria-hidden="true">Cerrar sesión</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

// Phones: the app's tab bar — four sections and "Más" (the rest, profile and preferences)
const DOCK_IDS = ['dashboard', 'reservations', 'requests', 'horas'];

/** Position of a section in the dock: any section without a tab of its own lives under «Más», last */
export function dockPosition(page) {
  const index = DOCK_IDS.indexOf(page);
  return index >= 0 ? index : DOCK_IDS.length;
}
const DOCK_ICONS = { dashboard: Home, reservations: CalendarDays };

/** One tab of the dock: icon (with its pending count) and short name. Rendered twice: as the real
 * button, and as a still copy inside the lens (see GlassTabBar). */
function DockTabFace({ item, active, badge }) {
  const Icon = DOCK_ICONS[item.id] || item.icon;
  return (
    <>
      <span className={styles.tabIcon}>
        <Icon size={DOCK_STYLE.iconSize} strokeWidth={active ? 2.1 : 1.8} aria-hidden="true" />
        {badge > 0 && <span className={styles.tabBadge} aria-hidden="true">{badge > 99 ? '99+' : badge}</span>}
      </span>
      <span className={styles.tabLabel}>{SHORT[item.id] || item.label}</span>
    </>
  );
}

// The lens lifting off the bar, gliding to a tab (a little overshoot, like liquid) and settling
const LENS_LIFT = { duration: 0.12, ease: EASE.out };
const LENS_SETTLE = { type: 'spring', stiffness: 320, damping: 26, delay: 0.1 };
const LENS_GLIDE = { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 };
// The lens is a capsule wider than its tab (8 px each side), as on iOS
const LENS_PAD = 8;

/** Bottom dock shared by phones and tablets, with
 * the app's round "Nueva solicitud" button beside it. While the page scrolls the dock shrinks out
 * of the way; it returns to its size when it stops.
 *
 * At rest the open tab sits in a capsule of Margube-blue glass, its icon and name in light blue.
 * When a finger switches tab, or holds and drags along the bar, the capsule lifts into a clear lens:
 * it grows past the bar, follows the finger (or glides to the tapped tab) and settles on the new
 * one. The lens magnifies what is under it: it holds a still copy of the tabs, aligned with the
 * real ones, so as the lens grows its content grows with it around its centre. A copy rather than
 * a backdrop filter, so it works in every browser and costs one transform per frame. */
export function GlassTabBar({ items, page, badges, onNavigate, onReselect }) {
  const reduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const scrolling = useScrolling();
  const badgeOf = (item) => (item.badgeKey ? badges[item.badgeKey] || 0 : 0);
  const rest = items.filter((i) => !DOCK_IDS.includes(i.id));
  const tabs = [
    ...DOCK_IDS.map((id) => items.find((item) => item.id === id)).filter(Boolean),
    { id: 'mas', label: 'Más', icon: LayoutGrid, extra: rest.reduce((s, i) => s + badgeOf(i), 0) },
  ];
  const isActive = (id) => (id === 'mas' ? !DOCK_IDS.includes(page) : page === id);
  const activeIndex = Math.max(0, tabs.findIndex((t) => isActive(t.id)));
  // Only a switch made on the dock lifts the lens; arriving from a link elsewhere does not
  const fromDock = useRef(false);
  const go = (id) => {
    if (id === page) { onReselect?.(); return; }
    fromDock.current = true;
    onNavigate(id);
  };
  const scrub = useDockScrub({ count: tabs.length, onSelect: (index) => go(tabs[index].id) });
  const scrubbing = scrub.dragging;

  // Geometry of the bar: every tab is one equal cell (shared/config/dock.js)
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const bar = scrub.ref.current;
    if (!bar) return undefined;
    const ro = new ResizeObserver(() => setBarWidth(bar.offsetWidth));
    ro.observe(bar);
    return () => ro.disconnect();
  }, [scrub.ref]);
  const cell = dockCellWidth(barWidth, tabs.length);

  const lensX = useMotionValue(0);
  const lift = useMotionValue(0); // 0 at rest, 1 lifted
  const lensScale = useTransform(lift, [0, 1], [1, DOCK_STYLE.lensScale]);
  const lensOpacity = useTransform(lift, [0, 0.12], [0, 1]);
  const pillOpacity = useTransform(lift, [0, 0.25], [1, 0]);
  const copyX = useTransform(lensX, (v) => -v);

  const last = useRef({ index: activeIndex, scrubbing: false, cell: 0 });
  useEffect(() => {
    const before = last.current;
    last.current = { index: activeIndex, scrubbing, cell };
    if (!cell) return undefined;
    const target = activeIndex * (cell + DOCK_GAP);
    const controls = [];
    let disposed = false;
    let unsubscribe;
    const run = (value, to, options) => {
      const control = animate(value, to, options);
      controls.push(control);
      return control;
    };
    if (scrubbing) {
      lensX.set(scrub.x.get());
      if (!reduceMotion) run(lift, 1, LENS_LIFT);
      unsubscribe = scrub.x.on('change', (value) => lensX.set(value));
    } else {
      const tapped = before.index !== activeIndex && fromDock.current;
      fromDock.current = false;
      if (reduceMotion || before.cell !== cell) {
        lensX.set(target);
        lift.set(0);
      } else {
        run(lensX, target, tapped || before.scrubbing ? LENS_GLIDE : SPRING.indicator);
        if (tapped && !before.scrubbing) {
          run(lift, 1, LENS_LIFT).then(() => {
            if (!disposed) run(lift, 0, LENS_SETTLE);
          });
        } else run(lift, 0, { ...LENS_SETTLE, delay: before.scrubbing ? 0.08 : 0 });
      }
    }
    return () => {
      disposed = true;
      unsubscribe?.();
      controls.forEach((control) => control.stop());
    };
  }, [activeIndex, scrubbing, cell, reduceMotion, lensX, lift, scrub.x]);

  return (
    <div className={clsx(styles.dock, scrolling && styles.dockCompact)} style={dockWebVariables(theme)} data-dock-holding={scrub.holding || undefined}>
      <nav ref={scrub.ref} data-liquid="dock" className={styles.tabBar} aria-label="Navegación principal" {...scrub.handlers} data-scrubbing={scrubbing || undefined}>
        <motion.span className={clsx(styles.tabPill, styles.dockSelection)} style={{ x: lensX, width: cell, opacity: pillOpacity }} aria-hidden="true" />
        {tabs.map((item, index) => {
          const active = isActive(item.id);
          const badge = item.extra ?? badgeOf(item);
          return (
            <button
              key={item.id}
              type="button"
              data-dock-index={index}
              data-dock-preview={scrub.preview === index || undefined}
              className={clsx(styles.tab, active && styles.tabActive)}
              onClick={() => go(item.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={badge ? `${item.label}, ${badge} pendientes` : item.label}
            >
              <DockTabFace item={item} active={active} badge={badge} />
            </button>
          );
        })}
        {/* The lens: above the tabs, invisible at rest */}
        <motion.span className={styles.lens} style={{ x: lensX, width: cell ? cell + LENS_PAD * 2 : undefined, scale: lensScale, opacity: lensOpacity, '--lens-pad': `${LENS_PAD}px` }} aria-hidden="true">
          <motion.span className={styles.lensCopy} style={{ x: copyX, width: barWidth || undefined }}>
            {tabs.map((item, index) => (
              <span key={item.id} className={clsx(styles.tab, isActive(item.id) && styles.tabActive)} data-dock-preview={scrub.preview === index || undefined}>
                <DockTabFace item={item} active={isActive(item.id)} badge={item.extra ?? badgeOf(item)} />
              </span>
            ))}
          </motion.span>
        </motion.span>
      </nav>
      <button type="button" data-liquid="dock" className={styles.dockPlus} onClick={() => onNavigate('requests?nueva=1')} aria-label="Nueva solicitud" title="Nueva solicitud">
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
