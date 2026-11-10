import { useState, useEffect } from 'react';
import { useTheme, useAuth } from '../context';
import { Card, Avatar } from '../components/ui';
import {
  Sun, Moon, Monitor, BellRing, BellOff, Volume2, VolumeX,
  Palette, Check, User, Building, Wifi, ShieldCheck, Timer, KeyRound, LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTouch } from '../components/Touch';
import styles from './SettingsPage.module.scss';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import {
  PREF_NOTIFS, notificationsSupported, notificationsEnabled, needsIosInstall,
  enablePush, disablePush, showSystemNotification,
} from '../services/webPush';
import { supabase } from '../utils/supabase';
import {
  NOTIFICATION_CATEGORIES, allNotificationsEnabled, fetchNotificationPreferences, setAllNotificationPreferences, fetchNotificationHealth,
} from '../../shared/services/notifications.js';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

function getLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function setLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function Toggle({ checked, onChange, id, disabled, label }) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label || (id === 'sounds-toggle' ? 'Sonidos' : 'Alertas de escritorio')}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(styles.toggle, { [styles.toggleOn]: checked })}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

const HEALTH_ALERT_LABELS = {
  worker_not_configured: 'procesador sin configurar',
  queue_stalled: 'cola detenida',
  worker_silent: 'procesador sin actividad',
  dead_letters: 'avisos sin poder enviar',
  high_failure_rate: 'muchos envíos fallidos',
  provider_config: 'credenciales de un proveedor',
  emit_failed: 'avisos que no se pudieron crear',
};

const formatHealthTime = (iso) => (iso
  ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Todavía no');

export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [browserNotifs, setBrowserNotifs] = useState(() => getLS('margube-browser-notifs', false));
  const [notifPerm, setNotifPerm] = useState('default');
  useEffect(() => {
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission);
  }, []);

  // 'push' = also with the intranet closed · 'local' = only while a tab is open
  const [pushMode, setPushMode] = useState(null);
  const [notifBusy, setNotifBusy] = useState(false);

  // Reflect the real state of this browser when the page opens
  useEffect(() => {
    if (browserNotifs && notificationsEnabled() && user?.id) {
      enablePush(user.id).then(setPushMode);
    }
  }, [browserNotifs, user?.id]);

  const handleAllNotifications = async (val) => {
    if (notifBusy || !notifPrefs || !user?.id) return;
    setNotifBusy(true);
    setPrefsError('');
    try {
      if (val) {
        if (!notificationsSupported() || needsIosInstall()) return;
        let perm = Notification.permission;
        if (perm === 'default') perm = await Notification.requestPermission();
        setNotifPerm(perm);
        if (perm !== 'granted') { setBrowserNotifs(false); setLS(PREF_NOTIFS, false); return; }
        const mode = await enablePush(user.id);
        if (!mode) throw new Error('No se pudo registrar este navegador.');
        const { error } = await setAllNotificationPreferences(supabase, user.id, true);
        if (error) throw error;
        setNotifPrefs(Object.fromEntries(NOTIFICATION_CATEGORIES.map(({ id }) => [id, true])));
        setLS(PREF_NOTIFS, true);
        setBrowserNotifs(true);
        setPushMode(mode);
        // Confirmation the person can see right away
        showSystemNotification({ id: 'test', title: 'Notificaciones activadas', body: 'Así verás los avisos de la intranet.' });
      } else {
        const { error } = await setAllNotificationPreferences(supabase, user.id, false);
        if (error) throw error;
        setNotifPrefs(Object.fromEntries(NOTIFICATION_CATEGORIES.map(({ id }) => [id, false])));
        setLS(PREF_NOTIFS, false);
        setBrowserNotifs(false);
        setPushMode(null);
        await disablePush();
      }
    } catch {
      setPrefsError('No se ha completado el cambio. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setNotifBusy(false);
    }
  };

  // null while loading or if it could not be read: the switches stay hidden rather than lying
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [prefsError, setPrefsError] = useState('');
  useEffect(() => {
    let active = true;
    if (user?.id) fetchNotificationPreferences(supabase, user.id).then((prefs) => {
      if (active) {
        setNotifPrefs(prefs);
        setPrefsError(prefs === null ? 'No se pudieron cargar las preferencias. Vuelve a abrir Ajustes para reintentarlo.' : '');
      }
    });
    return () => { active = false; };
  }, [user?.id]);

  const allNotifsOn = browserNotifs && notifPerm === 'granted' && allNotificationsEnabled(notifPrefs);

  // RRHH sees whether the notification system itself is healthy
  const [notifHealth, setNotifHealth] = useState(null);
  useEffect(() => {
    if (user?.role === 'admin') fetchNotificationHealth(supabase).then(setNotifHealth);
  }, [user?.role]);

  const [soundsOn, setSoundsOn] = useState(() => getLS('margube-sounds', true));
  const handleSounds = (val) => {
    setSoundsOn(val);
    setLS('margube-sounds', val);
    if (val) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } catch {}
    }
  };

  // Phones and tablets: your account is in Más and Mi perfil, so it is not repeated here
  const touch = useTouch();

  const THEME_OPTIONS = [
    { id: 'light',  label: 'Claro',   icon: Sun,     desc: 'Interfaz luminosa' },
    { id: 'dark',   label: 'Oscuro',  icon: Moon,    desc: 'Interfaz oscura' },
    { id: 'system', label: 'Sistema', icon: Monitor, desc: 'Sigue al SO' },
  ];

  const MODE_LABEL = { Office: 'Oficina', remoto: 'Remoto', externo: 'Externo' };

  return (
    <div className={styles.page}>
      <motion.div className={styles.stack} variants={container} initial="hidden" animate="show">
        <div className={styles.col}>

        {/* Apariencia */}
        <motion.div variants={item}>
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={clsx(styles.cardIcon, styles.iconAccent)}>
              <Palette size={17} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Apariencia</h2>
              <p className={styles.cardSub}>Tema visual de la intranet</p>
            </div>
          </div>

          {/* Tema */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Tema de la interfaz</label>
            <div className={styles.themeGrid}>
              {THEME_OPTIONS.map(({ id, label, icon: Icon, desc }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={clsx(styles.themeCard, { [styles.themeCardActive]: mode === id })}
                >
                  {/* A small preview of the theme: its canvas, a pane and the accent */}
                  <span className={styles.themePreview} data-theme-preview={id} aria-hidden="true">
                    <i /><b /><em />
                  </span>
                  <div className={styles.themeCardIcon}>
                    <Icon size={20} />
                  </div>
                  <span className={styles.themeCardLabel}>{label}</span>
                  <span className={styles.themeCardDesc}>{desc}</span>
                  {mode === id && (
                    <span className={styles.themeCardCheck}>
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Card>
        </motion.div>

        {/* Notificaciones */}
        <motion.div variants={item}>
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={clsx(styles.cardIcon, styles.iconSuccess)}>
              <BellRing size={17} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Notificaciones</h2>
              <p className={styles.cardSub}>Alertas y preferencias de sonido</p>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <div className={clsx(styles.rowIcon, allNotifsOn ? styles.iconSuccess : styles.iconNeutral)}>
                {allNotifsOn ? <BellRing size={15} /> : <BellOff size={15} />}
              </div>
              <div>
                <span className={styles.rowLabel}>Todas las notificaciones</span>
                <span className={styles.rowDesc}>Solicitudes, reservas, bolsa de horas, documentos, noticias y eventos.</span>
                <span className={styles.rowDesc}>
                  {needsIosInstall()
                    ? 'En iPhone, abre Margube en Safari y elige Compartir → Añadir a pantalla de inicio. Después, activa aquí los avisos desde la app instalada.'
                    : !notificationsSupported()
                    ? 'Este navegador no admite notificaciones.'
                    : notifPerm === 'denied'
                    ? 'Bloqueadas por el navegador. Permítelas desde el candado de la barra de direcciones.'
                    : allNotifsOn && pushMode === 'push'
                    ? 'Activas, también con la intranet cerrada.'
                    : allNotifsOn && pushMode === 'local'
                    ? 'Activas mientras tengas la intranet abierta, aunque esté en otra pestaña o minimizada.'
                    : 'Recibe avisos del sistema aunque estés en otra pestaña o con la intranet cerrada.'}
                </span>
                <span className={styles.rowDesc}>Al desactivarlas, los avisos seguirán apareciendo en la campana.</span>
              </div>
            </div>
            <Toggle
              checked={allNotifsOn}
              onChange={handleAllNotifications}
              id="all-notifications-toggle"
              label="Todas las notificaciones"
              disabled={notifBusy || !notifPrefs || (!allNotifsOn && (!notificationsSupported() || needsIosInstall()))}
            />
          </div>

          <div className={styles.sep} />

          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <div className={clsx(styles.rowIcon, soundsOn ? styles.iconSuccess : styles.iconNeutral)}>
                {soundsOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </div>
              <div>
                <span className={styles.rowLabel}>Sonidos</span>
                <span className={styles.rowDesc}>Reproduce un sonido sutil al recibir notificaciones</span>
              </div>
            </div>
            <Toggle checked={soundsOn} onChange={handleSounds} id="sounds-toggle" />
          </div>

          <p className={styles.groupHint} role="status">{notifBusy ? 'Guardando preferencias…' : prefsError || (!notifPrefs ? 'Cargando preferencias…' : '')}</p>

          {notifHealth && (
            <>
              <div className={styles.sep} />
              <p className={styles.groupLabel}>Estado del sistema de avisos</p>
              <dl className={styles.healthList}>
                <div><dt>Pendientes de enviar</dt><dd>{notifHealth.queue?.ready ?? 0}</dd></div>
                <div><dt>A la espera de reintento</dt><dd>{notifHealth.queue?.in_flight_or_waiting ?? 0}</dd></div>
                <div><dt>Sin poder enviar</dt><dd>{notifHealth.dead_letters ?? 0}</dd></div>
                <div><dt>Dispositivos activos</dt><dd>{(notifHealth.devices?.expo_active ?? 0) + (notifHealth.devices?.web_active ?? 0)}</dd></div>
                <div><dt>Último envío procesado</dt><dd>{formatHealthTime(notifHealth.last_worker_run)}</dd></div>
                <div><dt>Última comprobación automática</dt><dd>{formatHealthTime(notifHealth.last_recovery_run)}</dd></div>
              </dl>
              {notifHealth.open_alerts?.length > 0 && (
                <p className={styles.healthAlert} role="status">
                  {notifHealth.open_alerts.length === 1 ? 'Hay 1 alerta abierta' : `Hay ${notifHealth.open_alerts.length} alertas abiertas`}: {notifHealth.open_alerts.map((a) => HEALTH_ALERT_LABELS[a.key] || a.key).join(', ')}.
                </p>
              )}
            </>
          )}
        </Card>
        </motion.div>
        </div>

        <div className={styles.col}>
        {/* Sesión y seguridad: how the session protects the account, and the way out */}
        <motion.div variants={item}>
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={clsx(styles.cardIcon, styles.iconDanger)}>
              <ShieldCheck size={17} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Sesión y seguridad</h2>
              <p className={styles.cardSub}>Cómo se protege tu cuenta en este equipo</p>
            </div>
          </div>

          <div className={styles.sessionBox}>
            <span className={styles.sessionRing} aria-hidden="true">
              <strong>1</strong>
              <small>min</small>
            </span>
            <div>
              <span className={styles.rowLabel}>Cierre automático por inactividad</span>
              <span className={styles.rowDesc}>
                Tras un minuto sin actividad la sesión se cierra sola. Quince segundos antes aparece un aviso para seguir conectado.
              </span>
            </div>
          </div>

          <div className={styles.sessionActions}>
            <button type="button" className={styles.sessionBtn} onClick={() => navigate('/profile')}>
              <KeyRound size={15} aria-hidden="true" /> Cambiar contraseña
            </button>
            <button type="button" className={clsx(styles.sessionBtn, styles.sessionDanger)} onClick={() => logout()}>
              <LogOut size={15} aria-hidden="true" /> Cerrar sesión
            </button>
          </div>
          <p className={styles.sessionNote}><Timer size={13} aria-hidden="true" /> El aviso no interrumpe lo que estés escribiendo.</p>
        </Card>
        </motion.div>

        {/* Cuenta */}
        {!touch && (
        <motion.div variants={item}>
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={clsx(styles.cardIcon, styles.iconInfo)}>
              <User size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 className={styles.cardTitle}>Tu cuenta</h2>
              <p className={styles.cardSub}>Información de tu perfil en la plataforma</p>
            </div>
            <Avatar
              initials={user?.avatar || user?.name?.slice(0, 2)}
              size={38}
              online
            />
          </div>

          <div className={styles.accountGrid}>
            <div className={styles.accountItem}>
              <span className={styles.accountLabel}>Nombre</span>
              <span className={styles.accountValue}>{user?.name || '—'}</span>
            </div>
            <div className={styles.accountItem}>
              <span className={styles.accountLabel}>Rol</span>
              <span className={clsx(styles.accountBadge, user?.role === 'admin' ? styles.badgeAdmin : styles.badgeUser)}>
                {user?.role === 'admin' ? 'Administrador' : 'Empleado'}
              </span>
            </div>
            <div className={styles.accountItem}>
              <span className={styles.accountLabel}>Departamento</span>
              <span className={styles.accountValue}>{user?.dept || '—'}</span>
            </div>
            <div className={styles.accountItem}>
              <span className={styles.accountLabel}>Modo de trabajo</span>
              <span className={clsx(styles.accountValue, styles.accountOnline)}>
                <Wifi size={12} style={{ flexShrink: 0 }} />
                {MODE_LABEL[user?.workMode] || user?.workMode || 'Oficina'}
              </span>
            </div>
          </div>

          <div className={styles.accountNote}>
            <Building size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            Para modificar tu información personal, ve a la página de <strong>Perfil</strong>.
          </div>
        </Card>
        </motion.div>
        )}
        </div>

      </motion.div>
    </div>
  );
}
