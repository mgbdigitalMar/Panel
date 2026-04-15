import { useState, useRef, useEffect } from 'react';
import { useTheme, useAuth, useApp, useData } from '../context';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { 
  LayoutDashboard, Calendar, Inbox, Newspaper, Settings, User,
  LogOut, Sun, Moon, Menu, Bell, CheckCircle, Clock,
  UsersRound, AlignJustify, List, Globe
} from 'lucide-react';

import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';

import { Avatar } from './ui';
import OnboardingModal from './OnboardingModal';
import { Select } from './ui';
import styles from './Layout.module.scss';

const navItems = [
  { id: 'dashboard',    label: 'Dashboard',          icon: LayoutDashboard },
  { id: 'reservations', label: 'Reservas',           icon: Calendar       },
  { id: 'requests',     label: 'Solicitudes',        icon: Inbox          },
  { id: 'news',         label: 'Noticias y Eventos', icon: Newspaper      },
  { id: 'employees',    label: 'Equipo',             icon: UsersRound     },
];
const adminItems = [
  { id: 'admin', label: 'Administración', icon: Settings },
];

export default function Layout({ children }) {
  const { user, logout, needsOnboarding, setLastActivity, setCurrentUser } = useAuth();
  const { theme, toggle } = useTheme();
  const { page, navigate } = useApp();
  const { requests, reservations, readIds, markRead, markAllRead, density, toggleDensity, liveNotifs = [] } = useData();

  const [sideOpen, setSideOpen] = useState(false);
  const [notiMenu, setNotiMenu] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const notiMenuRef = useRef(null);

  // Reset idle timer on activity
  const resetIdle = () => setLastActivity(Date.now());

  const userDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notiMenuRef.current && !notiMenuRef.current.contains(e.target)) setNotiMenu(false);
      if (userDropdown && userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userDropdown]);

  // Activity listeners for idle timeout
  useEffect(() => {
    const handleActivity = resetIdle;
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('click', handleActivity);
    document.addEventListener('scroll', handleActivity);
    return () => {
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('scroll', handleActivity);
    };
  }, [resetIdle]);

  // Notifications logic — only unread count shown in badge
  const pendingRequests = requests.filter(r =>
    r.status === 'pending' && (user?.role === 'admin' || r.employeeId === user?.id)
  );
  const upcomingReservations = reservations.filter(r =>
    r.status === 'confirmed' && (user?.role === 'admin' || r.employeeId === user?.id)
  );

  const allNotiItems = [
    ...pendingRequests.map(r => ({ id: `req-${r.id}`, kind: 'request', data: r })),
    ...upcomingReservations.map(r => ({ id: `res-${r.id}`, kind: 'reservation', data: r })),
  ];

  const unreadCount = allNotiItems.filter(n => !readIds.has(n.id)).length;

  const handleMarkAllRead = () => markAllRead(allNotiItems.map(n => n.id));

  const NavLink = ({ item }) => {
    const active = page === item.id;
    const Icon = item.icon;
    return (
      <button
        onClick={() => { navigate(item.id); setSideOpen(false); }}
        className={clsx(styles.navLink, { [styles.navLinkActive]: active })}
      >
        <Icon size={17} />
        {item.label}
      </button>
    );
  };

const WORK_MODES = {
  office: { label: 'Oficina' },
  remote: { label: 'Remoto' },
  field: { label: 'Externo' },
};

const sidebarContent = (
    <div className={styles.sidebarInner}>
      <div className={styles.logoArea}>
{theme === 'dark' ? <img src={logoWhite} alt="Margube" style={{ width: '160px', height: 'auto' }} /> : <img src={logoColor} alt="Margube" style={{ width: '160px', height: 'auto' }} />}
      </div>

      <nav className={styles.navGroup} style={{ flex: 1 }}>
        {navItems.map(i => <NavLink key={i.id} item={i} />)}
        {user?.role === 'admin' && (
          <>
            <div className={styles.navDivider} />
            {adminItems.map(i => <NavLink key={i.id} item={i} />)}
          </>
        )}
      </nav>

      <div className={styles.userBottom}>
        <div className={styles.userCard}>
            <Avatar initials={user?.avatar || '??'} size={32} />
            <div className={styles.userInfo}>
              <motion.p className={styles.userName}>{user?.name}</motion.p>
              <p>{user?.dept}</p>
            </div>
            <button
              ref={userDropdownRef}
              className={styles.dropdownToggle}
              onClick={(e) => {
                e.stopPropagation();
                setUserDropdown(prev => !prev);
              }}
              title="Menú de usuario"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 1.82-2.49A1.72 1.72 0 0 0 18.55 9.4h-5.43A1.72 1.72 0 0 0 11 11V8.6a1.72 1.72 0 0 0-1.4-1.68l-.14-.06A2 2 0 0 0 7.6 8a2 2 0 0 0-1.95 1.69A1.65 1.65 0 0 0 4.6 12.2 6.13 6.13 0 0 0 5 16.9v.9a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-.9a6.09 6.09 0 0 0 1.4-4Z"/>
              </svg>
            </button>
            <AnimatePresence>
              {userDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  className={styles.userDropdown}
                >
                  <button onClick={(e) => {
                    e.stopPropagation();
                    navigate('profile');
                    setSideOpen(false);
                    setUserDropdown(false);
                  }} className={styles.dropdownItem}>
                    <User size={16} />
                    Perfil
                  </button>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    logout();
                  }} className={clsx(styles.dropdownItem, styles.logoutDropdown)}>
                    <LogOut size={16} />
                    Cerrar sesión
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
      </div>
    </div>
  );

  return (
    <div className={styles.layout} data-density={density}>
      {/* Desktop sidebar */}
      <aside className={clsx(styles.sidebar, 'hide-mobile')}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sideOpen && (
          <div className={styles.mobileOverlay}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={styles.mobileBackdrop} onClick={() => setSideOpen(false)} />
            <motion.aside
              initial={{ x: '-100%', scale: 0.95 }} 
              animate={{ x: 0, scale: 1 }} 
              exit={{ x: '-100%', scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350, bounce: 0.1 }}
              className={styles.sidebarMobileContent}
            >
              {sidebarContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className={styles.main}>
        {/* ── Topbar ─────────────────────────────────────── */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={clsx(styles.iconBtn, 'show-mobile')} onClick={() => setSideOpen(true)}>
              <Menu size={20} />
            </button>
            <h1 className={styles.pageTitle}>
              {[...navItems, ...adminItems].find(i => i.id === page)?.label || 'margube'}
            </h1>
          </div>

          <div className={styles.headerRight}>


            {/* Theme */}
            <button onClick={toggle} className={styles.iconBtn}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notifications bell */}
            <div style={{ position: 'relative' }} ref={notiMenuRef}>
              <button onClick={() => setNotiMenu(v => !v)} className={clsx(styles.iconBtn, styles.bellBtn)}>
                <Bell size={17} />
                {unreadCount > 0 && (
              <motion.span initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className={styles.badge}>
                    {unreadCount}
                  </motion.span>
                )}
              </button>

              <AnimatePresence>
                {notiMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }} 
                  transition={{ duration: 0.15, type: 'spring', bounce: 0.2 }}
                  className={clsx(styles.dropdown, styles.notiDropdown)}
                >
                    <div className={styles.dropdownHeader}>
                      <p>Notificaciones</p>
                      {unreadCount > 0 && (
                        <button className={styles.markReadBtn} onClick={handleMarkAllRead}>
                          Marcar todo leído
                        </button>
                      )}
                    </div>

                    <div className={styles.notiList}>
                      {allNotiItems.length === 0 ? (
                        <p className={styles.emptyNoti}>No hay notificaciones</p>
                      ) : (
                        allNotiItems.map(n => {
                          const isRead = readIds.has(n.id);
                          return (
                            <div
                              key={n.id}
                              className={clsx(styles.notiItem, { [styles.notiItemRead]: isRead })}
                              onClick={() => {
                                markRead(n.id);
                                navigate(n.kind === 'request' ? 'requests' : 'reservations');
                                setNotiMenu(false);
                              }}
                            >
                              <div className={clsx(styles.notiIcon, n.kind === 'request' ? styles.notiWarning : styles.notiSuccess)}>
                                {n.kind === 'request' ? <Clock size={13} /> : <CheckCircle size={13} />}
                              </div>
                              <div className={styles.notiText}>
                                <strong>{n.kind === 'request' ? 'Solicitud Pendiente' : 'Reserva Confirmada'}</strong>
                                <span>
                                  {n.kind === 'request'
                                    ? `${n.data.employeeName} · ${n.data.type === 'vacation' ? 'Vacaciones' : 'Compra'}`
                                    : `${n.data.resourceName} · ${n.data.date}`}
                                </span>
                              </div>
                              {!isRead && <span className={styles.unreadDot} />}
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

        {/* Page content */}
        <main className={styles.content}>
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Live Toast Notifications ─────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 9999, pointerEvents: 'none' }}>
        <AnimatePresence>
          {liveNotifs.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: 'var(--radius)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                minWidth: 300,
                maxWidth: 380,
                pointerEvents: 'all',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{n.icon}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, flex: 1 }}>{n.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {needsOnboarding && <OnboardingModal />}
      </AnimatePresence>
    </div>
  );
}
