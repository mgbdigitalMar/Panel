import { useState, useRef, useEffect } from 'react';
import { useTheme, useAuth, useApp, useData } from '../context';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { 
  LayoutDashboard, Calendar, Inbox, Newspaper, Settings,
  LogOut, Sun, Moon, Menu, Bell, CheckCircle, Clock,
  UsersRound, AlignJustify, List
} from 'lucide-react';

import { Avatar } from './ui';
import OnboardingModal from './OnboardingModal';
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
  const { user, logout, needsOnboarding } = useAuth();
  const { theme, toggle } = useTheme();
  const { page, navigate } = useApp();
  const { requests, reservations, readIds, markRead, markAllRead, density, toggleDensity } = useData();

  const [sideOpen, setSideOpen] = useState(false);
  const [notiMenu, setNotiMenu] = useState(false);
  const notiMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notiMenuRef.current && !notiMenuRef.current.contains(e.target)) setNotiMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const sidebarContent = (
    <div className={styles.sidebarInner}>
      <div className={styles.logoArea}>
        <div className={styles.logoIcon}>M</div>
        <span className={styles.logoText}>margube</span>
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
            <p>{user?.name}</p>
            <p>{user?.dept}</p>
          </div>
          <button onClick={logout} title="Cerrar sesión" className={styles.logoutBtn}>
            <LogOut size={15} />
          </button>
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
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
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
            {/* Density toggle */}
            <button onClick={toggleDensity} className={styles.iconBtn} title={density === 'compact' ? 'Vista normal' : 'Vista compacta'}>
              {density === 'compact' ? <AlignJustify size={17} /> : <List size={17} />}
            </button>

            {/* Theme */}
            <button onClick={toggle} className={styles.iconBtn}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notifications bell */}
            <div style={{ position: 'relative' }} ref={notiMenuRef}>
              <button onClick={() => setNotiMenu(v => !v)} className={clsx(styles.iconBtn, styles.bellBtn)}>
                <Bell size={17} />
                {unreadCount > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={styles.badge}>
                    {unreadCount}
                  </motion.span>
                )}
              </button>

              <AnimatePresence>
                {notiMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.12 }}
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {needsOnboarding && <OnboardingModal />}
      </AnimatePresence>
    </div>
  );
}
