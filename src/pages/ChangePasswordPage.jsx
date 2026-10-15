import { useState, useEffect } from 'react';
import { useAuth, useTheme } from '../context';
import { useNavigate } from 'react-router-dom';
import logoColor from '../assets/logos/logo-color.png';
import logoWhite from '../assets/logos/logo-white.png';
import { Button, AnimatedBackdrop } from '../components/ui';
import { Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, Save } from 'lucide-react';
import styles from './ChangePasswordPage.module.scss';
import { supabase } from '../utils/supabase';
// bcrypt imported dynamically on demand

export default function ChangePasswordPage() {
  const { user, setCurrentUser, setNeedsOnboarding, setLastActivity } = useAuth();
  const navigate = useNavigate();
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

  // Require user session — redirect to login if accessed directly without session
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const handleActivity = resetIdle;
    document.addEventListener('mousemove', handleActivity, { passive: true });
    document.addEventListener('keydown', handleActivity, { passive: true });
    document.addEventListener('click', handleActivity, { passive: true });
    document.addEventListener('scroll', handleActivity, { passive: true });
    return () => {
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('scroll', handleActivity);
    };
  }, [resetIdle]);

  const handleSave = async () => {
    if (!user || !user.id) {
      navigate('/login', { replace: true });
      return;
    }
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
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
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
    navigate('/dashboard');
  }, 1500);
  };

  const passField = (id, label, value, setValue, shown, setShown, autoComplete) => (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          id={id}
          className={styles.input}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={e => { setValue(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoComplete={autoComplete}
          aria-invalid={!!err}
        />
        <button
          type="button"
          className={styles.eyeButton}
          onClick={() => setShown(v => !v)}
          aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={shown}
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Same animated backdrop as the login and the app */}
      <AnimatedBackdrop />

      <main className={styles.card}>
        <img src={theme === 'dark' ? logoWhite : logoColor} alt="Margube" className={styles.logo} />

        <h1 className={styles.title}>Primer acceso</h1>
        <p className={styles.subtitle}>
          Hola <strong>{user?.name?.split(' ')[0]}</strong>, crea tu contraseña personal para entrar en la intranet.
        </p>

        <div className={styles.note}>
          <ShieldCheck size={17} aria-hidden="true" />
          <span>Por seguridad, sustituye la contraseña temporal que te dio RRHH. Usa al menos 8 caracteres.</span>
        </div>

        {passField('new-password', 'Nueva contraseña', newPass, setNewPass, showNew, setShowNew, 'new-password')}
        {passField('confirm-password', 'Repite la contraseña', confirm, setConfirm, showConf, setShowConf, 'new-password')}

        {err && (
          <div className={styles.error} role="alert">
            <AlertCircle size={16} aria-hidden="true" /> {err}
          </div>
        )}
        {success && (
          <div className={styles.success} role="status">
            <CheckCircle2 size={16} aria-hidden="true" /> {success}
          </div>
        )}

        <Button className={styles.submit} icon={Save} onClick={handleSave} loading={loading} size="lg">
          {loading ? 'Guardando…' : 'Guardar contraseña y entrar'}
        </Button>
      </main>
    </div>
  );
}
