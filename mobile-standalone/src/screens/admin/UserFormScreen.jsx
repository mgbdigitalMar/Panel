// Alta / edición de empleado (employee modal of the web AdminPage)
import { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DEPARTMENTS } from '@shared/config/constants.js';
import { toUserMessage } from '@shared/utils/errors.js';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { Screen } from '../../components/common/Screen';
import { ModalHeader } from '../../components/common/Header';
import { GlassInput, DateField } from '../../components/common/GlassInput';
import { GlassButton } from '../../components/common/GlassButton';
import { T } from '../../components/common/Text';
import { Banner, ChipRail, Segmented } from '../../components/common/UI';
import { MIN_PASSWORD } from '../ChangePasswordScreen';
import { tempPassword } from './AdminUsersScreen';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UserFormScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const toast = useToast();
  const { employees } = useAuth();
  const { saveEmployee } = useData();
  const existing = params?.id ? employees.find((e) => e.id === params.id) : null;
  const [form, setForm] = useState({
    name: existing?.name || '',
    email: existing?.email || '',
    password: existing ? '' : tempPassword(),
    role: existing?.role || 'employee',
    dept: existing?.dept || 'Sin asignar',
    position: existing?.position || '',
    phone: existing?.phone || '',
    birthdate: existing?.birthdate || '',
    workMode: existing?.workMode || 'Office',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const emailTaken = employees.some((e) => e.id !== existing?.id && e.email?.toLowerCase() === form.email.trim().toLowerCase());
  const errors = {
    email: form.email && !EMAIL_RE.test(form.email.trim()) ? 'Correo no válido.' : emailTaken ? 'Ya existe un usuario con este correo.' : '',
    password: form.password && form.password.length < MIN_PASSWORD ? `Mínimo ${MIN_PASSWORD} caracteres.` : '',
  };
  const valid = form.name.trim() && form.email.trim() && !errors.email && !errors.password && (existing || form.password);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const { error } = await saveEmployee(existing, form);
    setSaving(false);
    if (error) {
      toast.error(toUserMessage(error));
      return;
    }
    toast.success(existing ? 'Cambios guardados' : 'Empleado creado', !existing ? `Contraseña temporal: ${form.password}` : undefined);
    navigation.goBack();
  };

  return (
    <Screen glow={false} footer={<GlassButton title={existing ? 'Guardar cambios' : 'Crear empleado'} size="lg" loading={saving} disabled={!valid} onPress={save} />}>
      <ModalHeader title={existing ? 'Editar empleado' : 'Nuevo empleado'} />
      <GlassInput label="Nombre completo" value={form.name} onChangeText={set('name')} required autoCapitalize="words" />
      <GlassInput label="Email corporativo" value={form.email} onChangeText={set('email')} required keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={errors.email} />
      <GlassInput
        label={existing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
        value={form.password}
        onChangeText={set('password')}
        required={!existing}
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.password}
        hint={existing ? 'Si la cambias, deberá crear una propia en su próximo acceso.' : 'Generada automáticamente. Puedes cambiarla.'}
      />
      <T size={13} weight="medium">Departamento</T>
      <ChipRail value={form.dept} onChange={set('dept')} options={DEPARTMENTS.map((d) => ({ value: d.value, label: d.label }))} />
      <GlassInput label="Cargo / posición" value={form.position} onChangeText={set('position')} />
      <GlassInput label="DNI" value={form.phone} onChangeText={set('phone')} autoCapitalize="characters" />
      <DateField label="Fecha de nacimiento" value={form.birthdate} onChange={set('birthdate')} maximumDate={new Date()} />
      <T size={13} weight="medium">Rol</T>
      <Segmented value={form.role} onChange={set('role')} options={[{ value: 'employee', label: 'Empleado' }, { value: 'admin', label: 'Administrador' }]} />
      {existing ? (
        <>
          <T size={13} weight="medium">Modo de trabajo</T>
          <Segmented value={form.workMode} onChange={set('workMode')} options={[{ value: 'Office', label: 'Oficina' }, { value: 'remoto', label: 'Remoto' }, { value: 'externo', label: 'Externo' }]} />
        </>
      ) : (
        <Banner tone="amber">El empleado deberá cambiar esta contraseña en su primer inicio de sesión.</Banner>
      )}
    </Screen>
  );
}
