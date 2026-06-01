import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme, useAuth, useNotifs, useDocuments, useRequests, useReservations, useHours } from '../context';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  LayoutDashboard, Calendar, Inbox, Newspaper, Settings, User,
  LogOut, Menu, Bell, CheckCircle, XCircle,
  UsersRound, Timer, Check, SlidersHorizontal, Clock, ChevronLeft, ChevronRight
} from 'lucide-react';

import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';

import { Avatar, Button } from './ui';
import OnboardingModal from './OnboardingModal';
import { NotificationsDropdown } from './NotificationsDropdown';
import { PolicyModal } from './PolicyModal';
import { LiveToastContainer } from './LiveToastContainer';
import styles from './Layout.module.scss';

/* ── Navigation items ─────────────────────────────────────────────── */
const navItems = [
  { id: 'dashboard',    label: 'Dashboard',         icon: LayoutDashboard },
  { id: 'reservations', label: 'Reservas',           icon: Calendar,    badgeKey: 'reservations' },
  { id: 'requests',     label: 'Solicitudes',        icon: Inbox,       badgeKey: 'requests' },
  { id: 'horas',        label: 'Control de Tiempo',  icon: Timer },
  { id: 'news',         label: 'Noticias y Eventos', icon: Newspaper },
  { id: 'employees',    label: 'Equipo',             icon: UsersRound },
];
const adminItems = [
  { id: 'admin', label: 'Administración', icon: Settings, badgeKey: 'admin' },
];
const settingsItem = { id: 'settings', label: 'Ajustes', icon: SlidersHorizontal };
const allItems = [...navItems, ...adminItems, settingsItem];

/* ── Live clock hook ───────────────────────────────────────────────────── */
function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/* ═ Single Nav Link ═════════════════════════════════════════════════════ */
function NavLink({ item, onNavigate, collapsed, badge, active }) {
  const Icon = item.icon;
  const [showTip, setShowTip] = useState(false);

  return (
    <div className={styles.navLinkWrapper}>
      <button
        onClick={() => onNavigate(item.id)}
        className={clsx(styles.navLink, { [styles.navLinkActive]: active })}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        aria-describedby={collapsed && showTip ? `tooltip-${item.id}` : undefined}
        onMouseEnter={() => collapsed && setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => collapsed && setShowTip(true)}
        onBlur={() => setShowTip(false)}
      >
        <Icon size={17} aria-hidden="true" />
        <span className={styles.navLabel}>{item.label}</span>
        {badge > 0 && !collapsed && (
          <span className={styles.navBadge} aria-label={`${badge} pendientes`}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        {badge > 0 && collapsed && (
          <span className={styles.navBadgeDot} aria-label={`${badge} pendientes`} />
        )}
      </button>

      {/* Floating tooltip when collapsed */}
      <AnimatePresence>
        {collapsed && showTip && (
          <motion.div
            className={styles.navTooltip}
            initial={{ opacity: 0, x: -6, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.96 }}
            transition={{ duration: 0.14 }}
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

/* ════════════════════════════════════════════════════════════════════
   LAYOUT COMPONENT
════════════════════════════════════════════════════════════════════ */
export default function Layout({ children }) {
  const { user, logout, needsOnboarding, setLastActivity, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const page = location.pathname.replace('/', '') || 'dashboard';
  const { theme } = useTheme();
  const { liveNotifs = [], notifications = [], markNotifRead, markAllNotifsRead } = useNotifs();
  const { onboardingDocUrl } = useDocuments();
  const { requests = [] } = useRequests();
  const { reservations = [] } = useReservations();
  const { hourCompensations = [] } = useHours();

  const now = useClock();
  const clockStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  /* ── Pending counts for nav badges ─────────────────────────────────── */
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;
  const pendingReservationsCount = user?.role === 'admin' 
    ? reservations.filter(r => r.status === 'pending').length
    : reservations.filter(r => r.status === 'pending' && r.employeeId === user?.id).length;
  const pendingAdminCount = hourCompensations.filter(h => h.status === 'pending').length;
  
  const navBadges = { 
    requests: pendingRequestsCount, 
    reservations: pendingReservationsCount,
    admin: pendingAdminCount
  };

  /* ── UI state ────────────────────────────────────────────── */
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

  useEffect(() => {
    if (user && user.policyAccepted !== true && policyTimer > 0) {
      const t = setTimeout(() => setPolicyTimer(p => p - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [user, policyTimer]);

  const notiMenuRef = useRef(null);

  /* ── Idle timer reset ──────────────────────────────────────────── */
  const resetIdle = useCallback(() => setLastActivity(Date.now()), [setLastActivity]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetIdle, { passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, resetIdle));
  }, [resetIdle]);

  /* ── Click-outside for dropdowns ────────────────────────────── */
  useEffect(() => {
    function handler(e) {
      if (notiMenuRef.current && !notiMenuRef.current.contains(e.target))
        setNotiMenu(false);
    }
    document.addEventListener('mousedown', handler, { passive: true });
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Global keyboard shortcut: ⌘K / Ctrl+K ──────────────────────── */
  // (kept for future re-enabling, not rendered in topbar)
  // Command palette available via CommandPalette component

  /* ── Navigation handler ─────────────────────────────────────────── */
  const handleNavigate = useCallback((id) => {
    navigate('/' + id);
    setSideOpen(false);
  }, [navigate]);

  /* ── Derived data ──────────────────────────────────────────────── */
  const unreadCount = notifications.filter(n => !n.read).length;
  const handleMarkAllRead = () => markAllNotifsRead?.(user?.id);

  /* ── Breadcrumbs ────────────────────────────────────────────────── */
  const currentItem = allItems.find(i => i.id === page);
  const breadcrumbs = currentItem ? ['Margube', currentItem.label] : ['Margube'];

  /* ── Sidebar content (shared between desktop + mobile drawer) ──── */
  const getSidebarContent = (isMobile = false) => {
    const isCollapsed = !isMobile && collapsed;
    return (
      <div className={styles.sidebarInner}>
        {/* Logo */}
        <div className={styles.logoArea}>
          <div className={styles.logoMark}>
            <img
              src={theme === 'dark' ? logoWhite : logoColor}
              alt="Margube"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className={styles.navGroup} role="navigation" aria-label="Navegación principal">
          <p className={styles.navSectionLabel}>Menú</p>
          {navItems.map(i => (
            <NavLink
              key={i.id}
              item={i}
              onNavigate={handleNavigate}
              collapsed={isCollapsed}
              badge={i.badgeKey ? navBadges[i.badgeKey] || 0 : 0}
              active={page === i.id}
            />
          ))}

          {user?.role === 'admin' && (
            <>
              <div className={styles.navDivider} />
              <p className={styles.navSectionLabel}>Admin</p>
              {adminItems.map(i => (
                <NavLink key={i.id} item={i} onNavigate={handleNavigate} collapsed={isCollapsed} badge={0} active={page === i.id} />
              ))}
            </>
          )}
        </nav>

        {/* ── User bottom section ─────────────────────────────────── */}
        <div className={styles.userBottom}>
          {/* Avatar + info */}
          <div className={styles.userCard}>
            <Avatar initials={user?.avatar || '??'} size={34} />
            <div className={styles.userInfo}>
              <p className={styles.userName}>{user?.name}</p>
              <p>{user?.dept}</p>
            </div>
          </div>

          {/* Quick action buttons — always visible */}
          <div className={styles.userActions}>
            <Button
              variant="action"
              size="sm"
              icon={User}
              onClick={() => handleNavigate('profile')}
              title="Mi perfil"
              aria-label="Ir a mi perfil"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>Perfil</span>
            </Button>
            <Button
              variant="action-danger"
              size="sm"
              icon={LogOut}
              onClick={() => logout()}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>Salir</span>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.layout}>
      {/* Ambient background orbs — cinematic depth */}
      <div className={styles.bgBlob1} aria-hidden="true" />
      <div className={styles.bgBlob2} aria-hidden="true" />
      <div className={styles.bgBlob3} aria-hidden="true" />

      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside
        className={clsx(styles.sidebar, { [styles.sidebarCollapsed]: collapsed }, 'hide-tablet')}
        aria-label="Sidebar de navegación"
      >
        {getSidebarContent(false)}
        <button
          onClick={toggleCollapse}
          className={styles.collapseBtn}
          aria-label={collapsed ? 'Ampliar menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      {/* ── Mobile drawer ────────────────────────────────────────── */}
      <AnimatePresence>
        {sideOpen && (
          <div className={styles.mobileOverlay} role="dialog" aria-modal="true" aria-label="Menú de navegación">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={styles.mobileBackdrop}
              onClick={() => setSideOpen(false)}
            />
            <motion.aside
              initial={{ x: 'calc(-100% - 12px)' }}
              animate={{ x: 0 }}
              exit={{ x: 'calc(-100% - 12px)' }}
              transition={{ type: 'spring', damping: 28, stiffness: 380, bounce: 0 }}
              className={styles.sidebarMobileContent}
            >
              {getSidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className={clsx(styles.main, { [styles.mainCollapsed]: collapsed })}>

        {/* ── Topbar ─────────────────────────────────────────────── */}
        <header className={styles.header} role="banner">
          <div className={styles.headerLeft}>
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              iconOnly
              icon={Menu}
              className="show-tablet"
              onClick={() => setSideOpen(true)}
              aria-label="Abrir menú"
            />

            {/* Page title + breadcrumbs */}
            <div className={styles.titleBlock}>
              {/* Breadcrumbs */}
              <div className={styles.breadcrumbs} aria-label="Breadcrumb" role="navigation" style={{ display: 'flex' }}>
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb} className={styles.breadcrumbItem}>
                    {i > 0 && <span className={styles.breadcrumbSep} aria-hidden="true">›</span>}
                    <span className={i === breadcrumbs.length - 1 ? styles.breadcrumbActive : styles.breadcrumbMuted}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </div>

              {/* Animated page title */}
              <AnimatePresence mode="wait">
                <motion.h1
                  key={page}
                  className={styles.pageTitle}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                >
                  {allItems.find(i => i.id === page)?.label || 'Margube'}
                </motion.h1>
              </AnimatePresence>
            </div>
          </div>

          {/* Right actions */}
          <div className={styles.headerRight}>
            {/* Live clock */}
            <div className={styles.liveClock} aria-label="Hora actual">
              <Clock size={13} aria-hidden="true" />
              <span>{clockStr}</span>
            </div>

            {/* Settings button — where theme toggle used to be */}
            <Button
              variant="ghost"
              iconOnly
              icon={SlidersHorizontal}
              onClick={() => handleNavigate('settings')}
              aria-label="Ajustes"
              title="Ajustes"
            />

            {/* Notifications */}
            <div style={{ position: 'relative' }} ref={notiMenuRef}>
              <Button
                variant="ghost"
                iconOnly
                icon={Bell}
                onClick={() => setNotiMenu(v => !v)}
                className={styles.bellBtn}
                aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
                aria-expanded={notiMenu}
              />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className={styles.badge}
                  aria-hidden="true"
                  style={{ pointerEvents: 'none', position: 'absolute', top: -2, right: -2 }}
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
          </div>
        </header>

        {/* ── Page content ───────────────────────────────────────── */}
        <main className={styles.content} id="main-content" role="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: '100%' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Live Toast Notifications ────────────────────────────── */}
      <LiveToastContainer liveNotifs={liveNotifs} />

      {/* ── Onboarding Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {needsOnboarding && <OnboardingModal />}
      </AnimatePresence>

      {/* ── Policy Modal (Blocking) ──────────────────────────────── */}
      <PolicyModal
        user={user}
        policyAccepted={user?.policyAccepted}
        policyTimer={policyTimer}
        policyRead={policyRead}
        setPolicyRead={setPolicyRead}
        onboardingDocUrl={onboardingDocUrl}
        setCurrentUser={setCurrentUser}
      />
    </div>
  );
}
