import { useState, useEffect } from 'react';
import { useAuth, useApp, useTheme } from '../context';
import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';
import { Card, Button } from '../components/ui';
import { KeyRound, Eye, EyeOff, Bell } from 'lucide-react';
import styles from './LoginPage.module.scss';
import inputStyles from '../components/ui/Input/Input.module.scss';
import clsx from 'clsx';
import { supabase } from '../utils/supabase';
import bcrypt from 'bcryptjs';

export default function ChangePasswordPage() {
  const { user, setCurrentUser, setNeedsOnboarding, setLastActivity } = useAuth();
  const { navigate } = useApp();
  const { theme } = useTheme();

  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [err, setErr]           = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);

  // Reset idle timer on activity (prevents logout during password change)
  const resetIdle = () => setLastActivity(Date.now());

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

  const handleSave = async () => {
    if (!newPass || newPass.length < 8) { 
      setErr('La contraseña debe tener al menos 8 caracteres.'); 
      return; 
    }
    if (newPass !== confirm) { 
      setErr('Las contraseñas no coinciden.'); 
      return; 
    }
    setLoading(true);

    // Hasheamos la contraseña en el frontend con bcrypt (el trigger de Postgres fue eliminado).
    // saltRounds=10 → hash $2a$10$... compatible con bcrypt.compareSync en login.
    console.log('Hasheando contraseña con bcrypt (frontend)...');
    const hashedPassword = await bcrypt.hash(newPass, 10);

    // Update DB con el hash bcrypt
    const { error } = await supabase
      .from('profiles')
      .update({ password_hash: hashedPassword, first_login: false })
      .eq('id', user.id);
  
  if (error) { 
    console.error('DB update error:', error);
    setErr('Error al guardar: ' + error.message); 
    setLoading(false); 
    return; 
  }

  // Verify update persisted
  const { data: updated } = await supabase
    .from('profiles')
    .select('password_hash, first_login')
    .eq('id', user.id)
    .single();
  
  if (!updated || !updated.password_hash || updated.first_login !== false) {
    console.error('Verify failed:', updated);
    setErr('Error: Actualización no se guardó correctamente en DB.');
    setLoading(false);
    return;
  }

  console.log('✅ Password updated & verified');

  // Update local state and navigate directly
  await setCurrentUser({ ...user, firstLogin: false });
  setSuccess('¡Contraseña guardada exitosamente! Iniciando sesión...');
  setTimeout(() => {
    setLoading(false);
    navigate('dashboard');
  }, 1500);
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.logoContainer} style={{ marginBottom: 32 }}>
<img src={theme === 'dark' ? logoWhite : logoColor} alt="Margube" style={{ width: '200px', height: 'auto', margin: '0 auto 24px', display: 'block' }} />
          <h1 className={styles.welcomeTitle} style={{ fontSize: 24, marginBottom: 8 }}>
            Primer acceso
          </h1>
          <p className={styles.subtitle}>
            Hola <strong>{user?.name}</strong>, establece tu contraseña personal.
          </p>
        </div>

        <Card className={styles.loginCard}>
          <div style={{
            background: 'var(--warning-bg)', border: '1px solid var(--warning)',
            borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 20,
            color: 'var(--warning)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <Bell size={16} />
            Por seguridad, cambia la contraseña temporal por una personal.
          </div>

          {/* New password */}
          <div className={styles.inputGroup}>
            <label className={inputStyles.label}>
              Nueva contraseña <span className={inputStyles.asterisk}>*</span>
            </label>
            <div className={styles.passwordWrapper} style={{ marginTop: '6px' }}>
              <input 
                type={showNew ? 'text' : 'password'} 
                value={newPass} 
                onChange={e => setNewPass(e.target.value)} 
                className={clsx(inputStyles.input)}
                style={{ paddingRight: '42px' }}
              />
              <button onClick={() => setShowNew(!showNew)} className={styles.eyeButton} type="button">
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className={styles.inputGroup}>
            <label className={inputStyles.label}>
              Confirmar contraseña <span className={inputStyles.asterisk}>*</span>
            </label>
            <div className={styles.passwordWrapper} style={{ marginTop: '6px' }}>
              <input 
                type={showConf ? 'text' : 'password'} 
                value={confirm} 
                onChange={e => setConfirm(e.target.value)}
                className={clsx(inputStyles.input)}
                style={{ paddingRight: '42px' }}
              />
              <button onClick={() => setShowConf(!showConf)} className={styles.eyeButton} type="button">
                {showConf ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {err && (
            <div className={styles.errorBox}>
              {err}
            </div>
          )}

          {success && (
            <div style={{
              background: 'var(--success-bg, rgba(16, 185, 129, 0.1))',
              border: '1px solid var(--success, #10b981)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              marginBottom: 20,
              color: 'var(--success, #10b981)',
              fontSize: 13,
              textAlign: 'center'
            }}>
              {success}
            </div>
          )}

          <Button 
            className={styles.actionButton} 
            onClick={handleSave} 
            loading={loading}
            size="lg"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña y entrar'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
