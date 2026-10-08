// Horas del equipo: AdminPage > Bolsa Horas + HorasPage > Historial de Usuarios (web)
import { useMemo, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check, X, Trash2, Download, Search, Timer, ChevronRight } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { Screen } from '../../components/common/Screen';
import { Header } from '../../components/common/Header';
import { GlassButton, IconButton } from '../../components/common/GlassButton';
import { DateField } from '../../components/common/GlassInput';
import { PressScale } from '../../components/common/Pressable';
import { T } from '../../components/common/Text';
import { Avatar, ChipRail, EmptyState, Segmented } from '../../components/common/UI';
import { HourRow, exportHoursCsv } from '../HorasScreen';
import { FONTS } from '../../theme/tokens';
import { hourStats } from '../../utils/domain';
import { fmtHM, fmtHMSigned, toISODate } from '../../utils/format';
import { exportCsv } from '../../services/files';

export default function AdminHoursScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { employees } = useAuth();
  const { hourCompensations, setHourStatus, deleteHourCompensation, refresh } = useData();
  const [tab, setTab] = useState('bolsa');
  const [status, setStatus] = useState('pending');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const bolsa = useMemo(() => hourCompensations
    .filter((h) => h.type === 'bolsa' && (status === 'all' || h.status === status)
      && (!from || h.date >= from) && (!to || h.date <= to))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')), [hourCompensations, status, from, to]);
  const approvedHours = bolsa.reduce((s, h) => s + (h.status === 'approved' ? h.hours : 0), 0);

  const userStats = useMemo(() => employees.map((emp) => {
    const entries = hourCompensations.filter((h) => String(h.employeeId) === String(emp.id));
    return { employee: emp, ...hourStats(entries), total: entries.length };
  }).filter((s) => {
    const needle = q.trim().toLowerCase();
    return !needle || `${s.employee.name} ${s.employee.dept || ''}`.toLowerCase().includes(needle);
  }), [employees, hourCompensations, q]);

  const decide = async (h, st) => {
    setBusy(h.id);
    const { error } = await setHourStatus(h, st);
    setBusy(null);
    if (error) toast.error(toUserMessage(error));
    else toast.success(st === 'approved' ? 'Horas aprobadas' : 'Horas rechazadas');
  };

  const remove = (h) => Alert.alert('Eliminar registro', '¿Seguro que quieres eliminar este registro de horas?', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Eliminar',
      style: 'destructive',
      onPress: async () => {
        const { error } = await deleteHourCompensation(h.id);
        if (error) toast.error(toUserMessage(error));
        else toast.success('Registro eliminado');
      },
    },
  ]);

  const exportTab = async () => {
    try {
      if (tab === 'bolsa') {
        await exportHoursCsv(bolsa, `bolsa-horas-admin-${toISODate(new Date())}.csv`);
      } else {
        await exportCsv(`tiempo-a-compensar-usuarios-${toISODate(new Date())}.csv`,
          ['Empleado', 'Departamento', 'En Bolsa (A favor)', 'Pendiente', 'Debo (Deuda)', 'Compensado (Ya)', 'Balance Neto'],
          userStats.map((s) => [s.employee.name, s.employee.dept || 'Sin departamento',
            String(s.bolsa).replace('.', ','), String(s.pending).replace('.', ','), String(s.debe).replace('.', ','),
            String(s.ya).replace('.', ','), String(s.bolsa + s.ya - s.debe).replace('.', ',')]));
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing}>
      <Header back eyebrow="Administración" title="Horas del equipo" right={<IconButton icon={Download} onPress={exportTab} accessibilityLabel="Descargar CSV" />} />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'bolsa', label: 'Bolsa de horas' }, { value: 'users', label: 'Por empleado' }]} />

      {tab === 'bolsa' ? (
        <>
          <ChipRail value={status} onChange={setStatus} options={[
            { value: 'pending', label: 'Pendientes', count: hourCompensations.filter((h) => h.type === 'bolsa' && h.status === 'pending').length },
            { value: 'approved', label: 'Aprobadas' }, { value: 'rejected', label: 'Rechazadas' }, { value: 'all', label: 'Todas' },
          ]} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateField label="Desde" value={from} onChange={setFrom} style={{ flex: 1 }} placeholder="Inicio" />
            <DateField label="Hasta" value={to} onChange={setTo} style={{ flex: 1 }} placeholder="Hoy" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={13} color={colors.text3}>{bolsa.length} solicitud{bolsa.length === 1 ? '' : 'es'} · {fmtHM(approvedHours)} h aprobadas</T>
            {from || to ? <GlassButton title="Limpiar" variant="ghost" size="sm" onPress={() => { setFrom(''); setTo(''); }} /> : null}
          </View>
          <View style={{ gap: 8 }}>
            {bolsa.length === 0 ? <EmptyState icon={Timer} title="No hay solicitudes de bolsa" message="Prueba con otros filtros." /> : bolsa.map((h) => (
              <View key={h.id} style={{ gap: 6 }}>
                <HourRow h={h} showEmployee />
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                  {h.status === 'pending' ? (
                    <>
                      <GlassButton title="Rechazar" icon={X} variant="danger" size="sm" disabled={busy === h.id} onPress={() => decide(h, 'rejected')} />
                      <GlassButton title="Aprobar" icon={Check} size="sm" disabled={busy === h.id} onPress={() => decide(h, 'approved')} />
                    </>
                  ) : null}
                  <GlassButton icon={Trash2} variant="glass" size="sm" accessibilityLabel="Eliminar registro" onPress={() => remove(h)} />
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={{ justifyContent: 'center' }}>
            <Search size={18} color={colors.text3} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
            <TextInput value={q} onChangeText={setQ} placeholder="Buscar empleado o departamento" placeholderTextColor={colors.muted} accessibilityLabel="Buscar empleado"
              style={{ height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.glassBorderStrong, backgroundColor: colors.inputBg, color: colors.text, fontFamily: FONTS.regular, fontSize: 15, paddingLeft: 42, paddingRight: 14 }} />
          </View>
          <View style={{ gap: 8 }}>
            {userStats.map((s) => {
              const balance = s.bolsa + s.ya - s.debe;
              return (
                <PressScale key={s.employee.id} onPress={() => navigation.navigate('HoursUserHistory', { id: s.employee.id })} accessibilityRole="button"
                  style={{ padding: 12, borderRadius: 20, gap: 10, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={s.employee.name} initials={s.employee.avatar} size={36} />
                    <View style={{ flex: 1 }}>
                      <T size={15} weight="semibold" numberOfLines={1}>{s.employee.name}</T>
                      <T size={12.5} color={colors.text3}>{s.employee.dept || 'Sin departamento'}</T>
                    </View>
                    <T mono weight="semibold" size={16} color={balance < 0 ? colors.dangerFg : colors.successFg}>{fmtHMSigned(balance)}</T>
                    <ChevronRight size={18} color={colors.text3} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[['Bolsa', s.bolsa, colors.accentFg], ['Pend.', s.pending, colors.warningFg], ['Debo', s.debe, colors.dangerFg], ['Ya', s.ya, colors.successFg]].map(([l, v, c]) => (
                      <View key={l} style={{ flex: 1, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.segTrack, alignItems: 'center' }}>
                        <T mono weight="semibold" size={13} color={c} numberOfLines={1} adjustsFontSizeToFit>{fmtHM(v)}</T>
                        <T size={10.5} color={colors.text3} numberOfLines={1}>{l}</T>
                      </View>
                    ))}
                  </View>
                </PressScale>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}
