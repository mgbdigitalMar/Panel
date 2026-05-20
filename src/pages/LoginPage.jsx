import { useState } from 'react';
import { useAuth, useTheme } from '../context';
import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';
import { Card, Button, Input } from '../components/ui';
import { Eye, EyeOff, Shield, Users, Zap, Calendar } from 'lucide-react';
import styles from './LoginPage.module.scss';
import clsx from 'clsx';
import inputStyles from '../components/ui/Input/Input.module.scss';
import { motion } from 'framer-motion';

/* ── Brand features list ──────────────────────────────────────────── */
const FEATURES = [
  { icon: Calendar, text: 'Gestión de reservas de salas y vehículos' },
  { icon: Users,    text: 'Directorio completo del equipo Margube'   },
  { icon: Shield,   text: 'Acceso seguro y privado para empleados'   },
  { icon: Zap,      text: 'Solicitudes y novedades en tiempo real'   },
];

/* ── Animation variants ───────────────────────────────────────────── */
const panelVariants = {
  hidden: { opacity: 0, x: 30 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export default function LoginPage() {
  const { login } = useAuth();
  const { theme } = useTheme();

  const [email,    setEmail]    = useState('');
  const [pass,     setPass]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err,      setErr]      = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email || !pass) {
      setErr('Por favor, introduce email y contraseña.');
      return;
    }
    setLoading(true);
    setErr('');
    const res = await login(email, pass);
    if (!res.ok) {
      setErr(res.msg ? `Error: ${res.msg}` : 'Email o contraseña incorrectos.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>

      {/* ── Left: Branding panel (desktop only) ─────────────────── */}
      <motion.div
        className={styles.brandPanel}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        {/* Brand logo */}
        <div className={styles.brandTop}>
          <div className={styles.brandLogo}>
            <img src={logoColor} alt="Margube" />
          </div>
        </div>

        {/* Headline + features */}
        <motion.div
          className={styles.brandMid}
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.h2 variants={fadeUp} className={styles.brandHeadline}>
            Tu espacio de trabajo,<br />todo en un lugar
          </motion.h2>
          <motion.p variants={fadeUp} className={styles.brandDesc}>
            La intranet corporativa de Margube. Gestiona reservas, solicitudes,
            equipo y mucho más de forma simple y eficiente.
          </motion.p>
          <motion.div variants={fadeUp} className={styles.brandFeatures}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className={styles.brandFeature}>
                <div className={styles.brandFeatureDot} />
                <span>{text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Bottom copyright */}
        <div className={styles.brandBottom}>
          © {new Date().getFullYear()} Margube · Uso interno exclusivo
        </div>
      </motion.div>

      {/* ── Right: Form panel ────────────────────────────────────── */}
      <motion.div
        className={styles.formPanel}
        variants={panelVariants}
        initial="hidden"
        animate="show"
        role="main"
      >
        <div className={styles.wrapper}>
          {/* Mobile logo */}
          <div className={styles.logoContainer}>
            <img
              src={theme === 'dark' ? logoWhite : logoColor}
              alt="Margube"
              className={styles.logoImg}
            />
            <p className={styles.subtitle}>Intranet corporativa — Acceso privado</p>
          </div>

          {/* Form heading */}
          <motion.h1
            className={styles.formHeading}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            Bienvenido/a
          </motion.h1>
          <motion.p
            className={styles.formSubtext}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            Inicia sesión con tu cuenta corporativa
          </motion.p>

          {/* On mobile, wrap in a card for visual grouping */}
          <Card className={styles.loginCard}>
            {/* Email */}
            <Input
              label="Correo corporativo"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="nombre@margube.com"
              required
              autoComplete="email"
              id="login-email"
            />

            {/* Password */}
            <div className={styles.inputGroup}>
              <label className={inputStyles.label} htmlFor="login-password">
                Contraseña <span className={inputStyles.asterisk}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className={clsx(inputStyles.input)}
                  style={{ paddingRight: '52px' }}
                  autoComplete="current-password"
                />
                <button
                  className={styles.eyeButton}
                  onClick={() => setShowPass(!showPass)}
                  type="button"
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {err && (
              <motion.div
                className={styles.errorBox}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                role="alert"
              >
                {err}
              </motion.div>
            )}

            {/* Submit */}
            <Button
              className={styles.actionButton}
              onClick={handleLogin}
              loading={loading}
              size="lg"
              aria-label="Iniciar sesión"
            >
              {loading ? 'Verificando...' : 'Iniciar sesión'}
            </Button>

            <p className={styles.helpText}>
              ¿Problemas de acceso? Contacta con RRHH o Administración
            </p>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
