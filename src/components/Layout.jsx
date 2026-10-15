import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useAuth, useNotifs, useDocuments, useRequests, useReservations, useHours, useDataSync } from '../context';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { springConfig } from '../hooks/useSpringAnimation';
import {
  LayoutDashboard, Calendar, Inbox, Newspaper, Settings, User,
  LogOut, Menu, Bell, CheckCircle, XCircle,
  UsersRound, Timer, Check, SlidersHorizontal, Clock, ChevronLeft, ChevronRight, Search
} from 'lucide-react';

import logoWhite from '../assets/logos/logo-white.png';
import logoIcon from '../assets/logos/logo-icon.png';

import { Avatar, Button, TopProgress, PageLoader, AnimatedBackdrop } from './ui';
import OnboardingModal from './OnboardingModal';
import { NotificationsDropdown } from './NotificationsDropdown';
import { PolicyModal } from './PolicyModal';
import { LiveToastContainer } from './LiveToastContainer';
import CommandPalette from './CommandPalette';
import { ShortcutsSheet } from './ShortcutsSheet';
import { ConnectionStatus } from './ConnectionStatus';
import styles from './Layout.module.scss';

/* ── Navigation items ─────────────────────────────────────────────── */
const navItems = [
  { id: 'dashboard',    label: 'Dashboard',         icon: LayoutDashboard },
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
function NavLink({ item, onNavigate, collapsed, badge, active, pillId, index = 0 }) {
  const Icon = item.icon;
  const [showTip, setShowTip] = useState(false);

  return (
    <div className={styles.navLinkWrapper} style={{ '--i': index }}>
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
        <Icon size={17} aria-hidden="true" />
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
          <motion.span
            className={styles.navBadgeDot}
            aria-label={`${badge} pendientes`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 26, mass: 0.8, stiffness: 300 }}
          />
        )}
      </motion.button>

      {/* Floating tooltip when collapsed - Apple style spring entrance */}
      <AnimatePresence>
        {collapsed && showTip && (
          <motion.div
            className={styles.navTooltip}
            initial={{ opacity: 0, x: -8, y: '-50%', scale: 0.92 }}
            animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
            exit={{ opacity: 0, x: -6, y: '-50%', scale: 0.94 }}
            transition={springConfig.responsive}
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
  const { liveNotifs = [], notifications = [], markNotifRead, markAllNotifsRead } = useNotifs();
  const { onboardingDocUrl } = useDocuments();
  const { requests = [] } = useRequests();
  const { reservations = [] } = useReservations();
  const { hourCompensations = [] } = useHours();
  const { loadingData = false } = useDataSync() || {};

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

  /* ── Navigation handler ─────────────────────────────────────────── */
  const handleNavigate = useCallback((id) => {
    navigate('/' + id);
    setSideOpen(false);
  }, [navigate]);

  /* ── Global search + keyboard shortcuts ─────────────────────────── */
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

  /* ── Derived data ──────────────────────────────────────────────── */
  const unreadCount = notifications.filter(n => !n.read).length;
  const handleMarkAllRead = () => markAllNotifsRead?.(user?.id);

  /* ── Breadcrumbs ────────────────────────────────────────────────── */
  // Profile is reached from the user chip, not the nav list, so it needs its own label
  const pageLabel = allItems.find(i => i.id === page)?.label || (page === 'profile' ? 'Mi perfil' : null);
  const breadcrumbs = pageLabel ? ['Margube', pageLabel] : ['Margube'];

  /* ── Sidebar content (shared between desktop + mobile drawer) ──── */
  const getSidebarContent = (isMobile = false) => {
    const isCollapsed = !isMobile && collapsed;
    const pillId = isMobile ? 'nav-pill-drawer' : 'nav-pill-rail';
    return (
      <div className={styles.sidebarInner}>
        {/* Logo */}
        <div className={clsx(styles.logoArea, { [styles.logoAreaCollapsed]: isCollapsed })}>
          <div className={styles.logoMark}>
            <img
              src={isCollapsed ? logoIcon : logoWhite}
              alt="Margube"
              className={clsx({ [styles.logoIconCollapsed]: isCollapsed })}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className={styles.navGroup} role="navigation" aria-label="Navegación principal">
          <p className={styles.navSectionLabel}>Menú</p>
          {navItems.map((i, idx) => (
            <NavLink
              key={i.id}
              item={i}
              index={idx}
              pillId={pillId}
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
                <NavLink 
                  key={i.id} 
                  item={i}
                  index={navItems.length}
                  pillId={pillId}
                  onNavigate={handleNavigate}
                  collapsed={isCollapsed} 
                  badge={i.badgeKey ? navBadges[i.badgeKey] || 0 : 0} 
                  active={page === i.id} 
                />
              ))}
            </>
          )}

          <div className={styles.navDivider} />
          <NavLink
            item={settingsItem}
            index={navItems.length + 1}
            pillId={pillId}
            onNavigate={handleNavigate}
            collapsed={isCollapsed}
            badge={0}
            active={page === settingsItem.id}
          />
        </nav>

        {/* ── User bottom section ─────────────────────────────────── */}
        <div className={styles.userBottom}>
          {/* Avatar + info */}
          <div 
            className={styles.userCard}
            onClick={() => handleNavigate('profile')}
            role="button"
            tabIndex={0}
            title="Ir a mi perfil"
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleNavigate('profile'); }}
          >
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
              iconOnly={isCollapsed}
              onClick={() => handleNavigate('profile')}
              title="Mi perfil"
              aria-label="Ir a mi perfil"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {!isCollapsed && 'Perfil'}
            </Button>
            <Button
              variant="action-danger"
              size="sm"
              icon={LogOut}
              iconOnly={isCollapsed}
              onClick={() => logout()}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {!isCollapsed && 'Salir'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={clsx(styles.layout, 'app-shell')}>
      {/* Same animated backdrop as the login: drifting glows + dot grid */}
      <AnimatedBackdrop />

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
              data-scrim
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
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] }, transitionEnd: { filter: 'none' } }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
                >
                  {pageLabel || 'Margube'}
                </motion.h1>
              </AnimatePresence>
            </div>
          </div>

          {/* Right actions */}
          <div className={styles.headerRight}>
            {/* Global search trigger */}
            <button
              type="button"
              className={styles.searchTrigger}
              onClick={() => setCmdOpen(true)}
              aria-label="Buscar (Ctrl+K)"
              aria-haspopup="dialog"
            >
              <Search size={15} aria-hidden="true" />
              <span className={styles.searchTriggerLabel}>Buscar…</span>
              <kbd className={styles.cmdKbd}>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
            </button>

            {/* Live clock */}
            <div className={styles.liveClock} aria-label="Hora actual">
              <Clock size={13} aria-hidden="true" />
              <span>{clockStr}</span>
            </div>


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
                  key={unreadCount}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 24 }}
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

          {/* Data sync hairline along the bottom edge of the glass bar */}
          <TopProgress active={loadingData} />
        </header>

        {/* ── Page content ───────────────────────────────────────── */}
        <main className={styles.content} id="main-content" role="main" aria-busy={loadingData}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={page}
              className="page-stagger"
              initial={{ opacity: 0 }}
              // A lingering transform would trap position:fixed modals inside this wrapper
              animate={{ opacity: 1, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] }, transitionEnd: { transform: 'none' } }}
              exit={{ opacity: 0, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
              style={{ width: '100%' }}
            >
              {/* First data sync shows the page skeleton instead of empty states */}
              {loadingData ? <PageLoader /> : (
                <Suspense fallback={<PageLoader />}>
                  {children}
                </Suspense>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Live Toast Notifications ────────────────────────────── */}
      <LiveToastContainer liveNotifs={liveNotifs} />

      {/* ── Global search, shortcuts sheet, network status ─────── */}
      <CommandPalette open={cmdOpen} onClose={closeCmd} onShowShortcuts={openShortcuts} />
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} isAdmin={user?.role === 'admin'} />
      <ConnectionStatus />

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
