import { useState, useEffect, useCallback } from 'react';
import { useTheme, useAuth } from '../context';
import { Card, Avatar } from '../components/ui';
import {
  Sun, Moon, Monitor, Layers, BellRing, BellOff, Volume2, VolumeX,
  Palette, Check, User, Building, Wifi,
} from 'lucide-react';
import styles from './SettingsPage.module.scss';
import clsx from 'clsx';
import { motion } from 'framer-motion';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

// ── localStorage helpers ──────────────────────────────────────────────
function getLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function setLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── Toggle ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, id }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(styles.toggle, { [styles.toggleOn]: checked })}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { user } = useAuth();

  // ── Browser notifications ─────────────────────────────────────────
  const [browserNotifs, setBrowserNotifs] = useState(() => getLS('margube-browser-notifs', false));
  const [notifPerm, setNotifPerm] = useState('default');
  useEffect(() => {
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission);
  }, []);

  const handleBrowserNotifs = async (val) => {
    if (val && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm !== 'granted') { setBrowserNotifs(false); setLS('margube-browser-notifs', false); return; }
    }
    setBrowserNotifs(val);
    setLS('margube-browser-notifs', val);
  };

  // ── Sounds ────────────────────────────────────────────────────────
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

  const THEME_OPTIONS = [
    { id: 'light',  label: 'Claro',   icon: Sun,     desc: 'Interfaz luminosa' },
    { id: 'dark',   label: 'Oscuro',  icon: Moon,    desc: 'Interfaz oscura' },
    { id: 'system', label: 'Sistema', icon: Monitor, desc: 'Sigue al SO' },
  ];

  return (
    <div className={styles.page}>
      <motion.div className={styles.stack} variants={container} initial="hidden" animate="show">

        {/* ── APARIENCIA ── */}
        <motion.div variants={item}>
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={clsx(styles.cardIcon, styles.iconAccent)}>
              <Palette size={17} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Apariencia</h2>
              <p className={styles.cardSub}>Tema visual, colores y densidad</p>
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

        {/* ── NOTIFICACIONES ── */}
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
              <div className={clsx(styles.rowIcon, browserNotifs && notifPerm === 'granted' ? styles.iconSuccess : styles.iconNeutral)}>
                {browserNotifs && notifPerm === 'granted' ? <BellRing size={15} /> : <BellOff size={15} />}
              </div>
              <div>
                <span className={styles.rowLabel}>Alertas de escritorio</span>
                <span className={styles.rowDesc}>
                  {notifPerm === 'denied'
                    ? 'Bloqueadas por el navegador — actívalas en ajustes del navegador'
                    : 'Recibe notificaciones push cuando la app esté en segundo plano'}
                </span>
              </div>
            </div>
            <Toggle
              checked={browserNotifs && notifPerm === 'granted'}
              onChange={handleBrowserNotifs}
              id="notifs-toggle"
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
        </Card>
        </motion.div>

        {/* ── CUENTA ── */}
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
            {/* Avatar in header */}
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
                {user?.workMode || 'Oficina'}
              </span>
            </div>
          </div>

          <div className={styles.accountNote}>
            <Building size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            Para modificar tu información personal, ve a la página de <strong>Perfil</strong>.
          </div>
        </Card>
        </motion.div>

      </motion.div>
    </div>
  );
}
