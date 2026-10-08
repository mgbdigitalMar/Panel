// 21 · Gestión de usuarios (AdminPage > Empleados on the web)
import { useMemo, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ExpoCrypto from 'expo-crypto';
import { Search, UserPlus, Pencil, KeyRound, UserMinus, UsersRound } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { Screen } from '../../components/common/Screen';
import { Header } from '../../components/common/Header';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassButton } from '../../components/common/GlassButton';
import { GlassInput } from '../../components/common/GlassInput';
import { PressScale } from '../../components/common/Pressable';
import { Tag } from '../../components/common/StatusBadge';
import { T } from '../../components/common/Text';
import { Avatar, ChipRail, EmptyState, Sheet, Banner } from '../../components/common/UI';
import { FONTS } from '../../theme/tokens';
import { MIN_PASSWORD } from '../ChangePasswordScreen';

export function tempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = ExpoCrypto.getRandomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user, employees, refreshEmployees } = useAuth();
  const { deleteEmployee, resetEmployeePassword } = useData();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [reset, setReset] = useState(null); // { emp, password }
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const firstAccess = employees.filter((e) => e.firstLogin === true || e.firstLogin === 'true').length;
  const admins = employees.filter((e) => e.role === 'admin').length;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return employees.filter((e) => (role === 'all' || (role === 'first' ? (e.firstLogin === true || e.firstLogin === 'true') : e.role === role))
      && (!needle || `${e.name} ${e.email}`.toLowerCase().includes(needle)));
  }, [employees, q, role]);

  const remove = (emp) => {
    if (emp.id === user?.id) {
      toast.error('No puedes darte de baja a ti mismo.');
      return;
    }
    Alert.alert('Eliminar empleado', `¿Seguro que quieres eliminar a ${emp.name} y todos sus archivos asociados? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const { error } = await deleteEmployee(emp.id);
          setBusy(false);
          if (error) toast.error(toUserMessage(error));
          else { setExpanded(null); toast.success('Empleado eliminado'); }
        },
      },
    ]);
  };

  const doReset = async () => {
    if (!reset || reset.password.length < MIN_PASSWORD) return;
    setBusy(true);
    const { error } = await resetEmployeePassword(reset.emp.id, reset.password);
    setBusy(false);
    if (error) toast.error(toUserMessage(error));
    else {
      toast.success('Contraseña temporal guardada', `${reset.emp.name.split(' ')[0]} deberá cambiarla al entrar.`);
      setReset(null);
    }
  };

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await refreshEmployees(); setRefreshing(false); }} refreshing={refreshing}>
      <Header back title="Usuarios" right={<GlassButton title="Alta" icon={UserPlus} size="sm" onPress={() => navigation.navigate('UserForm', {})} />} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[[employees.length - firstAccess, 'Activos', colors.successFg], [firstAccess, 'Primer acceso', colors.warningFg], [admins, 'Admins', colors.purpleFg]].map(([n, l, c]) => (
          <GlassCard key={l} padding={12} style={{ flex: 1, gap: 2 }}>
            <T mono weight="semibold" size={24} color={c}>{n}</T>
            <T size={12} color={colors.text3}>{l}</T>
          </GlassCard>
        ))}
      </View>

      <View style={{ justifyContent: 'center' }}>
        <Search size={18} color={colors.text3} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre o correo" placeholderTextColor={colors.muted} accessibilityLabel="Buscar usuario" autoCapitalize="none"
          style={{ height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.glassBorderStrong, backgroundColor: colors.inputBg, color: colors.text, fontFamily: FONTS.regular, fontSize: 15, paddingLeft: 42, paddingRight: 14 }} />
      </View>

      <ChipRail value={role} onChange={setRole} options={[
        { value: 'all', label: 'Todos' }, { value: 'admin', label: 'Admins' }, { value: 'employee', label: 'Empleados' }, { value: 'first', label: 'Primer acceso' },
      ]} />

      <View style={{ gap: 8 }}>
        {list.length === 0 ? <EmptyState icon={UsersRound} title="Sin resultados" /> : list.map((e) => {
          const open = expanded === e.id;
          const first = e.firstLogin === true || e.firstLogin === 'true';
          return (
            <View key={e.id} style={{ borderRadius: 20, backgroundColor: open ? colors.glassStrong : colors.glass, borderWidth: 1, borderColor: open ? colors.accentBorder : colors.glassBorder, overflow: 'hidden' }}>
              <PressScale onPress={() => setExpanded(open ? null : e.id)} scaleTo={0.985} accessibilityRole="button" accessibilityState={{ expanded: open }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                <Avatar name={e.name} initials={e.avatar} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={15} weight="semibold" numberOfLines={1}>{e.name}</T>
                  <T size={12.5} color={first ? colors.warningFg : colors.text3} numberOfLines={1}>
                    {first ? `Primer acceso pendiente · ${e.dept || 'Sin asignar'}` : `${e.dept || 'Sin asignar'} · ${e.email}`}
                  </T>
                </View>
                <Tag label={e.role === 'admin' ? 'ADMIN' : 'Empleado'} tone={e.role === 'admin' ? 'purple' : 'neutral'} />
              </PressScale>
              {open ? (
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
                  <GlassButton title="Editar" icon={Pencil} variant="glass" size="sm" style={{ flex: 1 }} onPress={() => navigation.navigate('UserForm', { id: e.id })} />
                  <GlassButton title="Clave" icon={KeyRound} variant="glass" size="sm" style={{ flex: 1 }} onPress={() => setReset({ emp: e, password: tempPassword() })} />
                  <GlassButton title="Baja" icon={UserMinus} variant="danger" size="sm" style={{ flex: 1 }} disabled={busy || e.id === user?.id} onPress={() => remove(e)} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Sheet visible={!!reset} onClose={() => setReset(null)} title="Restablecer contraseña"
        footer={<GlassButton title="Guardar contraseña temporal" size="lg" loading={busy} disabled={!reset || reset.password.length < MIN_PASSWORD} onPress={doReset} />}>
        {reset ? (
          <>
            <T size={15} color={colors.text2}>
              {reset.emp.name} entrará con esta contraseña y la app le pedirá crear una propia.
            </T>
            <GlassInput label="Contraseña temporal" value={reset.password} onChangeText={(v) => setReset((r) => ({ ...r, password: v }))}
              autoCapitalize="none" autoCorrect={false} inputStyle={{ fontFamily: FONTS.mono, letterSpacing: 1 }} selectTextOnFocus />
            <GlassButton title="Generar otra" variant="ghost" size="sm" onPress={() => setReset((r) => ({ ...r, password: tempPassword() }))} />
            <Banner tone="amber">Comunícasela por un canal seguro. No se volverá a mostrar.</Banner>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
