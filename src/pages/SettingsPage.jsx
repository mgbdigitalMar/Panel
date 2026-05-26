import { useState, useEffect, useCallback } from 'react';
import { useTheme, useData, useAuth, applyAccentCSS } from '../context';
import { Card } from '../components/ui';
import {
  Sun, Moon, Monitor, Layers, BellRing, BellOff, Volume2, VolumeX,
  Palette, Check, User, Building,
} from 'lucide-react';
import styles from './SettingsPage.module.scss';
import clsx from 'clsx';

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

// ── Accent presets ────────────────────────────────────────────────────
const ACCENT_PRESETS = [
  { name: 'Azul Margube', value: '#2251ff', rgb: '34, 81, 255' },
  { name: 'Índigo',       value: '#6366f1', rgb: '99, 102, 241' },
  { name: 'Violeta',      value: '#8b5cf6', rgb: '139, 92, 246' },
  { name: 'Rosa',         value: '#ec4899', rgb: '236, 72, 153' },
  { name: 'Ámbar',        value: '#f59e0b', rgb: '245, 158, 11' },
  { name: 'Esmeralda',    value: '#10b981', rgb: '16, 185, 129' },
  { name: 'Cian',         value: '#06b6d4', rgb: '6, 182, 212' },
  { name: 'Coral',        value: '#ef4444', rgb: '239, 68, 68' },
];

// ── Main Page ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { user } = useAuth();

  // ── Accent color ──────────────────────────────────────────────────
  const [accent, setAccent] = useState(() => getLS(`margube-accent-val-${user?.id}`, '#2251ff'));

  const handleAccent = useCallback((value, rgb) => {
    setAccent(value);
    setLS(`margube-accent-val-${user?.id}`, value);
    setLS(`margube-accent-rgb-${user?.id}`, rgb);
    applyAccentCSS(value, rgb);
  }, [user]);

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
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1>Ajustes</h1>
        <p>Personaliza tu experiencia en la plataforma</p>
      </div>

      <div className={styles.stack}>

        {/* ── APARIENCIA ── */}
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

          <div className={styles.sep} />

          {/* Color de acento */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Color de acento</label>
            <p className={styles.fieldDesc}>Color principal de botones, enlaces y elementos activos</p>
            <div className={styles.accentRow}>
              {ACCENT_PRESETS.map(({ name, value, rgb }) => (
                <button
                  key={value}
                  title={name}
                  onClick={() => handleAccent(value, rgb)}
                  className={clsx(styles.accentDot, { [styles.accentDotActive]: accent === value })}
                  style={{ background: value }}
                  aria-label={name}
                >
                  {accent === value && <Check size={11} color="#fff" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* ── NOTIFICACIONES ── */}
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

        {/* ── CUENTA ── */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={clsx(styles.cardIcon, styles.iconInfo)}>
              <User size={17} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Tu cuenta</h2>
              <p className={styles.cardSub}>Información de tu perfil en la plataforma</p>
            </div>
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
              <span className={styles.accountValue}>{user?.workMode || 'Oficina'}</span>
            </div>
          </div>

          <div className={styles.accountNote}>
            <Building size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            Para modificar tu información personal, ve a la página de <strong>Perfil</strong>.
          </div>
        </Card>

      </div>
    </div>
  );
}
