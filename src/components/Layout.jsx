import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useAuth, useTheme, useNotifs, useDocuments, useRequests, useReservations, useHours, usePersonalDays, useDataSync } from '../context';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { springConfig } from '../hooks/useSpringAnimation';
import {
  LayoutDashboard, Calendar, Inbox, Newspaper, Settings,
  LogOut, Menu, Bell, UsersRound, Timer, SlidersHorizontal, Clock,
  ChevronLeft, ChevronRight, Search, Sun, Moon, AlertTriangle,
} from 'lucide-react';

import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';
import logoIcon from '../assets/logos/logo-icon.png';

import { Avatar, Button, TopProgress, PageLoader, AnimatedBackdrop } from './ui';
import { Wallpaper } from './Wallpaper';
import { GlassHeader, GlassTabBar } from './GlassChrome';
import OnboardingModal from './OnboardingModal';
import { NotificationsDropdown } from './NotificationsDropdown';
import { PolicyModal } from './PolicyModal';
import { LiveToastContainer } from './LiveToastContainer';
import CommandPalette from './CommandPalette';
import { ShortcutsSheet } from './ShortcutsSheet';
import { ConnectionStatus } from './ConnectionStatus';
import { todayKey } from '../utils/format';
import { workdayProgress } from '../utils/workday';
import styles from './Layout.module.scss';

const navItems = [
  { id: 'dashboard',    label: 'Inicio',             icon: LayoutDashboard },
  { id: 'reservations', label: 'Reservas',           icon: Calendar,    badgeKey: 'reservations' },
  { id: 'requests',     label: 'Solicitudes',        icon: Inbox,       badgeKey: 'requests' },
  { id: 'horas',        label: 'Tiempo a compensar', icon: Timer },
  { id: 'news',         label: 'Noticias y Eventos', icon: Newspaper },
  { id: 'employees',    label: 'Equipo',             icon: UsersRound },
];
const adminItems = [
  { id: 'admin', label: 'Administración', icon: Settings, badgeKey: 'admin' },
];
const settingsItem = { id: 'settings', label: 'Ajustes', icon: SlidersHorizontal };

/* Heading shown at the top of the content panel. The dashboard draws its own.
   `width`: pages laid out as a centred column; the heading lines up with it.
   `phone`: on phones (glass) the page draws the app's own header, title and actions on one line. */
const PAGE_META = {
  reservations: { title: 'Reservas',           desc: 'Salas y vehículos de empresa: mira qué está libre y reserva en segundos.', phone: true },
  requests:     { title: 'Solicitudes',        desc: 'Asuntos propios, trabajo en remoto o externo y compras.', phone: true },
  horas:        { title: 'Tiempo a compensar', desc: 'Registra tus horas y consulta tu saldo con la empresa.', phone: true },
  mas:          { title: 'Más',                desc: 'Tu cuenta, el resto de secciones y tus preferencias.', phone: true },
  news:         { title: 'Noticias y Eventos', desc: 'Comunicados, novedades y próximos eventos de Margube.' },
  employees:    { title: 'Equipo',             desc: 'Directorio del equipo y dónde trabaja cada persona, hoy y durante la semana.' },
  profile:      { title: 'Mi perfil',          desc: 'Tus datos, modo de trabajo, contraseña y documentos.', width: 1180 },
  settings:     { title: 'Ajustes',            desc: 'Tema, notificaciones y preferencias de tu cuenta.', width: 680 },
  admin:        { title: 'Administración',     desc: 'Empleados, salas, vehículos, documentos y bolsa de horas.' },
};

function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/* Profile ring: the workday traced around the avatar, on the same leaf outline
   as the avatars (--shape-leaf: 60% 12% 60% 12%). */
function leafOutline(size, inset) {
  const x = inset, y = inset, w = size - inset * 2, h = w;
  const big = w * 0.6, small = w * 0.12;
  return [
    `M ${x + big} ${y}`,
    `H ${x + w - small}`, `A ${small} ${small} 0 0 1 ${x + w} ${y + small}`,
    `V ${y + h - big}`,   `A ${big} ${big} 0 0 1 ${x + w - big} ${y + h}`,
    `H ${x + small}`,     `A ${small} ${small} 0 0 1 ${x} ${y + h - small}`,
    `V ${y + big}`,       `A ${big} ${big} 0 0 1 ${x + big} ${y}`,
    'Z',
  ].join(' ');
}

function ProfileRing({ progress, size, children }) {
  const stroke = 3;
  const d = leafOutline(size, stroke / 2 + 0.5);
  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent-light)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <path className={styles.ringTrack} d={d} strokeWidth={stroke} />
        <motion.path
          className={styles.ringValue}
          d={d}
          pathLength={1}
          strokeWidth={stroke}
          stroke="url(#ringGrad)"
          strokeDasharray="1 1"
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: 1 - progress / 100 }}
          transition={{ duration: 1.1, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
        />
      </svg>
      <div className={styles.ringInner}>{children}</div>
    </div>
  );
}

function NavLink({ item, onNavigate, collapsed, badge, active, pillId }) {
  const Icon = item.icon;
  const [showTip, setShowTip] = useState(false);

  return (
    <div className={styles.navLinkWrapper}>
      {/* Active pill — shared element that glides between items */}
      {active && (
        <motion.span
          layoutId={pillId}
          className={styles.navPill}
          transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }}
          aria-hidden="true"
        />
      )}
      <motion.button
        onClick={() => onNavigate(item.id)}
        className={clsx(styles.navLink, { [styles.navLinkActive]: active })}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        aria-describedby={collapsed && showTip ? `tooltip-${item.id}` : undefined}
        onMouseEnter={() => collapsed && setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => collapsed && setShowTip(true)}
        onBlur={() => setShowTip(false)}
        whileTap={{ scale: 0.97 }}
        transition={springConfig.responsive}
      >
        <span className={styles.navIcon}><Icon size={18} aria-hidden="true" /></span>
        <span className={styles.navLabel}>{item.label}</span>
        {badge > 0 && !collapsed && (
          <motion.span
            className={styles.navBadge}
            aria-label={`${badge} pendientes`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 26, mass: 0.8, stiffness: 300 }}
          >
            {badge > 9 ? '9+' : badge}
          </motion.span>
        )}
        {badge > 0 && collapsed && (
          <span className={styles.navBadgeDot} aria-label={`${badge} pendientes`} />
        )}
      </motion.button>

      {/* Floating tooltip when collapsed */}
      <AnimatePresence>
        {collapsed && showTip && (
          <motion.div
            className={styles.navTooltip}
            initial={{ opacity: 0, x: -6, y: '-50%', scale: 0.96 }}
            animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
            exit={{ opacity: 0, x: -4, y: '-50%', scale: 0.97, transition: { duration: 0.1 } }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            role="tooltip"
            id={`tooltip-${item.id}`}
          >
            {item.label}
            {badge > 0 && <span className={styles.navTooltipBadge}>{badge}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout, needsOnboarding, setLastActivity, patchUser, refreshEmployees } = useAuth();
  const { theme, setMode, appearance } = useTheme();
  // 'glass': wallpaper and top section pill · 'classic': sidebar (Ajustes → Apariencia)
  const glass = appearance === 'glass';
  const navigate = useNavigate();
  const location = useLocation();
  const page = location.pathname.replace('/', '') || 'dashboard';
  const { liveNotifs = [], notifications = [], markNotifRead, markAllNotifsRead } = useNotifs();
  const { onboardingDocUrl } = useDocuments();
  const { requests = [] } = useRequests();
  const { reservations = [] } = useReservations();
  const { hourCompensations = [] } = useHours();
  const { personalDays = [] } = usePersonalDays() || {};
  const { loadingData = false, loadFailed = false, refresh } = useDataSync() || {};
  const [retrying, setRetrying] = useState(false);
  const retryLoad = async () => { setRetrying(true); try { await refresh?.(); } finally { setRetrying(false); } };

  const now = useClock();
  const clockStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const today = todayKey(now);
  const isDark = theme === 'dark';

  // Nav badges: like reservations, an employee only counts their own requests and personal days
  const pendingRequestsCount = [...requests, ...personalDays]
    .filter(r => r.status === 'pending' && (user?.role === 'admin' || r.employeeId === user?.id)).length;
  const pendingReservationsCount = user?.role === 'admin'
    ? reservations.filter(r => r.status === 'pending').length
    : reservations.filter(r => r.status === 'pending' && r.employeeId === user?.id).length;
  const pendingAdminCount = hourCompensations.filter(h => h.status === 'pending').length;

  const navBadges = {
    requests: pendingRequestsCount,
    reservations: pendingReservationsCount,
    admin: pendingAdminCount
  };

  /* The signed-in person's own numbers (profile block) */
  const myUpcoming = useMemo(() =>
    reservations
      .filter(r => r.employeeId === user?.id && r.date >= today && r.status !== 'rejected' && r.status !== 'cancelled')
      .sort((a, b) => (a.date + (a.timeStart || '')).localeCompare(b.date + (b.timeStart || ''))),
  [reservations, user?.id, today]);

  const myOpenRequests = useMemo(() =>
    requests.filter(r => r.employeeId === user?.id && r.status === 'pending').length
    + personalDays.filter(p => p.employeeId === user?.id && p.status === 'pending').length,
  [requests, personalDays, user?.id]);

  const [sideOpen, setSideOpen] = useState(false);
  const [notiMenu, setNotiMenu] = useState(false);

  const [policyRead, setPolicyRead] = useState(false);
  const [policyTimer, setPolicyTimer] = useState(5);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('margube_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('margube_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // An admin can mark the rules as pending again: start the reading over
  useEffect(() => {
    if (user && user.policyAccepted !== true) {
      setPolicyRead(false);
      setPolicyTimer(5);
    }
  }, [user?.id, user?.policyAccepted]);

  useEffect(() => {
    if (user && user.policyAccepted !== true && policyTimer > 0) {
      const t = setTimeout(() => setPolicyTimer(p => p - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [user, policyTimer]);

  const notiMenuRef = useRef(null);

  const resetIdle = useCallback(() => setLastActivity(Date.now()), [setLastActivity]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetIdle, { passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, resetIdle));
  }, [resetIdle]);

  useEffect(() => {
    function handler(e) {
      if (notiMenuRef.current && !notiMenuRef.current.contains(e.target))
        setNotiMenu(false);
    }
    document.addEventListener('mousedown', handler, { passive: true });
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNavigate = useCallback((id) => {
    navigate('/' + id);
    setSideOpen(false);
  }, [navigate]);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const closeCmd = useCallback(() => setCmdOpen(false), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useEffect(() => {
    const G_MAP = { d: 'dashboard', r: 'reservations', s: 'requests', h: 'horas', n: 'news', e: 'employees', p: 'profile', a: 'settings', m: 'admin' };
    const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    let gPending = false;
    let gTimer;

    const onKey = (e) => {
      // Ctrl/⌘ K works everywhere, even while typing
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      // Letter shortcuts stay quiet while any dialog is open
      if (document.querySelector('[aria-modal="true"]')) return;

      if (gPending) {
        gPending = false;
        clearTimeout(gTimer);
        const id = G_MAP[e.key.toLowerCase()];
        if (id && (id !== 'admin' || user?.role === 'admin')) {
          e.preventDefault();
          handleNavigate(id);
        }
        return;
      }
      if (e.key === '/') { e.preventDefault(); setCmdOpen(true); return; }
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(true); return; }
      if (e.key.toLowerCase() === 'g') {
        gPending = true;
        gTimer = setTimeout(() => { gPending = false; }, 1200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(gTimer); };
  }, [handleNavigate, user?.role]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const handleMarkAllRead = () => markAllNotifsRead?.(user?.id);
  const meta = PAGE_META[page];
  const docTitle = meta?.title || (page === 'dashboard' ? 'Inicio' : null);

  useEffect(() => {
    document.title = docTitle ? `${docTitle} · Margube` : 'Margube';
  }, [docTitle]);

  // Each page opens at the top (the panel scrolls on desktop, the window on phones)
  const panelRef = useRef(null);
  useEffect(() => {
    panelRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [page]);

  // Notifications bell + dropdown, shared by the classic and the glass top bars
  const bellNode = (
            <div className={styles.bellWrap} ref={notiMenuRef}>
              <button
                type="button"
                className={clsx(styles.iconBtn, { [styles.iconBtnActive]: notiMenu })}
                onClick={() => setNotiMenu(v => !v)}
                aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
                aria-expanded={notiMenu}
              >
                <Bell size={18} aria-hidden="true" />
              </button>
              {unreadCount > 0 && (
                <motion.span
                  key={unreadCount}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                  className={styles.badge}
                  aria-hidden="true"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}

              <NotificationsDropdown
                notiMenu={notiMenu}
                setNotiMenu={setNotiMenu}
                unreadCount={unreadCount}
                notifications={notifications}
                handleMarkAllRead={handleMarkAllRead}
                markNotifRead={markNotifRead}
                navigate={navigate}
                user={user}
              />
            </div>
  );

  // Shared by the desktop sidebar and the mobile drawer
  const getSidebarContent = (isMobile = false) => {
    const isCollapsed = !isMobile && collapsed;
    const pillId = isMobile ? 'nav-pill-drawer' : 'nav-pill-rail';
    const progress = workdayProgress(now);
    return (
      <div className={styles.sidebarInner}>
        <div className={clsx(styles.logoArea, { [styles.logoAreaCollapsed]: isCollapsed })}>
          <img
            src={isCollapsed ? logoIcon : (isDark ? logoWhite : logoColor)}
            alt="Margube"
            className={isCollapsed ? styles.logoIcon : styles.logo}
          />
        </div>

        {/* Profile — the ring is today's workday */}
        <div className={clsx(styles.profile, { [styles.profileCollapsed]: isCollapsed })}>
          <button
            type="button"
            className={styles.profileMain}
            onClick={() => handleNavigate('profile')}
            aria-label={`${user?.name || 'Mi perfil'}. Ir a mi perfil`}
            title={`Jornada: ${Math.round(progress)}%`}
          >
            <ProfileRing progress={progress} size={isCollapsed ? 48 : 76}>
              <Avatar initials={user?.avatar || '??'} src={user?.avatarUrl} size={isCollapsed ? 38 : 62} />
            </ProfileRing>
            {!isCollapsed && (
              <span className={styles.profileText}>
                <span className={styles.profileName}>{user?.name}</span>
                <span className={styles.profileRole}>{[user?.position, user?.dept].filter(Boolean).join(' · ')}</span>
              </span>
            )}
          </button>

          {!isCollapsed && (
            <div className={styles.profileStats}>
              <button type="button" className={styles.profileStat} onClick={() => handleNavigate('reservations')}>
                <Calendar size={15} aria-hidden="true" />
                <strong>{myUpcoming.length}</strong>
                <span>{myUpcoming.length === 1 ? 'reserva' : 'reservas'}</span>
              </button>
              <button type="button" className={styles.profileStat} onClick={() => handleNavigate('requests')}>
                <Inbox size={15} aria-hidden="true" />
                <strong>{myOpenRequests}</strong>
                <span>{myOpenRequests === 1 ? 'pendiente' : 'pendientes'}</span>
              </button>
            </div>
          )}
        </div>

        <nav className={styles.navGroup} aria-label="Navegación principal">
          {navItems.map(i => (
            <NavLink
              key={i.id}
              item={i}
              pillId={pillId}
              onNavigate={handleNavigate}
              collapsed={isCollapsed}
              badge={i.badgeKey ? navBadges[i.badgeKey] || 0 : 0}
              active={page === i.id}
            />
          ))}

          {user?.role === 'admin' && (
            <>
              {!isCollapsed && <p className={styles.navSectionLabel}>Admin</p>}
              {isCollapsed && <div className={styles.navDivider} />}
              {adminItems.map(i => (
                <NavLink
                  key={i.id}
                  item={i}
                  pillId={pillId}
                  onNavigate={handleNavigate}
                  collapsed={isCollapsed}
                  badge={i.badgeKey ? navBadges[i.badgeKey] || 0 : 0}
                  active={page === i.id}
                />
              ))}
            </>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <NavLink
            item={settingsItem}
            pillId={pillId}
            onNavigate={handleNavigate}
            collapsed={isCollapsed}
            badge={0}
            active={page === settingsItem.id}
          />
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={() => logout()}
            aria-label="Cerrar sesión"
            title={isCollapsed ? 'Cerrar sesión' : undefined}
          >
            <span className={styles.navIcon}><LogOut size={18} aria-hidden="true" /></span>
            {!isCollapsed && <span className={styles.navLabel}>Cerrar sesión</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={clsx(styles.layout, 'app-shell', { [styles.layoutCollapsed]: collapsed && !glass, [styles.layoutGlass]: glass })}>
      {/* Glass: the wallpaper the panels frost over · classic: same backdrop as the login */}
      {glass ? <Wallpaper /> : <AnimatedBackdrop />}


      {!glass && (
      <aside className={clsx(styles.sidebar, 'hide-tablet')} aria-label="Barra lateral">
        {getSidebarContent(false)}
        <button
          onClick={toggleCollapse}
          className={styles.collapseBtn}
          aria-label={collapsed ? 'Ampliar menú' : 'Colapsar menú'}
          title={collapsed ? 'Ampliar menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>
      )}

      {/* Mobile drawer */}
      <AnimatePresence>
        {sideOpen && (
          <div className={styles.mobileOverlay} role="dialog" aria-modal="true" aria-label="Menú de navegación">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={styles.mobileBackdrop}
              data-scrim
              onClick={() => setSideOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              className={styles.drawer}
            >
              {getSidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className={styles.main}>

        {glass ? (
          <GlassHeader
            items={user?.role === 'admin' ? [...navItems, ...adminItems] : navItems}
            page={page}
            badges={navBadges}
            onNavigate={handleNavigate}
            onSearch={() => setCmdOpen(true)}
            clockStr={clockStr}
            bell={bellNode}
            avatar={(
              <ProfileRing progress={workdayProgress(now)} size={46}>
                <Avatar initials={user?.avatar || '??'} src={user?.avatarUrl} size={38} />
              </ProfileRing>
            )}
            user={user}
            workday={Math.round(workdayProgress(now))}
            upcomingCount={myUpcoming.length}
            openRequests={myOpenRequests}
            onLogout={() => logout()}
            isDark={isDark}
            onToggleTheme={() => setMode(isDark ? 'light' : 'dark')}
          >
            <TopProgress active={loadingData} />
          </GlassHeader>
        ) : (
        /* Top bar */
        <header className={styles.header} role="banner">
          <div className={styles.headerLeft}>
            <Button
              variant="ghost"
              iconOnly
              icon={Menu}
              className={clsx('show-tablet', styles.menuBtn)}
              onClick={() => setSideOpen(true)}
              aria-label="Abrir menú"
            />
            <img src={logoIcon} alt="" className={clsx(styles.headerMark, 'show-tablet')} aria-hidden="true" />
          </div>

          <button
            type="button"
            className={styles.searchTrigger}
            onClick={() => setCmdOpen(true)}
            aria-label="Buscar (Ctrl+K)"
            aria-haspopup="dialog"
          >
            <Search size={17} aria-hidden="true" />
            <span className={styles.searchTriggerLabel}>Busca personas, reservas, solicitudes…</span>
            <kbd className={styles.cmdKbd}>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
          </button>

          <div className={styles.headerRight}>
            <div className={styles.liveClock} aria-label={`Hora actual ${clockStr}`}>
              <Clock size={14} aria-hidden="true" />
              <span>{clockStr}</span>
            </div>

            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setMode(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              title={isDark ? 'Tema claro' : 'Tema oscuro'}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isDark ? 'sun' : 'moon'}
                  className={styles.iconSwap}
                  initial={{ opacity: 0, rotate: -45, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 45, scale: 0.8 }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </motion.span>
              </AnimatePresence>
            </button>

            {bellNode}
          </div>

          {/* Data sync hairline along the bottom edge of the bar */}
          <TopProgress active={loadingData} />
        </header>
        )}

        <main ref={panelRef} className={styles.panel} id="main-content" role="main" aria-busy={loadingData}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={page}
              className={clsx(styles.panelInner, 'page-stagger')}
              initial={{ opacity: 0 }}
              // A lingering transform would trap position:fixed modals inside this wrapper
              animate={{ opacity: 1, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] }, transitionEnd: { transform: 'none' } }}
              exit={{ opacity: 0, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
            >
              {meta && (
                <div className={clsx(styles.pageIntro, meta.phone && styles.pageIntroPhoneOwn)} style={meta.width ? { maxWidth: meta.width, marginInline: 'auto' } : undefined}>
                  <h1 className={styles.pageTitle}>{meta.title}</h1>
                  <p className={styles.pageDesc}>{meta.desc}</p>
                </div>
              )}
              {/* First data sync shows the page skeleton instead of empty states */}
              {loadFailed && !loadingData && (
                <div className={styles.loadError} role="alert">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>Algunos datos no se han podido cargar. Lo que ves puede estar incompleto.</span>
                  <button type="button" onClick={retryLoad} disabled={retrying}>
                    {retrying ? 'Reintentando…' : 'Reintentar'}
                  </button>
                </div>
              )}
              {loadingData ? <PageLoader /> : (
                <Suspense fallback={<PageLoader />}>
                  {children}
                </Suspense>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Glass on phones: sections in a dock at the bottom (tablets have them in the top bar, classic keeps the drawer) */}
      {glass && (
        <GlassTabBar
          items={user?.role === 'admin' ? [...navItems, ...adminItems] : navItems}
          page={page}
          badges={navBadges}
          onNavigate={handleNavigate}
        />
      )}

      <LiveToastContainer liveNotifs={liveNotifs} />

      <CommandPalette open={cmdOpen} onClose={closeCmd} onShowShortcuts={openShortcuts} />
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} isAdmin={user?.role === 'admin'} />
      <ConnectionStatus />

      <AnimatePresence>
        {needsOnboarding && <OnboardingModal />}
      </AnimatePresence>

      {/* Blocks the app until the internal rules are read and signed */}
      <PolicyModal
        user={user}
        policyAccepted={user?.policyAccepted}
        policyTimer={policyTimer}
        policyRead={policyRead}
        setPolicyRead={setPolicyRead}
        onboardingDocUrl={onboardingDocUrl}
        onSigned={() => { patchUser({ policyAccepted: true }); refreshEmployees(); }}
      />
    </div>
  );
}
