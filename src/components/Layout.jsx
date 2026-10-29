import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useAuth, useTheme, useNotifs, useDocuments, useRequests, useReservations, useHours, usePersonalDays, useDataSync } from '../context';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  LayoutDashboard, Calendar, Inbox, Newspaper, Settings,
  Bell, UsersRound, Timer, AlertTriangle, UserRound, SlidersHorizontal, LayoutGrid,
} from 'lucide-react';

import { Avatar, TopProgress, PageLoader } from './ui';
import { Wallpaper } from './Wallpaper';
import { GlassHeader, GlassTabBar } from './GlassChrome';
import OnboardingModal from './OnboardingModal';
import { NotificationsDropdown } from './NotificationsDropdown';
import { PolicyModal } from './PolicyModal';
import { LiveToastContainer } from './LiveToastContainer';
import CommandPalette from './CommandPalette';
import { ShortcutsSheet } from './ShortcutsSheet';
import { ConnectionStatus } from './ConnectionStatus';
import { IdleWarning } from './IdleWarning';
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

/* Heading shown at the top of the content panel. The dashboard draws its own.
   `width`: pages laid out as a centred column; the heading lines up with it.
   `touch`: on phones and tablets the page composes its own screen, masthead included (Touch.jsx).
   `own`: the page draws its own header everywhere (title, description and actions).
   `desk`: on computers the page draws its own heading with its actions (Desk.jsx).
   `coverOwn`: on phones and tablets the page's own first panel is its cover (Mi perfil); the
   heading keeps only the date line.
   `icon`: the section's mark, beside today's date on every screen size. */
const PAGE_META = {
  reservations: { title: 'Reservas',           desc: 'Salas y vehículos de empresa: mira qué está libre y reserva en segundos.', touch: true, desk: true, icon: Calendar },
  requests:     { title: 'Solicitudes',        desc: 'Asuntos propios, trabajo en remoto o externo y compras.', touch: true, desk: true, icon: Inbox },
  horas:        { title: 'Tiempo a compensar', desc: 'Registra tus horas y consulta tu saldo con la empresa.', own: true, icon: Timer },
  mas:          { title: 'Más',                desc: 'Tu cuenta, el resto de secciones y tus preferencias.', own: true, icon: LayoutGrid },
  news:         { title: 'Noticias y Eventos', desc: 'Comunicados, novedades y próximos eventos de Margube.', icon: Newspaper },
  employees:    { title: 'Equipo',             desc: 'Directorio del equipo y dónde trabaja cada persona, hoy y durante la semana.', touch: true, desk: true, icon: UsersRound },
  profile:      { title: 'Mi perfil',          desc: 'Tus datos, modo de trabajo, contraseña y documentos.', width: 1180, coverOwn: true, icon: UserRound },
  settings:     { title: 'Ajustes',            desc: 'Tema, notificaciones y preferencias de tu cuenta.', width: 680, icon: SlidersHorizontal },
  admin:        { title: 'Administración',     desc: 'Empleados, salas, vehículos, documentos y bolsa de horas.', touch: true, desk: true, icon: Settings },
};

// The clock shows hours and minutes: ticking on each minute (not every second) spares a
// re-render of the whole chrome sixty times a minute
function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    let id;
    const schedule = () => {
      const now = new Date();
      id = setTimeout(() => { setTime(new Date()); schedule(); }, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
    };
    schedule();
    // Back from sleep or a background tab, the timer may be late: catch up at once
    const onVisible = () => { if (document.visibilityState === 'visible') setTime(new Date()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', onVisible); };
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

export default function Layout({ children }) {
  const { user, logout, needsOnboarding, setLastActivity, patchUser, refreshEmployees } = useAuth();
  const { theme, setMode } = useTheme();
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

  const [notiMenu, setNotiMenu] = useState(false);

  const [policyRead, setPolicyRead] = useState(false);
  const [policyTimer, setPolicyTimer] = useState(5);

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

  // Notifications bell + dropdown, in the top bar
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

  return (
    <div className={clsx(styles.layout, 'app-shell')}>
      {/* The wallpaper the panels frost over */}
      <Wallpaper />

      <div className={styles.main}>
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
                <div className={clsx(styles.pageIntro, meta.touch && styles.pageIntroTouchOwn, meta.desk && styles.pageIntroDeskOwn, meta.own && styles.pageIntroOwn, meta.coverOwn && styles.pageIntroCoverOwn)} style={meta.width ? { maxWidth: meta.width, marginInline: 'auto' } : undefined}>
                  {/* The section's mark beside today's date, as on every page (a masthead on phones and tablets) */}
                  <p className={styles.introEyebrow}>
                    {meta.icon && <span className={styles.introMark} aria-hidden="true"><meta.icon size={15} /></span>}
                    <span>{now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </p>
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

      {/* Phones: sections in a dock at the bottom (tablets and computers have them in the top bar) */}
      <GlassTabBar
        items={user?.role === 'admin' ? [...navItems, ...adminItems] : navItems}
        page={page}
        badges={navBadges}
        onNavigate={handleNavigate}
      />

      <LiveToastContainer liveNotifs={liveNotifs} />

      <CommandPalette open={cmdOpen} onClose={closeCmd} onShowShortcuts={openShortcuts} />
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} isAdmin={user?.role === 'admin'} />
      <ConnectionStatus />
      <IdleWarning />

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
