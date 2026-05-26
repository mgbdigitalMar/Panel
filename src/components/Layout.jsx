import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme, useAuth, useApp, useData } from '../context';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  LayoutDashboard, Calendar, Inbox, Newspaper, Settings, User,
  LogOut, Sun, Moon, Menu, Bell, CheckCircle, XCircle,
  UsersRound, Timer, Check,
} from 'lucide-react';

import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';

import { Avatar, Button } from './ui';
import OnboardingModal from './OnboardingModal';
import styles from './Layout.module.scss';

/* ── Navigation items ─────────────────────────────────────────────── */
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'reservations', label: 'Reservas', icon: Calendar },
  { id: 'requests', label: 'Solicitudes', icon: Inbox },
  { id: 'horas', label: 'Control de Tiempo', icon: Timer },
  { id: 'news', label: 'Noticias y Eventos', icon: Newspaper },
  { id: 'employees', label: 'Equipo', icon: UsersRound },
];
const adminItems = [
  { id: 'admin', label: 'Administración', icon: Settings },
];
const allItems = [...navItems, ...adminItems];

/* ── Single Nav Link ──────────────────────────────────────────────── */
function NavLink({ item, onNavigate, collapsed }) {
  const Icon = item.icon;
  const { page } = useApp();
  const active = page === item.id;
  const [showTip, setShowTip] = useState(false);

  return (
    <div className={styles.navLinkWrapper}>
      <button
        onClick={() => onNavigate(item.id)}
        className={clsx(styles.navLink, { [styles.navLinkActive]: active })}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        onMouseEnter={() => collapsed && setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => collapsed && setShowTip(true)}
        onBlur={() => setShowTip(false)}
      >
        <Icon size={17} aria-hidden="true" />
        <span className={styles.navLabel}>{item.label}</span>
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
          >
            {item.label}
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
  const { theme, toggle } = useTheme();
  const { page, navigate } = useApp();
  const {
    liveNotifs = [],
    notifications = [], markNotifRead, markAllNotifsRead,
    onboardingDocUrl,
  } = useData();

  /* ── UI state ────────────────────────────────────────────── */
  const [sideOpen, setSideOpen] = useState(false);
  const [notiMenu, setNotiMenu] = useState(false);
  
  const [policyRead, setPolicyRead] = useState(false);
  const [policyTimer, setPolicyTimer] = useState(5);

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
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Global keyboard shortcut: ⌘K / Ctrl+K ──────────────────────── */
  // (kept for future re-enabling, not rendered in topbar)
  // Command palette available via CommandPalette component

  /* ── Navigation handler ─────────────────────────────────────────── */
  const handleNavigate = useCallback((id) => {
    navigate(id);
    setSideOpen(false);
  }, [navigate]);

  /* ── Derived data ──────────────────────────────────────────────── */
  const unreadCount = notifications.filter(n => !n.read).length;
  const handleMarkAllRead = () => markAllNotifsRead?.(user?.id);

  /* ── Breadcrumbs ────────────────────────────────────────────────── */
  const currentItem = allItems.find(i => i.id === page);
  const breadcrumbs = currentItem ? ['Margube', currentItem.label] : ['Margube'];

  /* ── Sidebar content (shared between desktop + mobile drawer) ──── */
  const sidebarContent = (
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
          <NavLink key={i.id} item={i} onNavigate={handleNavigate} />
        ))}

        {user?.role === 'admin' && (
          <>
            <div className={styles.navDivider} />
            <p className={styles.navSectionLabel}>Admin</p>
            {adminItems.map(i => (
              <NavLink key={i.id} item={i} onNavigate={handleNavigate} />
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
            Perfil
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
            Salir
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.layout}>
      {/* Ambient background orbs — cinematic depth */}
      <div className={styles.bgBlob1} aria-hidden="true" />
      <div className={styles.bgBlob2} aria-hidden="true" />
      <div className={styles.bgBlob3} aria-hidden="true" />

      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside
        className={clsx(styles.sidebar, 'hide-tablet')}
        aria-label="Sidebar de navegación"
      >
        {sidebarContent}
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
              {sidebarContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className={styles.main}>

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
              <div className={styles.breadcrumbs} aria-label="Breadcrumb" role="navigation">
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

            {/* Theme toggle */}
            <Button
              variant="ghost"
              iconOnly
              icon={theme === 'dark' ? Sun : Moon}
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
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

              <AnimatePresence>
                {notiMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className={clsx(styles.dropdown, styles.notiDropdown)}
                    role="dialog"
                    aria-label="Panel de notificaciones"
                  >
                    <div className={styles.dropdownHeader}>
                      <p>Notificaciones</p>
                      {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                          Marcar todo leído
                        </Button>
                      )}
                    </div>

                    <div className={styles.notiList} role="list">
                      {notifications.length === 0 ? (
                        <div className={styles.emptyNoti}>
                          <p>No hay notificaciones recientes</p>
                        </div>
                      ) : (
                        notifications.map(n => {
                          const typeIcon = n.type === 'success' ? <CheckCircle size={13} /> : n.type === 'error' ? <XCircle size={13} /> : <Bell size={13} />;
                          const typeStyle = n.type === 'success' ? styles.notiSuccess : n.type === 'error' ? styles.notiWarning : styles.notiAccent;
                          let entityNav = n.entity_type === 'request' ? 'requests' : n.entity_type === 'document' ? 'profile' : n.entity_type === 'hour_compensation' ? 'horas' : n.entity_type === 'reservation' ? 'reservations' : 'dashboard';
                          if (user?.role === 'admin' && n.entity_type === 'hour_compensation') entityNav = 'admin';

                          return (
                            <div
                              key={n.id}
                              role="listitem"
                              className={clsx(styles.notiItem, { [styles.notiItemRead]: n.read })}
                              onClick={() => { markNotifRead?.(n.id); navigate(entityNav); setNotiMenu(false); }}
                              tabIndex={0}
                              onKeyDown={e => e.key === 'Enter' && (markNotifRead?.(n.id), navigate(entityNav), setNotiMenu(false))}
                            >
                              <div className={clsx(styles.notiIcon, typeStyle)} aria-hidden="true">
                                {typeIcon}
                              </div>
                              <div className={styles.notiText}>
                                <strong>{n.title}</strong>
                                {n.body && <span>{n.body}</span>}
                                <span style={{ fontSize: 10, color: 'var(--text-mut)', marginTop: 2 }}>
                                  {new Date(n.created_at).toLocaleString('es-ES', {
                                    day: '2-digit', month: 'short',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              {!n.read && <span className={styles.unreadDot} aria-label="No leída" />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 'var(--z-toast)',
          pointerEvents: 'none',
          maxWidth: 'calc(100vw - 48px)',
        }}
      >
        <AnimatePresence>
          {liveNotifs.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.92 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'var(--glass-blur)',
                WebkitBackdropFilter: 'var(--glass-blur)',
                border: '1px solid var(--glass-border)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: 'var(--radius)',
                padding: '13px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: 'var(--shadow-xl)',
                width: 'min(360px, calc(100vw - 48px))',
                pointerEvents: 'all',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{n.icon}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13.5, flex: 1 }}>
                {n.msg}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Onboarding Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {needsOnboarding && <OnboardingModal />}
      </AnimatePresence>

      {/* ── Policy Modal (Blocking) ──────────────────────────────── */}
      <AnimatePresence>
        {user && user.policyAccepted !== true && (
          <div
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.88)',
              zIndex: 'var(--z-toast)',
              display: 'flex',
              flexDirection: 'column',
              padding: 'clamp(12px, 3vw, 24px)',
              backdropFilter: 'blur(8px)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Lectura obligatoria"
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                backgroundColor: 'var(--bg)',
                borderRadius: 'var(--radius-xl)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-2xl)',
                maxWidth: 900,
                margin: '0 auto',
                width: '100%',
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                <h2 style={{ margin: 0, fontSize: 'clamp(16px,2vw,20px)', color: 'var(--text)', letterSpacing: '-0.03em' }}>
                  Lectura Obligatoria
                </h2>
                <p style={{ margin: '6px 0 0', color: 'var(--text-sec)', fontSize: 13, lineHeight: 1.6 }}>
                  Es obligatorio leer y aceptar el <strong>Procedimiento de Normas Internas 2026</strong> para continuar.
                </p>
              </div>
              <div style={{ flex: 1, background: '#f5f5f5', position: 'relative' }}>
                <iframe
                  src={onboardingDocUrl ? `${onboardingDocUrl}#toolbar=0` : "/Procedimiento normas internas 2026.pdf#toolbar=0"}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                  title="Procedimiento de normas internas"
                />
              </div>
              <div style={{
                padding: '18px 24px',
                borderTop: '1px solid var(--border)',
                background: 'var(--card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: policyTimer === 0 ? 'pointer' : 'not-allowed', opacity: policyTimer === 0 ? 1 : 0.6, userSelect: 'none' }}>
                  <div style={{ position: 'relative', width: 22, height: 22 }}>
                    <input 
                      type="checkbox" 
                      disabled={policyTimer > 0} 
                      checked={policyRead} 
                      onChange={e => setPolicyRead(e.target.checked)} 
                      style={{ position: 'absolute', opacity: 0, cursor: policyTimer === 0 ? 'pointer' : 'not-allowed', width: '100%', height: '100%', margin: 0, zIndex: 2 }} 
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: policyRead ? 'var(--accent)' : 'var(--bg)',
                      border: policyRead ? '2px solid var(--accent)' : '2px solid var(--border)',
                      borderRadius: '6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                      boxShadow: policyRead ? '0 2px 8px rgba(34,81,255,0.3)' : 'none',
                      zIndex: 1
                    }}>
                      <Check size={14} color="#fff" strokeWidth={3} style={{ opacity: policyRead ? 1 : 0, transform: policyRead ? 'scale(1)' : 'scale(0.5)', transition: 'all 0.2s' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: policyRead ? 'var(--text)' : 'var(--text-sec)', transition: 'color 0.2s' }}>
                    Confirmo que he leído el documento hasta el final
                  </span>
                </label>
                <Button
                  variant="primary"
                  size="lg"
                  icon={CheckCircle}
                  disabled={!policyRead || policyTimer > 0}
                  onClick={() => setCurrentUser({ id: user.id, policyAccepted: true })}
                >
                  {policyTimer > 0 ? `Espera ${policyTimer}s...` : 'Confirmar lectura'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
