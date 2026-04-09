import { useState } from 'react';
import { useAuth } from '../context';
import { Card, Button, Input } from '../components/ui';
import { Eye, EyeOff } from 'lucide-react';
import styles from './LoginPage.module.scss';
import clsx from 'clsx';
import inputStyles from '../components/ui/Input/Input.module.scss'; // For the password input base

export default function LoginPage() {
  const { login } = useAuth();
  
  const [email, setEmail]       = useState('');
  const [pass, setPass]         = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email || !pass) { 
      setErr('Por favor, introduce email y contraseña.'); 
      return; 
    }
    setLoading(true); 
    setErr('');
    const res = await login(email, pass);
    if (!res.ok) { 
      setErr(res.msg ? `Error: ${res.msg}` : 'Email o contraseña incorrectos. Verifica tus credenciales.'); 
      setLoading(false); 
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* Logo */}
        <div className={styles.logoContainer}>
          <div className={styles.logoRow}>
            <div className={styles.logoIcon}>M</div>
            <span className={styles.logoText}>margube</span>
          </div>
          <p className={styles.subtitle}>Intranet corporativa — Acceso privado</p>
        </div>

        <Card className={styles.loginCard}>
          <h1 className={styles.welcomeTitle}>Bienvenido/a</h1>
          <p className={styles.welcomeText}>Inicia sesión con tu cuenta corporativa</p>

          <Input 
            label="Email corporativo"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="nombre@margube.com"
            required
          />

          <div className={styles.inputGroup}>
            <label className={inputStyles.label}>
              Contraseña <span className={inputStyles.asterisk}>*</span>
            </label>
            <div className={styles.passwordWrapper} style={{ marginTop: '6px' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className={clsx(inputStyles.input)}
                style={{ paddingRight: '42px' }}
              />
              <button 
                className={styles.eyeButton} 
                onClick={() => setShowPass(!showPass)}
                type="button"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {err && (
            <div className={styles.errorBox}>{err}</div>
          )}

          <Button 
            className={styles.actionButton} 
            onClick={handleLogin} 
            loading={loading}
            size="lg"
          >
            {loading ? 'Verificando...' : 'Iniciar sesión'}
          </Button>

          <p className={styles.helpText}>
            ¿Problemas de acceso? Contacta con RRHH o Administración
          </p>
        </Card>

        {/* Demo credentials — click to auto-fill */}
        <div className={styles.demoCard}>
          <p className={styles.demoTitle}>🔑 Accesos de prueba <span style={{ color: 'var(--text-mut)', fontWeight: 400 }}>(clic para rellenar)</span></p>
          <div className={styles.demoList}>
            {[
              { label: 'Admin',        email: 'carlos.ruiz@margube.com',   pass: 'Margube2024!', badge: 'admin'    },
              { label: 'RRHH',         email: 'laura.gomez@margube.com',   pass: 'Pass1234!',    badge: 'employee' },
              { label: 'Tecnología',   email: 'miguel.torres@margube.com', pass: 'Temp0001!',    badge: '1er acceso' },
              { label: 'Marketing',    email: 'ana.fernandez@margube.com', pass: 'Temp0002!',    badge: '1er acceso' },
              { label: 'Ventas',       email: 'pedro.lopez@margube.com',   pass: 'Temp0003!',    badge: 'employee' },
              { label: 'Finanzas',     email: 'elena.martin@margube.com',  pass: 'Temp0004!',    badge: 'employee' },
            ].map(u => (
              <button
                key={u.email}
                className={styles.demoRow}
                onClick={() => { setEmail(u.email); setPass(u.pass); setErr(''); }}
              >
                <div className={styles.demoRowLeft}>
                  <span className={styles.demoBadge} style={{
                    background: u.badge === 'admin' ? 'var(--accent-bg)' : u.badge === '1er acceso' ? 'var(--warning-bg)' : 'var(--success-bg)',
                    color:      u.badge === 'admin' ? 'var(--accent)'   : u.badge === '1er acceso' ? 'var(--warning)' : 'var(--success)',
                  }}>{u.label}</span>
                  <span className={styles.demoEmail}>{u.email}</span>
                </div>
                <code className={styles.demoPass}>{u.pass}</code>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
