import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  Search, UserRound, SlidersHorizontal, Sun, Moon, LogOut, Clock, LayoutGrid, Plus, Calendar, Inbox,
} from 'lucide-react';
import logoIcon from '../assets/logos/logo-icon.png';
import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';
import { useScrolling } from '../hooks/useScrolling';
import styles from './GlassChrome.module.scss';

// Short labels for the top pill; the full name stays in the tooltip and for screen readers
const SHORT = {
  mas: 'Más', dashboard: 'Inicio', reservations: 'Reservas', requests: 'Solicitudes', horas: 'Horas',
  news: 'Noticias', employees: 'Equipo', admin: 'Admin',
};

/** Top bar of the glass appearance: logo + search, section pill, clock + theme + bell + profile menu. */
export function GlassHeader({
  items, page, badges, onNavigate, onSearch, clockStr, bell, avatar,
  user, workday, upcomingCount = 0, openRequests = 0, onLogout, isDark, onToggleTheme, children,
}) {
  return (
    <header className={styles.header} role="banner">
      <div className={styles.left}>
        {/* Computer: the logo with the name · phones and tablets: just the leaf. Both go home. */}
        <button type="button" className={styles.brand} onClick={() => onNavigate('dashboard')} aria-label="Margube, ir al inicio" title="Inicio">
          <img src={isDark ? logoWhite : logoColor} alt="" className={styles.brandFull} />
          <img src={logoIcon} alt="" className={styles.brandIcon} />
        </button>
        <button type="button" className={clsx(styles.round, styles.liquid)} onClick={onSearch} aria-label="Buscar (Ctrl+K)" aria-haspopup="dialog" title="Buscar · Ctrl K">
          <Search size={17} aria-hidden="true" />
        </button>
      </div>

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

      <div className={styles.right}>
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

/** The avatar (its ring is the workday) opens the account menu: the person's
 * figures (workday, own upcoming reservations and pending requests) and the account links. */
function ProfileMenu({ avatar, user, workday, upcomingCount, openRequests, onNavigate, onLogout }) {
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

  const go = (id) => { setOpen(false); onNavigate(id); };

  return (
    <div className={styles.profile} ref={ref}>
      <button
        type="button"
        className={styles.avatarBtn}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${user?.name || 'Mi cuenta'}. Jornada al ${workday}%`}
        title={`Jornada: ${workday}%`}
      >
        {avatar}
      </button>
      <AnimatePresence>
        {open && (
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

// Phones: the app's tab bar — four sections and "Más" (the rest, profile and preferences)
const DOCK_IDS = ['dashboard', 'reservations', 'requests', 'horas'];

/** Bottom dock of the glass appearance on phones (tablets and computers use the top pill), with
 * the app's round "Nueva solicitud" button beside it. The open tab is blue, named and underlined.
 * While the page scrolls the dock shrinks out of the way; it returns to its size when it stops. */
export function GlassTabBar({ items, page, badges, onNavigate }) {
  const scrolling = useScrolling();
  const badgeOf = (item) => (item.badgeKey ? badges[item.badgeKey] || 0 : 0);
  const rest = items.filter((i) => !DOCK_IDS.includes(i.id));
  const tabs = [
    ...items.filter((i) => DOCK_IDS.includes(i.id)),
    { id: 'mas', label: 'Más', icon: LayoutGrid, extra: rest.reduce((s, i) => s + badgeOf(i), 0) },
  ];
  const isActive = (id) => (id === 'mas' ? !DOCK_IDS.includes(page) : page === id);

  return (
    <div className={clsx(styles.dock, scrolling && styles.dockCompact)}>
      <nav className={styles.tabBar} aria-label="Navegación principal">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.id);
          const badge = item.extra ?? badgeOf(item);
          return (
            <button
              key={item.id}
              type="button"
              className={clsx(styles.tab, active && styles.tabActive)}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={badge ? `${item.label}, ${badge} pendientes` : item.label}
            >
              {active && (
                <motion.span layoutId="glass-tab-pill" className={styles.tabPill} transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }} aria-hidden="true" />
              )}
              <Icon size={19} aria-hidden="true" />
              {active && <span className={styles.tabLabel}>{SHORT[item.id] || item.label}</span>}
              {badge > 0 && <span className={styles.tabBadge} aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
            </button>
          );
        })}
      </nav>
      <button type="button" className={styles.dockPlus} onClick={() => onNavigate('requests?nueva=1')} aria-label="Nueva solicitud" title="Nueva solicitud">
        <Plus size={22} aria-hidden="true" />
      </button>
    </div>
  );
}
