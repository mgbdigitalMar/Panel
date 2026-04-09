import { useState } from 'react';
import { useAuth, useApp } from '../context';
import { Card, Button } from '../components/ui';
import { KeyRound, Eye, EyeOff, Bell } from 'lucide-react';
import styles from './LoginPage.module.scss';
import inputStyles from '../components/ui/Input/Input.module.scss';
import clsx from 'clsx';
import { supabase } from '../utils/supabase';
import bcrypt from 'bcryptjs';

export default function ChangePasswordPage() {
  const { user, setCurrentUser, setNeedsOnboarding } = useAuth();
  const { navigate } = useApp();

  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);

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

    // Generar el Hash desde el cliente
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPass, salt);

    // Guardar el hash modificado localmente directo en la columna de la base de datos
    const { error } = await supabase
      .from('profiles')
      .update({ password_hash: hash, first_login: false })
      .eq('id', user.id);
    
    if (error) { setErr('Error al guardar: ' + error.message); setLoading(false); return; }

    // Mark first_login = false in internal state
    await setCurrentUser({ ...user, firstLogin: false });
    setNeedsOnboarding(true);
    navigate('dashboard');
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.logoContainer} style={{ marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: 'var(--accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            color: 'var(--accent)'
          }}>
            <KeyRound size={28} />
          </div>
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
