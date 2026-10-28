import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  Search, UserRound, SlidersHorizontal, Sun, Moon, LogOut, Clock, LayoutGrid,
} from 'lucide-react';
import logoIcon from '../assets/logos/logo-icon.png';
import styles from './GlassChrome.module.scss';

// Short labels for the top pill; the full name stays in the tooltip and for screen readers
const SHORT = {
  dashboard: 'Inicio', reservations: 'Reservas', requests: 'Solicitudes', horas: 'Horas',
  news: 'Noticias', employees: 'Equipo', admin: 'Admin',
};

/** Top bar of the glass appearance: logo + search, section pill, clock + theme + bell + profile menu. */
export function GlassHeader({
  items, page, badges, onNavigate, onSearch, clockStr, bell, avatar,
  user, workday, onLogout, isDark, onToggleTheme, children,
}) {
  return (
    <header className={styles.header} role="banner">
      <div className={styles.left}>
        <span className={styles.brand}>
          <img src={logoIcon} alt="Margube" />
        </span>
        <button type="button" className={styles.round} onClick={onSearch} aria-label="Buscar (Ctrl+K)" aria-haspopup="dialog" title="Buscar · Ctrl K">
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
          className={styles.round}
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
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
      </div>
      {children}
    </header>
  );
}

/** The avatar (its ring is the workday) opens the account menu. Workday, reservations and pending
 * requests are not repeated here: the ring, the dashboard and the section badges already show them. */
function ProfileMenu({ avatar, user, workday, onNavigate, onLogout }) {
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

// Phones: four sections in the dock and the rest under "Más". Tablets have room for all of them.
const DOCK_IDS = ['dashboard', 'reservations', 'requests', 'news'];

/** Bottom dock of the glass appearance on phones and tablets (the top pill is hidden there). */
export function GlassTabBar({ items, page, badges, onNavigate }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const ref = useRef(null);
  const more = items.filter((i) => !DOCK_IDS.includes(i.id));
  const badgeOf = (item) => (item.badgeKey ? badges[item.badgeKey] || 0 : 0);
  const moreBadge = more.reduce((s, i) => s + badgeOf(i), 0);
  const moreActive = more.some((i) => i.id === page);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setMoreOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [moreOpen]);

  const go = (id) => { setMoreOpen(false); onNavigate(id); };

  const tab = (item) => {
    const Icon = item.icon;
    const active = page === item.id;
    const badge = badgeOf(item);
    return (
      <button
        key={item.id}
        type="button"
        className={clsx(styles.tab, active && styles.tabActive, !DOCK_IDS.includes(item.id) && styles.tabExtra)}
        onClick={() => go(item.id)}
        aria-current={active ? 'page' : undefined}
        aria-label={badge ? `${item.label}, ${badge} pendientes` : item.label}
      >
        {active && (
          <motion.span layoutId="glass-tab-pill" className={styles.tabPill} transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }} aria-hidden="true" />
        )}
        <span className={styles.tabIcon}>
          <Icon size={20} aria-hidden="true" />
          {badge > 0 && <span className={styles.tabBadge} aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
        </span>
        <span className={styles.tabLabel}>{SHORT[item.id] || item.label}</span>
      </button>
    );
  };

  return (
    <nav className={styles.tabBar} aria-label="Navegación principal" ref={ref}>
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className={styles.moreSheet}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            {more.map((item) => {
              const Icon = item.icon;
              const badge = badgeOf(item);
              return (
                <button key={item.id} type="button" className={clsx(styles.moreItem, page === item.id && styles.moreItemActive)}
                  onClick={() => go(item.id)} aria-current={page === item.id ? 'page' : undefined}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                  {badge > 0 && <span className={styles.moreBadge}>{badge > 9 ? '9+' : badge}</span>}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {items.map(tab)}
      {more.length > 0 && (
        <button
          type="button"
          className={clsx(styles.tab, styles.tabMore, (moreActive || moreOpen) && styles.tabActive)}
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-label={moreBadge ? `Más secciones, ${moreBadge} pendientes` : 'Más secciones'}
        >
          {moreActive && !moreOpen && (
            <motion.span layoutId="glass-tab-pill-more" className={styles.tabPill} transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }} aria-hidden="true" />
          )}
          <span className={styles.tabIcon}>
            <LayoutGrid size={20} aria-hidden="true" />
            {moreBadge > 0 && <span className={styles.tabBadge} aria-hidden="true">{moreBadge > 9 ? '9+' : moreBadge}</span>}
          </span>
          <span className={styles.tabLabel}>Más</span>
        </button>
      )}
    </nav>
  );
}
