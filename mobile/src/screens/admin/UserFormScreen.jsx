// Alta / edición de empleado (employee modal of the web AdminPage)
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DEPARTMENTS } from '@shared/config/constants.js';
import { toUserMessage } from '@shared/utils/errors.js';
import { TELEWORK_WEEKDAYS, formatTeleworkDays } from '@shared/services/workMode.js';
import { fetchPolicySignatures, latestSignatureByUser, policyStatus, formatSignedAt, PLATFORM_LABELS, POLICY_TITLE } from '@shared/services/policy.js';
import { supabase } from '../../lib/supabase';
import { SignatureView } from '../../components/SignaturePad';
import { GlassCard } from '../../components/common/GlassCard';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { Screen } from '../../components/common/Screen';
import { ModalHeader } from '../../components/common/Header';
import { GlassInput, DateField } from '../../components/common/GlassInput';
import { GlassButton } from '../../components/common/GlassButton';
import { T } from '../../components/common/Text';
import { Banner, ChipRail, Segmented, SwitchRow, WeekdayPicker, InfoLine } from '../../components/common/UI';
import { MIN_PASSWORD } from '../ChangePasswordScreen';
import { tempPassword } from './AdminUsersScreen';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UserFormScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const toast = useToast();
  const { colors } = useTheme();
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
    teleworkDays: existing?.teleworkDays || [],
    policyAccepted: existing?.policyAccepted === true,
  });
  const [saving, setSaving] = useState(false);
  // Signature of the internal rules of the person being edited (undefined = loading, null = failed)
  const [signature, setSignature] = useState(undefined);
  useEffect(() => {
    if (!existing?.id) return;
    fetchPolicySignatures(supabase).then((list) => setSignature(list ? latestSignatureByUser(list)[existing.id] || false : null));
  }, [existing?.id]);
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
      <T size={13} weight="medium">Días de teletrabajo</T>
      <WeekdayPicker
        options={TELEWORK_WEEKDAYS.map((w) => ({ value: w.day, short: w.short, label: w.label }))}
        values={form.teleworkDays}
        onChange={set('teleworkDays')}
      />
      <T size={12.5} color={colors.text3}>
        {form.teleworkDays.length
          ? `Cada ${formatTeleworkDays(form.teleworkDays)} su modo pasará a Remoto automáticamente; el resto de días, a Oficina.`
          : 'Sin días fijos: el modo solo cambia con solicitudes aprobadas o a mano.'}
      </T>
      {existing ? (() => {
        const st = policyStatus(existing, signature || undefined);
        const tone = st === 'signed' ? colors.successFg : st === 'manual' ? colors.text3 : colors.warningFg;
        return (
          <GlassCard padding={14} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <T size={14} weight="semibold" style={{ flex: 1 }}>Firma de las normas internas</T>
              <T size={12.5} weight="semibold" color={tone}>
                {st === 'signed' ? 'Firmadas' : st === 'manual' ? 'Aceptadas sin firma' : 'Firma pendiente'}
              </T>
            </View>
            {signature ? (
              <>
                <SignatureView strokes={signature.strokes} label={`Firma de ${signature.signerName}`} />
                <View>
                  <InfoLine label="Firmado por" value={signature.signerName} />
                  <InfoLine label="Fecha y hora" value={formatSignedAt(signature.signedAt)} mono />
                  <InfoLine label="Documento" value={signature.documentTitle || POLICY_TITLE} />
                  <InfoLine label="Desde" value={PLATFORM_LABELS[signature.platform] || signature.platform || '—'} last />
                </View>
                {st === 'pending' ? (
                  <T size={12.5} color={colors.text3}>Se le ha pedido firmar de nuevo: esta es su última firma.</T>
                ) : null}
              </>
            ) : (
              <T size={13} color={colors.text2}>
                {signature === undefined ? 'Cargando firma…'
                  : signature === null ? 'No se ha podido cargar la firma.'
                    : st === 'manual' ? 'Normas aceptadas por RRHH sin firma digital.'
                      : 'Todavía no ha firmado el documento. Se le pedirá al entrar.'}
              </T>
            )}
          </GlassCard>
        );
      })() : null}
      <SwitchRow
        title="Normas internas ya aceptadas"
        subtitle={form.policyAccepted
          ? 'No se le pedirá firmarlas al entrar. Actívalo solo si ya las ha firmado (por ejemplo, en papel).'
          : 'Al entrar deberá leer y firmar el Procedimiento de Normas Internas 2026.'}
        value={form.policyAccepted}
        onValueChange={set('policyAccepted')}
      />
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
