import { useState, useCallback, useEffect } from 'react';
import { useAuth, useTheme } from '../context';
import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';
import {
  Eye, EyeOff, AlertCircle, LogIn, Lock, Loader2, Sun, Moon, Info, X, Mail,
  CalendarDays, Car, DoorOpen, Home, Users, FileText,
} from 'lucide-react';
import styles from './LoginPage.module.scss';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { LEAF_PATH, VEIN_PATH } from '../components/ui/Loader/Loader';
import { AnimatedBackdrop } from '../components/ui';

const EASE = [0.22, 1, 0.36, 1];
const DRAW_EASE = [0.65, 0, 0.35, 1];

const WEEK = [
  { d: 'L', v: 0.62 },
  { d: 'M', v: 0.48 },
  { d: 'X', v: 0.84 },
  { d: 'J', v: 0.70 },
  { d: 'V', v: 0.92, active: true },
  { d: 'S', v: 0.22 },
  { d: 'D', v: 0.12 },
];

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.25 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** True below the split layout's breakpoint: phones get the app's login instead of the framed split. */
function useNarrow(query = '(max-width: 959px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

const HELP_MAIL = 'mailto:rrhh@margube.com?subject=Acceso%20a%20la%20intranet';

/** The app's brand orb: blue sphere with the leaf, a halo, two radar ripples and a slow float. */
function BrandOrb() {
  return (
    <div className={styles.mOrb} aria-hidden="true">
      <span className={styles.mOrbHalo} />
      <span className={styles.mOrbRipple} />
      <span className={`${styles.mOrbRipple} ${styles.mOrbRippleLate}`} />
      <span className={styles.mOrbSphere}>
        <svg viewBox="0 0 48 48" width="62" height="62">
          <path d={LEAF_PATH} fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />
          <path d={VEIN_PATH} fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}

function LeafGlyph({ size = 18 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d={LEAF_PATH} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <path d={VEIN_PATH} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, setMode } = useTheme();

  const [email,    setEmail]    = useState('');
  const [pass,     setPass]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err,      setErr]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errKey,   setErrKey]   = useState(0);

  const handleLogin = useCallback(async (e) => {
    e?.preventDefault();
    if (loading) return;
    if (!email || !pass) {
      setErr('Por favor, introduce email y contraseña.');
      setErrKey(k => k + 1);
      return;
    }
    setLoading(true);
    setErr('');
    const res = await login(email, pass);
    if (!res.ok) {
      setErr(res.msg ? `Error: ${res.msg}` : 'Email o contraseña incorrectos.');
      setErrKey(k => k + 1);
      setLoading(false);
    }
  }, [email, pass, login, loading]);

  const isDark = theme === 'dark';
  const narrow = useNarrow();
  const [help, setHelp] = useState(false);

  if (narrow) {
    return (
      <MotionConfig reducedMotion="user">
        <div className={styles.mPage}>
          <AnimatedBackdrop />
          <motion.div className={styles.mColumn} variants={stagger} initial="hidden" animate="show">
            <motion.div variants={fadeUp} className={styles.mTop}>
                <button
                  type="button"
                  className={styles.mIconBtn}
                  onClick={() => setMode(isDark ? 'light' : 'dark')}
                  aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                >
                  {isDark ? <Sun size={21} /> : <Moon size={21} />}
                </button>
                <button
                  type="button"
                  className={styles.mIconBtn}
                  onClick={() => setHelp(h => !h)}
                  aria-label="Ayuda para acceder"
                  aria-expanded={help}
                  aria-controls="login-help"
                >
                  <Info size={21} />
                </button>
            </motion.div>

            {/* Orb, title and form centred in the space between the top bar and the footer */}
            <div className={styles.mCenter}>
              <motion.div variants={fadeUp}><BrandOrb /></motion.div>

              <motion.div variants={fadeUp} className={styles.mIntro}>
                <h1 className={styles.mTitle}>Te damos la bienvenida</h1>
                <p className={styles.mSub}>Inicia sesión para acceder a tus reservas, solicitudes y novedades de Margube.</p>
              </motion.div>

              <AnimatePresence initial={false}>
                {help && (
                  <motion.div
                    id="login-help"
                    className={styles.mHelp}
                    role="region"
                    aria-label="Ayuda para acceder"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
                  >
                    <div className={styles.mHelpHead}>
                      <strong>¿Primer acceso o contraseña olvidada?</strong>
                      <button type="button" className={styles.mHelpClose} onClick={() => setHelp(false)} aria-label="Cerrar ayuda">
                        <X size={16} />
                      </button>
                    </div>
                    <p>RRHH te facilita una contraseña temporal. Al entrar por primera vez te pedirá crear una propia.</p>
                    <p>Si la has olvidado, escribe a rrhh@margube.com para que te la restablezcan.</p>
                    <a className={styles.mHelpLink} href={HELP_MAIL}><Mail size={16} /> Escribir a RRHH</a>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.form variants={fadeUp} className={styles.mCard} onSubmit={handleLogin} noValidate>
                <div className={styles.mField}>
                  <label htmlFor="m-login-email" className={styles.mLabel}>Correo electrónico <span aria-hidden="true">*</span></label>
                  <input
                    id="m-login-email"
                    className={styles.mInput}
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nombre@margube.es"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    aria-invalid={!!err}
                  />
                </div>

                <div className={styles.mField}>
                  <label htmlFor="m-login-password" className={styles.mLabel}>Contraseña <span aria-hidden="true">*</span></label>
                  <div className={styles.mInputWrap}>
                    <input
                      id="m-login-password"
                      className={`${styles.mInput} ${styles.mInputIcon}`}
                      type={showPass ? 'text' : 'password'}
                      value={pass}
                      onChange={e => setPass(e.target.value)}
                      placeholder="Tu contraseña"
                      autoComplete="current-password"
                      required
                      aria-invalid={!!err}
                    />
                    <button
                      type="button"
                      className={styles.mEye}
                      onClick={() => setShowPass(v => !v)}
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={showPass}
                    >
                      {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <button type="button" className={styles.mForgot} onClick={() => setHelp(true)} aria-controls="login-help">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {err && (
                    <motion.div
                      key={errKey}
                      className={styles.mError}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0, x: [0, -7, 6, -4, 2, 0], transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] } }}
                      exit={{ opacity: 0, y: -4, transition: { duration: 0.14 } }}
                      role="alert"
                    >
                      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{err}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button type="submit" className={styles.mSubmit} disabled={loading} aria-busy={loading} whileTap={{ scale: 0.97 }}>
                  {loading ? <Loader2 size={19} className={styles.spin} /> : <LogIn size={19} />}
                  {loading ? 'Verificando…' : 'Iniciar sesión'}
                </motion.button>
              </motion.form>
            </div>

            <motion.footer variants={fadeUp} className={styles.mFooter}>
              <button type="button" onClick={() => setHelp(true)} aria-controls="login-help">
                ¿Primer acceso? <strong>Contacta con RRHH</strong>
              </button>
            </motion.footer>
          </motion.div>
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.page}>
        {/* Same backdrop as the app shell */}
        <AnimatedBackdrop />
        <div className={styles.loginGlow} aria-hidden="true" />

        <motion.div
          className={styles.frame}
          initial={{ opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className={styles.brandPanel} aria-hidden="true">
            <motion.p
              className={styles.brandTagline}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              La intranet de Margube — reservas, solicitudes y equipo en un solo lugar.
            </motion.p>

            {/* Hairline rings behind the headline */}
            <svg className={styles.rings} viewBox="0 0 400 400">
              <motion.circle
                cx="200" cy="200" r="198"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ pathLength: { duration: 2, ease: DRAW_EASE, delay: 0.3 }, opacity: { duration: 0.3, delay: 0.3 } }}
              />
              <motion.circle
                cx="200" cy="200" r="138"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ pathLength: { duration: 1.7, ease: DRAW_EASE, delay: 0.5 }, opacity: { duration: 0.3, delay: 0.5 } }}
              />
            </svg>

            <motion.h2
              className={styles.brandHeadline}
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              <motion.span variants={fadeUp}>Tu espacio</motion.span>
              <motion.span variants={fadeUp}>de trabajo</motion.span>
            </motion.h2>

            {/* Phone mock — rises in from the bottom edge */}
            <motion.div
              className={styles.phone}
              initial={{ opacity: 0, y: 80, rotate: -4 }}
              animate={{ opacity: 1, y: 0, rotate: -8 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.45 }}
            >
              <div className={styles.phoneScreen}>
                <span className={styles.phoneIsland} />

                <div className={styles.phoneCard}>
                  <div className={styles.phoneCardHead}>
                    <span>Esta semana</span>
                    <CalendarDays size={11} />
                  </div>
                  <div className={styles.phoneStat}>
                    24<small>reservas</small>
                  </div>
                  <div className={styles.phoneBars}>
                    {WEEK.map(({ d, v, active }, i) => (
                      <div key={d} className={styles.phoneBarCol}>
                        <div className={styles.phoneBarTrack}>
                          <motion.span
                            className={active ? styles.phoneBarActive : styles.phoneBarFill}
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: v }}
                            transition={{ duration: 0.7, ease: EASE, delay: 1 + i * 0.05 }}
                          />
                        </div>
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.phoneSection}>Recursos</div>
                <div className={styles.phoneTiles}>
                  <div className={styles.phoneTile}>
                    <DoorOpen size={12} />
                    <b>3</b>
                    <span>Salas</span>
                  </div>
                  <div className={`${styles.phoneTile} ${styles.phoneTileTall}`}>
                    <Car size={12} />
                    <b>2</b>
                    <span>Vehículos</span>
                  </div>
                  <div className={styles.phoneTile}>
                    <FileText size={12} />
                    <b>5</b>
                    <span>Solicitudes</span>
                  </div>
                </div>

                <div className={styles.phoneNav}>
                  <Home size={13} />
                  <CalendarDays size={13} />
                  <span className={styles.phoneNavMark}><LeafGlyph size={13} /></span>
                  <Users size={13} />
                  <FileText size={13} />
                </div>
              </div>
            </motion.div>

            <span className={styles.brandBadge}><LeafGlyph size={14} /></span>
          </div>

          <motion.main
            className={styles.formPanel}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
          >
            <header className={styles.formTop}>
              <img
                src={isDark ? logoWhite : logoColor}
                alt="Margube"
                className={styles.logo}
              />
              <span className={styles.privateBadge}>
                <Lock size={13} />
                Acceso privado
              </span>
            </header>

            <motion.form
              className={styles.form}
              onSubmit={handleLogin}
              noValidate
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              <motion.h1 variants={fadeUp} className={styles.heading}>
                Iniciar sesión
              </motion.h1>
              <motion.p variants={fadeUp} className={styles.subheading}>
                Accede con tu cuenta corporativa de Margube
              </motion.p>

              <motion.div variants={fadeUp} className={styles.field}>
                <label htmlFor="login-email" className={styles.srOnly}>Correo corporativo</label>
                <input
                  id="login-email"
                  className={styles.input}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Correo corporativo"
                  autoComplete="email"
                  autoFocus
                  required
                  aria-invalid={!!err}
                />
              </motion.div>

              <motion.div variants={fadeUp} className={styles.field}>
                <label htmlFor="login-password" className={styles.srOnly}>Contraseña</label>
                <input
                  id="login-password"
                  className={`${styles.input} ${styles.inputWithIcon}`}
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  required
                  aria-invalid={!!err}
                />
                <button
                  className={styles.eyeButton}
                  onClick={() => setShowPass(s => !s)}
                  type="button"
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPass}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </motion.div>

              <motion.p variants={fadeUp} className={styles.helpLink}>
                ¿Problemas de acceso? Contacta con RRHH
              </motion.p>

              <AnimatePresence mode="wait">
                {err && (
                  <motion.div
                    key={errKey}
                    className={styles.errorBox}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0, x: [0, -7, 6, -4, 2, 0], transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] } }}
                    exit={{ opacity: 0, y: -4, transition: { duration: 0.14 } }}
                    role="alert"
                  >
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{err}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                variants={fadeUp}
                type="submit"
                className={styles.submit}
                disabled={loading}
                aria-busy={loading}
                whileTap={{ scale: 0.98 }}
              >
                {loading
                  ? <Loader2 size={17} className={styles.spin} />
                  : <LogIn size={17} />}
                {loading ? 'Verificando…' : 'Iniciar sesión'}
              </motion.button>
            </motion.form>

            <footer className={styles.formFooter}>
              <span>© {new Date().getFullYear()} Margube · Uso interno exclusivo</span>
              <button
                type="button"
                className={styles.themeButton}
                onClick={() => setMode(isDark ? 'light' : 'dark')}
                aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
                {isDark ? 'Claro' : 'Oscuro'}
              </button>
            </footer>
          </motion.main>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
