// 11 · Mis solicitudes (RequestsPage on the web)
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Download, Plus, FileText } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { IconButton } from '../components/common/GlassButton';
import { Fab } from '../components/common/Fab';
import { StatusBadge } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { ChipRail, EmptyState, IconTile, Row, Segmented } from '../components/common/UI';
import { buildRequestItems, personalDaysSummary, requestDetail, requestTitle, requestTypeLabel, REQUEST_TONE } from '../utils/domain';
import { addDays, startOfWeek, toISODate, DAY_LETTERS } from '../utils/format';
import { exportCsv } from '../services/files';
import { requestIcon } from '../utils/icons';

export default function RequestsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user, employees } = useAuth();
  const { requests, personalDays, refresh } = useData();
  const [scope, setScope] = useState('mine');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const all = useMemo(() => buildRequestItems(requests, personalDays, employees), [requests, personalDays, employees]);
  const scoped = scope === 'mine' ? all.filter((r) => r.employeeId === user?.id) : all;
  const filtered = scoped.filter((r) => (status === 'all' || r.status === status) && (type === 'all' || r.type === type));
  const days = personalDaysSummary(personalDays, user?.id);

  // Remote/external days approved for me this week (Mon–Fri).
  const week = useMemo(() => {
    const monday = startOfWeek(new Date());
    return [0, 1, 2, 3, 4].map((i) => {
      const iso = toISODate(addDays(monday, i));
      const on = requests.some((r) => r.employeeId === user?.id && (r.type === 'remoto' || r.type === 'external')
        && r.status === 'approved' && iso >= r.startDate && iso <= r.endDate);
      return { iso, letter: DAY_LETTERS[(i + 1) % 7], on };
    });
  }, [requests, user?.id]);
  const remoteDays = week.filter((d) => d.on).length;

  const count = (s) => scoped.filter((r) => s === 'all' || r.status === s).length;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const exportList = async () => {
    try {
      await exportCsv(`solicitudes-${toISODate(new Date())}.csv`,
        ['Empleado', 'Tipo', 'Detalle', 'Estado', 'Fecha solicitud'],
        filtered.map((r) => [
          r.employeeName || '—',
          requestTypeLabel(r.type),
          r.type === 'purchase' ? `${r.item} - ${r.amount}€` : r.type === 'asuntos_propios' ? `${r.date} (1 día)` : `${r.startDate} a ${r.endDate} (${r.days || '?'} días)`,
          r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente',
          r.createdAt,
        ]));
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  return (
    <Screen tabBarSpace onRefresh={onRefresh} refreshing={refreshing}
      fab={<Fab compact icon={Plus} label="Nueva solicitud" onPress={() => navigation.navigate('NewRequest')} />}>
      <Header
        title="Solicitudes"
        right={filtered.length ? <IconButton icon={Download} onPress={exportList} accessibilityLabel="Descargar CSV" /> : null}
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <GlassCard style={{ flex: 1, minWidth: 0, gap: 8 }} padding={14} onPress={() => navigation.navigate('NewRequest', { type: 'asuntos_propios' })}>
          <T size={13} color={colors.text3} numberOfLines={1}>Asuntos propios</T>
          <T mono weight="semibold" size={22} numberOfLines={1} adjustsFontSizeToFit>{days.left}<T size={13} color={colors.text3}> / {days.total} días</T></T>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {Array.from({ length: Math.max(0, Math.min(30, Number(days.total) || 0)) }).map((_, i) => (
              <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < days.left ? colors.accent : colors.segTrack }} />
            ))}
          </View>
        </GlassCard>
        <GlassCard style={{ flex: 1, minWidth: 0, gap: 8 }} padding={14}>
          <T size={13} color={colors.text3} numberOfLines={1}>Teletrabajo semana</T>
          <T mono weight="semibold" size={22} numberOfLines={1} adjustsFontSizeToFit>{remoteDays}<T size={13} color={colors.text3}> días</T></T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {week.map((d) => (
              <View key={d.iso} style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: d.on ? colors.tealSoft : 'transparent' }}>
                <T size={11} weight="semibold" color={d.on ? colors.tealFg : colors.text3}>{d.letter}</T>
              </View>
            ))}
          </View>
        </GlassCard>
      </View>

      <Segmented
        value={scope}
        onChange={setScope}
        options={[{ value: 'mine', label: 'Mías' }, { value: 'team', label: 'Equipo' }]}
      />

      <ChipRail
        value={status}
        onChange={setStatus}
        options={[
          { value: 'all', label: 'Todas', count: count('all') },
          { value: 'pending', label: 'Pendientes', count: count('pending') },
          { value: 'approved', label: 'Aprobadas', count: count('approved') },
          { value: 'rejected', label: 'Rechazadas', count: count('rejected') },
        ]}
      />
      <ChipRail
        value={type}
        onChange={setType}
        options={[
          { value: 'all', label: 'Todos los tipos' },
          { value: 'asuntos_propios', label: 'Asuntos propios' },
          { value: 'purchase', label: 'Compras' },
          { value: 'remoto', label: 'Remoto' },
          { value: 'external', label: 'Externo' },
        ]}
      />

      <View style={{ gap: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No hay solicitudes" message="No se han encontrado solicitudes con estos filtros." />
        ) : filtered.map((r) => (
          <Row
            key={`${r.type}-${r.id}`}
            left={<IconTile icon={requestIcon(r.type)} tone={REQUEST_TONE[r.type]} />}
            title={requestTitle(r)}
            subtitle={scope === 'team' ? `${r.employeeName || '—'} · ${requestDetail(r)}` : requestDetail(r)}
            right={<StatusBadge status={r.status} />}
            onPress={() => navigation.navigate('RequestDetail', { id: String(r.id), kind: r.type === 'asuntos_propios' ? 'asuntos_propios' : 'request' })}
          />
        ))}
      </View>
    </Screen>
  );
}
