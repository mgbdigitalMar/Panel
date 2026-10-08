// 17 · Ficha de empleado
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Mail, CalendarDays, UserX, Pencil } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton } from '../components/common/GlassButton';
import { T, Label } from '../components/common/Text';
import { Avatar, EmptyState, InfoLine, Segmented } from '../components/common/UI';
import { WORK_MODES, workModeOf } from './EmployeesScreen';
import { fmtDate } from '../utils/format';

export default function EmployeeDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { params } = useRoute();
  const toast = useToast();
  const { user, employees, setCurrentUser } = useAuth();
  const { setWorkMode } = useData();
  const [saving, setSaving] = useState(false);
  const emp = employees.find((e) => String(e.id) === String(params?.id));

  if (!emp) {
    return (
      <Screen>
        <Header back title="Empleado" />
        <EmptyState icon={UserX} title="Empleado no disponible" />
      </Screen>
    );
  }

  const isMe = emp.id === user?.id;
  const isAdmin = user?.role === 'admin';
  const canEdit = isMe || isAdmin;
  const wm = workModeOf(emp.workMode);
  const wmColor = wm.tone === 'green' ? colors.successFg : wm.tone === 'amber' ? colors.warningFg : colors.accentFg;

  const changeMode = async (mode) => {
    if (mode === (emp.workMode || 'Office')) return;
    setSaving(true);
    const { error } = isMe ? await setCurrentUser({ workMode: mode }) : await setWorkMode(emp.id, mode);
    setSaving(false);
    if (error) toast.error(toUserMessage(error));
    else toast.success('Modo de trabajo actualizado');
  };

  return (
    <Screen>
      <Header back right={isAdmin ? <GlassButton title="Editar" icon={Pencil} variant="glass" size="sm" onPress={() => navigation.navigate('UserForm', { id: emp.id })} /> : null} />
      <View style={{ alignItems: 'center', gap: 8, marginTop: -8 }}>
        <View>
          <Avatar name={emp.name} initials={emp.avatar} size={96} />
          <View style={{ position: 'absolute', right: 4, bottom: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: wmColor, borderWidth: 3, borderColor: colors.bg }} />
        </View>
        <T size={26} weight="semibold" style={{ textAlign: 'center' }}>{emp.name}</T>
        <T size={15} color={colors.text2}>{emp.position || (emp.role === 'admin' ? 'Administrador' : 'Empleado')}</T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.glassStrong }}>
            <T size={12.5} weight="semibold" color={colors.accentFg}>{emp.dept || 'Sin asignar'}</T>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.glassStrong }}>
            <T size={12.5} weight="semibold" color={wmColor}>{wm.label === 'Oficina' ? 'En la oficina' : wm.label}</T>
          </View>
          {emp.role === 'admin' ? (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.purpleSoft }}>
              <T size={12.5} weight="semibold" color={colors.purpleFg}>Admin</T>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {emp.email ? (
          <GlassButton title="Correo" icon={Mail} variant="glass" style={{ flex: 1 }} onPress={() => Linking.openURL(`mailto:${emp.email}`)} />
        ) : null}
        <GlassButton title="Reunión" icon={CalendarDays} variant="glass" style={{ flex: 1 }} onPress={() => navigation.navigate('Main', { screen: 'Reservations', params: { tab: 'room' } })} />
      </View>

      <GlassCard padding={0}>
        {[
          { label: 'Correo', value: emp.email },
          { label: 'Departamento', value: emp.dept || 'Sin asignar' },
          { label: 'Puesto / Cargo', value: emp.position || (emp.role === 'admin' ? 'Administrador' : 'Empleado') },
          { label: 'Rol', value: emp.role === 'admin' ? 'Administrador' : 'Empleado' },
          { label: 'Modo de trabajo', value: wm.label === 'Oficina' ? 'En la oficina' : wm.label },
          emp.phone ? { label: 'DNI / Contacto', value: emp.phone, mono: true } : null,
          emp.joinDate ? { label: 'En Margube desde', value: fmtDate(emp.joinDate) } : null,
          ((isAdmin || isMe) && emp.birthdate) ? { label: 'Fecha de nacimiento', value: fmtDate(emp.birthdate) } : null,
        ].filter(Boolean).map((item, idx, arr) => (
          <InfoLine key={item.label} label={item.label} value={item.value} mono={item.mono} last={idx === arr.length - 1} />
        ))}
      </GlassCard>

      {canEdit ? (
        <View style={{ gap: 10 }}>
          <Label>Modo de trabajo{saving ? ' · guardando…' : ''}</Label>
          <Segmented value={emp.workMode || 'Office'} onChange={changeMode} height={44}
            options={Object.entries(WORK_MODES).map(([k, m]) => ({ value: k, label: m.label }))} />
        </View>
      ) : null}
    </Screen>
  );
}
