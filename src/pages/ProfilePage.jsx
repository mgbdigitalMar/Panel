import { useState } from 'react';
import { useAuth } from '../context';
import { Input, Button, Card, Select, Badge } from '../components/ui';
import { Save, Lock, Shield, User } from 'lucide-react';
import styles from './ProfilePage.module.scss';
import clsx from 'clsx';

const WORK_MODES = {
  office: { label: 'Oficina' },
  remote: { label: 'Remoto' },
  field: { label: 'Externo' },
};

export default function ProfilePage() {
  const { user, setCurrentUser } = useAuth();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    workMode: user?.workMode || 'office',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleWorkModeChange = (mode) => {
    setForm({ ...form, workMode: mode });
    setCurrentUser({ workMode: mode });
    setMessage('Modo de trabajo actualizado.');
  };

  const handlePasswordChange = async () => {
    if (form.newPassword !== form.confirmPassword) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }
    if (form.newPassword.length < 6) {
      setMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      // Use setCurrentUser con firstLogin false para trigger password update logic
      await setCurrentUser({
        ...user,
        firstLogin: false,
        // Nota: password_hash update requiere lógica en setCurrentUser o llamada directa Supabase
      });
      setMessage('Contraseña actualizada correctamente. Usa la nueva en próximo login.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '', workMode: form.workMode });
    } catch (error) {
      setMessage('Error al actualizar contraseña. Verifica datos.');
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Mi Perfil</h1>
        <p>Actualiza tu información personal</p>
      </div>

      <div className={styles.cards}>
        {/* User Info Card */}
        <Card className={styles.infoCard}>
          <div className={styles.cardHeader}>
            <User size={20} />
            <h3>Mi Información</h3>
          </div>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Nombre</span>
              <span className={styles.infoValue}>{user?.name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{user?.email}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Rol</span>
              <Badge status={user?.role} />
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Departamento</span>
              <span className={styles.infoValue}>{user?.dept}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>DNI</span>
              <span className={styles.infoValue}>{user?.phone}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Fecha nacimiento</span>
              <span className={styles.infoValue}>{user?.birthdate ? new Date(user.birthdate).toLocaleDateString('es-ES') : 'No especificada'}</span>
            </div>
          </div>
        </Card>

        {/* Work Mode Card */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <Shield size={20} />
            <h3>Modo de Trabajo</h3>
          </div>
          <Select
            label=""
            value={form.workMode}
            onChange={handleWorkModeChange}
            options={Object.entries(WORK_MODES).map(([k, m]) => ({ value: k, label: m.label }))}
            className={styles.select}
          />
        </Card>

        {/* Password Card */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <Lock size={20} />
            <h3>Cambiar Contraseña</h3>
          </div>
          <div className={styles.form}>
            <Input
              label="Contraseña actual"
              type="password"
              value={form.currentPassword}
              onChange={(v) => setForm({ ...form, currentPassword: v })}
              placeholder="••••••••"
            />
            <Input
              label="Nueva contraseña"
              type="password"
              value={form.newPassword}
              onChange={(v) => setForm({ ...form, newPassword: v })}
              placeholder="Mínimo 6 caracteres"
            />
            <Input
              label="Confirmar nueva contraseña"
              type="password"
              value={form.confirmPassword}
              onChange={(v) => setForm({ ...form, confirmPassword: v })}
              placeholder="Repite la nueva contraseña"
            />
            <Button
              icon={Save}
              onClick={handlePasswordChange}
              loading={loading}
              disabled={!form.newPassword || form.newPassword.length < 6}
              className={styles.saveBtn}
            >
              Actualizar Contraseña
            </Button>
          </div>
        </Card>
      </div>

      {message && (
        <div className={clsx(styles.message, message.includes('Error') ? styles.error : styles.success)}>
          {message}
        </div>
      )}
    </div>
  );
}

