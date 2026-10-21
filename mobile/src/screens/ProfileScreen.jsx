// Mi perfil (ProfilePage on the web): info, work mode, password. Documents live in DocumentsScreen.
import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FileText, ChevronRight, KeyRound } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { allowedWorkModes, formatTeleworkDays } from '@shared/services/workMode.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassInput } from '../components/common/GlassInput';
import { GlassButton } from '../components/common/GlassButton';
import { T, Label } from '../components/common/Text';
import { Avatar, InfoLine, Segmented, IconTile, Banner } from '../components/common/UI';
import { BrandPanel, BrandTag, ON_BRAND } from '../components/common/Brand';
import { WORK_MODES } from './EmployeesScreen';
import { MIN_PASSWORD, StrengthMeter } from './ChangePasswordScreen';
import { fmtDate } from '../utils/format';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user, changePassword } = useAuth();
  const { documents, requests, setWorkMode } = useData();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);
  const pendingDocs = documents.filter((d) => String(d.recipientId) === String(user?.id) && d.status === 'pending').length;

  const changeMode = async (mode) => {
    if (mode === (user?.workMode || 'Office')) return;
    setModeSaving(true);
    const { error } = await setWorkMode(user.id, mode);
    setModeSaving(false);
    if (error) toast.error(toUserMessage(error));
    else if (mode === 'Office') toast.success('Has vuelto a la oficina', 'Se ha avisado a administración.');
    else toast.success('Modo de trabajo actualizado correctamente');
  };
  // Remote / external need an approved request covering today
  const allowedModes = allowedWorkModes(requests, user?.id, undefined, user);

  const savePassword = async () => {
    setPwErr('');
    if (!pw.current) return setPwErr('Introduce la contraseña actual.');
    if (pw.next.length < MIN_PASSWORD) return setPwErr(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (pw.next !== pw.confirm) return setPwErr('Las contraseñas no coinciden.');
    setSaving(true);
    const { error } = await changePassword(pw.current, pw.next);
    setSaving(false);
    if (error) return setPwErr(toUserMessage(error));
    setPw({ current: '', next: '', confirm: '' });
    toast.success('Contraseña actualizada', 'Usa la nueva en tu próximo inicio de sesión.');
    return undefined;
  };

  return (
    <Screen>
      <Header back title="" />

      {/* Identity: the brand panel with the person's leaf avatar (web ProfilePage) */}
      <BrandPanel padding={22} style={{ gap: 16 }}>
        <Avatar name={user?.name} initials={user?.avatar} src={user?.avatarUrl} size={76} ring="rgba(255,255,255,0.28)" />
        <View style={{ gap: 4 }}>
          <T size={24} weight="semibold" color={ON_BRAND.text} accessibilityRole="header">{user?.name}</T>
          <T size={14} color={ON_BRAND.text2}>{user?.position || (user?.role === 'admin' ? 'Administrador' : 'Empleado')}</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {user?.dept ? <BrandTag label={user.dept} /> : null}
          <BrandTag label={user?.role === 'admin' ? 'Administrador' : 'Empleado'} />
          <BrandTag label={WORK_MODES[user?.workMode || 'Office']?.label || 'Oficina'} />
        </View>
      </BrandPanel>

      <GlassCard padding={0}>
        <InfoLine label="Email" value={user?.email} />
        <InfoLine label="Rol" value={user?.role === 'admin' ? 'Administrador' : 'Empleado'} />
        <InfoLine label="Departamento" value={user?.dept} />
        <InfoLine label="DNI" value={user?.phone} mono />
        <InfoLine label="Fecha de nacimiento" value={user?.birthdate ? fmtDate(user.birthdate) : 'No especificada'} last />
      </GlassCard>

      <GlassCard onPress={() => navigation.navigate('Documents')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon={FileText} tone="teal" />
        <View style={{ flex: 1 }}>
          <T size={15} weight="semibold">Mis documentos</T>
          <T size={13} color={colors.text3}>{pendingDocs ? `${pendingDocs} pendiente${pendingDocs === 1 ? '' : 's'} de revisar` : 'Nóminas, contratos y avisos de RRHH'}</T>
        </View>
        <ChevronRight size={20} color={colors.text3} />
      </GlassCard>

      <View style={{ gap: 10 }}>
        <Label>Modo de trabajo{modeSaving ? ' · guardando…' : ''}</Label>
        <Segmented value={user?.workMode || 'Office'} onChange={changeMode} height={44}
          options={Object.entries(WORK_MODES).map(([k, m]) => ({ value: k, label: m.label, disabled: modeSaving || !allowedModes.has(k) }))} />
        {user?.teleworkDays?.length ? (
          <T size={12.5} color={colors.text3}>
            Teletrabajas los {formatTeleworkDays(user.teleworkDays)}: esos días tu modo pasa a Remoto automáticamente y el resto a Oficina.
          </T>
        ) : null}
        <T size={12.5} color={colors.text3}>
          {(user?.workMode || 'Office') === 'Office'
            ? 'Remoto y externo se activan solos cuando administración aprueba tu solicitud para hoy.'
            : 'Si vuelves antes a la oficina, elige Oficina: se avisará a administración.'}
        </T>
      </View>

      <View style={{ gap: 10 }}>
        <Label>Cambiar contraseña</Label>
        <GlassCard style={{ gap: 14 }}>
          <GlassInput label="Contraseña actual" value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} secure autoComplete="current-password" />
          <GlassInput label="Nueva contraseña" value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} secure autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} />
          {pw.next ? <StrengthMeter value={pw.next} /> : null}
          <GlassInput label="Confirmar nueva contraseña" value={pw.confirm} onChangeText={(v) => setPw((p) => ({ ...p, confirm: v }))} secure autoComplete="new-password" />
          {pwErr ? <Banner tone="danger">{pwErr}</Banner> : null}
          <GlassButton title="Actualizar contraseña" icon={KeyRound} onPress={savePassword} loading={saving} disabled={!pw.next} />
        </GlassCard>
      </View>
    </Screen>
  );
}
