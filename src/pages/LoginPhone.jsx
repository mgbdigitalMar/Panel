import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, AlertCircle, X } from 'lucide-react';
import logoIcon from '../assets/logos/logo-icon.png';
import { Wallpaper } from '../components/Wallpaper';
import styles from './LoginPhone.module.scss';

const HELP_MAIL = 'mailto:rrhh@margube.com?subject=Acceso%20a%20la%20intranet';
export const REMEMBER_KEY = 'margube_last_email';

// The "M" of Margube drawn in an 11 × 9 grid of tiles (two legs and a V), same as the app
const TILES = Array.from({ length: 99 }, (_, i) => {
  const r = Math.floor(i / 11);
  const c = i % 11;
  const on = c <= 1 || c >= 9 || (r <= 4 && (c === r || c === r + 1 || c === 10 - r || c === 9 - r)) || (r === 5 && c === 5);
  const delay = on ? (r + c) * 0.09 : ((r * 7 + c * 13) % 23) * 0.31;
  return { on, delay: `${delay.toFixed(2)}s` };
});

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

/** Email saved by "Recordarme" (empty in private mode or when it was unticked). */
export const readRemembered = () => {
  try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
};

/**
 * Login on phones and small tablets: the Margube monogram over the web's wallpaper and the form
 * on a floating liquid glass card (the app's login). The parent owns the credentials and the sign-in.
 */
export default function LoginPhone({ email, setEmail, pass, setPass, err, errKey, loading, onSubmit, idleText }) {
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);
  const [remember, setRemember] = useState(true);

  const submit = (e) => {
    e?.preventDefault();
    try {
      if (remember && email.trim()) localStorage.setItem(REMEMBER_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch { /* private mode: nothing to remember */ }
    onSubmit(e);
  };

  return (
    <div className={`${styles.page} glass-scope`}>
      {/* The same backdrop as the rest of the web, so the liquid glass reads the same */}
      <Wallpaper />
      <div className={styles.hero}>
        <span className={styles.glow} aria-hidden="true" />
        <div className={`${styles.brand} ${styles.rise}`}>
          <img src={logoIcon} alt="" className={styles.brandLogo} />
          <span className={styles.brandName}>Margube</span>
          <span className={styles.brandTag}>Intranet</span>
        </div>
        <div className={`${styles.monogram} ${styles.rise}`} style={{ animationDelay: '.25s' }} aria-hidden="true">
          <div className={styles.grid}>
            {TILES.map((t, i) => (
              <span key={i} className={t.on ? styles.tileOn : styles.tileOff} style={{ animationDelay: t.delay }} />
            ))}
          </div>
          <span className={styles.scan} />
        </div>
      </div>

      <section className={styles.sheet} aria-label="Iniciar sesión">
        <div className={styles.grab} aria-hidden="true" />
        <motion.div
          key={errKey}
          className={styles.body}
          animate={err ? { x: [0, -8, 8, -8, 8, -4, 4, 0] } : undefined}
          transition={{ duration: 0.45 }}
        >
          <div className={`${styles.intro} ${styles.rise}`} style={{ animationDelay: '.5s' }}>
            <span className={styles.hello}><span className={styles.pulse} />{greeting()}</span>
            <h1 className={styles.title}>
              Inicia{' '}
              <span className={styles.titleMark}>
                sesión
                <svg className={styles.squig} viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M3 13 C 40 4, 70 18, 105 9 S 170 4, 197 11" />
                </svg>
              </span>
            </h1>
          </div>

          <form className={`${styles.form} ${styles.rise}`} style={{ animationDelay: '.6s' }} onSubmit={submit} noValidate>
            <div className={styles.field}>
              <span className={styles.fieldIcon} aria-hidden="true"><Mail size={19} strokeWidth={1.9} /></span>
              <input
                id="m-login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!err}
              />
              <label htmlFor="m-login-email">Correo corporativo</label>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldIcon} aria-hidden="true"><Lock size={19} strokeWidth={1.9} /></span>
              <input
                id="m-login-password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder=" "
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                aria-invalid={!!err}
              />
              <label htmlFor="m-login-password">Contraseña</label>
              <button type="button" className={styles.eye} onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={show}>
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {err && (
              <p className={styles.error} role="alert">
                <AlertCircle size={17} aria-hidden="true" /><span>{err}</span>
              </p>
            )}

            <div className={styles.row}>
              <label className={styles.check}>
                <input type="checkbox" checked={remember} onChange={() => setRemember((r) => !r)} />
                <span className={styles.box} aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 22 22" fill="none"><path d="M5 11.5l4 4 8-9" /></svg>
                </span>
                Recordarme
              </label>
              <button type="button" className={styles.forgot} onClick={() => setHelp(true)} aria-controls="login-help" aria-expanded={help}>
                ¿Olvidaste la contraseña?
              </button>
            </div>

            <AnimatePresence initial={false}>
              {help && (
                <motion.div
                  id="login-help"
                  className={styles.help}
                  role="region"
                  aria-label="Ayuda para acceder"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
                >
                  <div className={styles.helpHead}>
                    <strong>¿Primer acceso o contraseña olvidada?</strong>
                    <button type="button" onClick={() => setHelp(false)} aria-label="Cerrar ayuda"><X size={16} /></button>
                  </div>
                  <p>RRHH te facilita una contraseña temporal. Al entrar por primera vez te pedirá crear una propia. Si la has olvidado, escribe a RRHH para que te la restablezcan.</p>
                  <a href={HELP_MAIL}><Mail size={15} aria-hidden="true" /> Escribir a rrhh@margube.com</a>
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" className={styles.go} disabled={loading} aria-busy={loading}>
              {loading && <span className={styles.spin} aria-hidden="true" />}
              <span>{loading ? 'Verificando…' : 'Entrar'}</span>
            </button>

            <p className={styles.note}>{idleText}</p>
          </form>
        </motion.div>
      </section>
    </div>
  );
}
