import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import {
  Search, UserRound, SlidersHorizontal, Sun, Moon, LogOut, Clock, LayoutGrid, Plus, Calendar, Inbox,
  Timer, ChevronDown, Home, CalendarDays,
} from 'lucide-react';
import logoIcon from '../assets/logos/logo-icon.png';
import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';
import { LEAF_PATH, VEIN_PATH } from './ui/Loader/Loader';
import { useScrolling } from '../hooks/useScrolling';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useDockScrub } from '../hooks/useDockScrub';
import { DOCK_STYLE, DOCK_WEB_VARIABLES } from '../../shared/config/dock';
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
export function GlassHeader({
  items, page, badges, onNavigate, onSearch, clockStr, bell, avatar, section,
  user, workday, upcomingCount = 0, openRequests = 0, onLogout, isDark, onToggleTheme, children,
}) {
  const SectionIcon = section?.icon;
  return (
    <header className={styles.header} role="banner">
      <div className={styles.left}>
        {/* Computer: the logo with the name · phones and tablets: just the leaf. Both go home. */}
        <div className={styles.crumbs}>
          <button type="button" className={styles.brand} onClick={() => onNavigate('dashboard')} aria-label="Margube, ir al inicio" title="Inicio">
            <img src={isDark ? logoWhite : logoColor} alt="" className={styles.brandFull} />
            <img src={logoIcon} alt="" className={styles.brandIcon} />
          </button>
          {section?.label && (
            <span className={styles.crumb}>
              {SectionIcon && <SectionIcon size={15} aria-hidden="true" />}
              {section.label}
            </span>
          )}
        </div>
        <button type="button" className={clsx(styles.round, styles.liquid, styles.searchRound)} onClick={onSearch} aria-label="Buscar (Ctrl+K)" aria-haspopup="dialog" title="Buscar · Ctrl K">
          <Search size={17} aria-hidden="true" />
        </button>
      </div>

      {/* Tablets: the sections in a pill (computers have the rail, phones the dock) */}
      <nav className={styles.nav} aria-label="Navegación principal">
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
                  transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }}
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
      <button type="button" className={styles.searchBar} onClick={onSearch} aria-haspopup="dialog" aria-label="Buscar (Ctrl+K)">
        <Search size={17} aria-hidden="true" />
        <span className={styles.searchText}>Buscar personas, salas, solicitudes…</span>
        <kbd className={styles.keycap} aria-hidden="true">Ctrl K</kbd>
      </button>

      <div className={styles.right}>
        <NewMenu onNavigate={onNavigate} />
        <span className={styles.clock} aria-label={`Hora actual ${clockStr}`}>
          <Clock size={14} aria-hidden="true" />{clockStr}
        </span>
        <button
          type="button"
          className={clsx(styles.round, styles.themeBtn)}
          onClick={onToggleTheme}
          aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={isDark ? 'Tema claro' : 'Tema oscuro'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isDark ? 'sun' : 'moon'}
              className={styles.swap}
              initial={{ opacity: 0, rotate: -45, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 45, scale: 0.8 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            >
              {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            </motion.span>
          </AnimatePresence>
        </button>
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

const NEW_ITEMS = [
  { to: 'reservations?nueva=1', label: 'Nueva reserva', hint: 'Sala o vehículo', icon: Calendar, tone: 'accent' },
  { to: 'requests?nueva=1', label: 'Nueva solicitud', hint: 'Asuntos propios, remoto, externo o compra', icon: Inbox, tone: 'teal' },
  { to: 'horas?nueva=1', label: 'Registrar horas', hint: 'Tiempo a compensar', icon: Timer, tone: 'violet' },
];

/** «Nuevo»: the three things people create every day, one click from any page (computers). */
function NewMenu({ onNavigate }) {
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
            className={clsx(styles.menu, styles.newMenu)}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
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
            className={styles.menu}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
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
            <motion.span layoutId="glass-rail-disc" className={styles.railDisc} transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }} aria-hidden="true" />
          )}
          <Icon size={19} aria-hidden="true" />
          {badge > 0 && <span className={styles.railBadge} aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
          <span className={styles.railTip} aria-hidden="true">{item.label}</span>
        </button>
      </li>
    );
  };

  return (
    <nav className={styles.rail} aria-label="Navegación principal">
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
const DOCK_ICONS = { dashboard: Home, reservations: CalendarDays };

/** Bottom dock of the glass appearance on phones (tablets and computers use the top pill), with
 * the app's round "Nueva solicitud" button beside it. The open tab is blue, named and underlined.
 * While the page scrolls the dock shrinks out of the way; it returns to its size when it stops. */
export function GlassTabBar({ items, page, badges, onNavigate }) {
  const reduceMotion = useReducedMotion();
  const scrolling = useScrolling();
  const badgeOf = (item) => (item.badgeKey ? badges[item.badgeKey] || 0 : 0);
  const rest = items.filter((i) => !DOCK_IDS.includes(i.id));
  const tabs = [
    ...items.filter((i) => DOCK_IDS.includes(i.id)),
    { id: 'mas', label: 'Más', icon: LayoutGrid, extra: rest.reduce((s, i) => s + badgeOf(i), 0) },
  ];
  const isActive = (id) => (id === 'mas' ? !DOCK_IDS.includes(page) : page === id);
  const scrub = useDockScrub({ count: tabs.length, onSelect: (index) => onNavigate(tabs[index].id) });

  return (
    <div className={clsx(styles.dock, scrolling && styles.dockCompact)} style={DOCK_WEB_VARIABLES} data-dock-holding={scrub.holding || undefined}>
      <nav ref={scrub.ref} className={styles.tabBar} aria-label="Navegación principal" {...scrub.handlers} data-scrubbing={scrub.preview >= 0 || undefined}>
        {scrub.preview >= 0 && <motion.span className={styles.scrubPill} style={{ x: scrub.x, width: scrub.cellWidth }} initial={false} animate={{ scale: reduceMotion ? 1 : DOCK_STYLE.selectionScale }} transition={{ duration: DOCK_STYLE.pressDuration / 1000 }} aria-hidden="true" />}
        {tabs.map((item, index) => {
          const Icon = DOCK_ICONS[item.id] || item.icon;
          const active = isActive(item.id);
          const badge = item.extra ?? badgeOf(item);
          return (
            <button
              key={item.id}
              type="button"
              data-dock-index={index}
              data-dock-preview={scrub.preview === index || undefined}
              className={clsx(styles.tab, active && styles.tabActive)}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={badge ? `${item.label}, ${badge} pendientes` : item.label}
            >
              {active && scrub.preview < 0 && (
                <motion.span layoutId="glass-tab-pill" className={styles.tabPill} transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }} aria-hidden="true" />
              )}
              <span className={styles.tabIcon}>
                <Icon size={DOCK_STYLE.iconSize} strokeWidth={active ? 2.1 : 1.8} aria-hidden="true" />
                {badge > 0 && <span className={styles.tabBadge} aria-hidden="true">{badge > 99 ? '99+' : badge}</span>}
              </span>
              <span className={styles.tabLabel}>{SHORT[item.id] || item.label}</span>
            </button>
          );
        })}
      </nav>
      <button type="button" className={styles.dockPlus} onClick={() => onNavigate('requests?nueva=1')} aria-label="Nueva solicitud" title="Nueva solicitud">
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
