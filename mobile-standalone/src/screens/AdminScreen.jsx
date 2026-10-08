// 20 · Bandeja de aprobación (admin). Gathers what the web spreads over
// RequestsPage, ReservationsPage and AdminPage > Bolsa Horas.
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, ShieldCheck } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassButton } from '../components/common/GlassButton';
import { PressScale } from '../components/common/Pressable';
import { Tag } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { Avatar, ChipRail, EmptyState } from '../components/common/UI';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import { requestDetail, requestTypeLabel } from '../utils/domain';
import { fmtDayShort, fmtHM } from '../utils/format';

const KIND_LABEL = { request: 'Solicitud', reservation: 'Reserva', hours: 'Horas' };
const KIND_TONE = { request: 'accent', reservation: 'teal', hours: 'amber' };

function describe(entry) {
  const it = entry.item;
  if (entry.kind === 'request') return `${requestTypeLabel(it.type)} · ${requestDetail(it)}`;
  if (entry.kind === 'reservation') return `${it.resourceName} · ${fmtDayShort(it.date)} ${it.timeStart}–${it.timeEnd}`;
  return `Bolsa +${fmtHM(it.hours)} · ${it.reason}`;
}

export default function AdminScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const toast = useToast();
  const { employees } = useAuth();
  const { setRequestStatus, setReservationStatus, setHourStatus, refresh } = useData();
  const pending = usePendingApprovals();
  const [kind, setKind] = useState('all');
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const list = useMemo(() => pending.filter((p) => kind === 'all' || p.kind === kind), [pending, kind]);
  const selected = list.filter((p) => sel[p.key]);
  const allOn = list.length > 0 && selected.length === list.length;
  const count = (k) => pending.filter((p) => k === 'all' || p.kind === k).length;

  const decideOne = async (entry, approve) => {
    const it = entry.item;
    if (entry.kind === 'request') return setRequestStatus(it, approve ? 'approved' : 'rejected');
    if (entry.kind === 'reservation') return setReservationStatus(it.id, approve ? 'confirmed' : 'cancelled');
    return setHourStatus(it, approve ? 'approved' : 'rejected');
  };

  const run = async (entries, approve) => {
    setBusy(true);
    let failed = 0;
    for (const e of entries) {
      const res = await decideOne(e, approve);
      if (res?.error) failed += 1;
    }
    setBusy(false);
    setSel({});
    if (failed) toast.error(`${failed} no se han podido actualizar`, toUserMessage(null));
    else toast.success(`${entries.length} ${approve ? 'aprobada' : 'rechazada'}${entries.length === 1 ? '' : 's'}`);
  };

  const confirmBulk = (approve) => Alert.alert(
    approve ? 'Aprobar selección' : 'Rechazar selección',
    `${selected.length} elemento${selected.length === 1 ? '' : 's'} · se notificará a cada empleado.`,
    [{ text: 'Cancelar', style: 'cancel' }, { text: approve ? 'Aprobar' : 'Rechazar', style: approve ? 'default' : 'destructive', onPress: () => run(selected, approve) }],
  );

  const openEntry = (entry) => {
    const it = entry.item;
    if (entry.kind === 'request') navigation.navigate('RequestDetail', { id: String(it.id), kind: it.type === 'asuntos_propios' ? 'asuntos_propios' : 'request' });
    else if (entry.kind === 'reservation') navigation.navigate('MyReservations', { scope: 'pending' });
    else navigation.navigate('AdminHours');
  };

  const toolbar = selected.length ? (
    <View style={{
      position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16,
      maxWidth: 580, width: '100%', alignSelf: 'center',
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 10, paddingLeft: 16, borderRadius: 22, backgroundColor: colors.sheetBg, borderWidth: 1, borderColor: colors.glassBorderStrong,
      shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10,
    }}
    >
      <T size={14} weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{selected.length} seleccionada{selected.length === 1 ? '' : 's'}</T>
      <GlassButton title="Rechazar" variant="danger" size="sm" disabled={busy} onPress={() => confirmBulk(false)} />
      <GlassButton title="Aprobar" size="sm" loading={busy} onPress={() => confirmBulk(true)} />
    </View>
  ) : null;

  return (
    <Screen fab={toolbar} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing}
      contentStyle={{ paddingBottom: selected.length ? 120 : 32 }}>
      <Header back eyebrow="Administración" title="Aprobar"
        right={list.length ? (
          <GlassButton title={allOn ? 'Ninguna' : 'Todas'} variant="glass" size="sm"
            onPress={() => setSel(allOn ? {} : Object.fromEntries(list.map((p) => [p.key, true])))} />
        ) : null} />

      <ChipRail value={kind} onChange={(k) => { setKind(k); setSel({}); }}
        options={[
          { value: 'all', label: 'Todo', count: count('all') },
          { value: 'request', label: 'Solicitudes', count: count('request') },
          { value: 'reservation', label: 'Reservas', count: count('reservation') },
          { value: 'hours', label: 'Horas', count: count('hours') },
        ]} />

      {list.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Todo al día" message="No hay nada pendiente de aprobar." />
      ) : (
        <View style={{ gap: 8 }}>
          {list.map((entry) => {
            const on = !!sel[entry.key];
            const name = entry.item.employeeName || employees.find((e) => e.id === entry.item.employeeId)?.name || 'Empleado';
            return (
              <View key={entry.key} style={{
                flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingLeft: 10, borderRadius: 20,
                backgroundColor: on ? colors.accentSoft : colors.glass, borderWidth: 1, borderColor: on ? colors.accentBorder : colors.glassBorder,
              }}
              >
                <Pressable
                  onPress={() => setSel((s) => ({ ...s, [entry.key]: !on }))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel="Seleccionar"
                  hitSlop={8}
                  style={{ width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: colors.text3 }}
                >
                  {on ? <Check size={14} color={colors.onAccent} strokeWidth={3} /> : null}
                </Pressable>
                <PressScale onPress={() => openEntry(entry)} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Avatar name={name} size={34} />
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <T size={13.5} weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</T>
                      <Tag label={KIND_LABEL[entry.kind]} tone={KIND_TONE[entry.kind]} small />
                    </View>
                    <T size={12} color={colors.text3} numberOfLines={1}>{describe(entry)}</T>
                  </View>
                </PressScale>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <PressScale onPress={() => run([entry], false)} disabled={busy} accessibilityRole="button" accessibilityLabel="Rechazar"
                    style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft }}>
                    <X size={16} color={colors.dangerFg} />
                  </PressScale>
                  <PressScale onPress={() => run([entry], true)} disabled={busy} accessibilityRole="button" accessibilityLabel="Aprobar"
                    style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSoft }}>
                    <Check size={16} color={colors.successFg} />
                  </PressScale>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
