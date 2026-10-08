// 14 · Tiempo a compensar (tab "Mi Registro" of the web HorasPage)
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Plus, Download, Users, Timer } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton, IconButton } from '../components/common/GlassButton';
import { DateField } from '../components/common/GlassInput';
import { Tag } from '../components/common/StatusBadge';
import { T, Label } from '../components/common/Text';
import { EmptyState, Segmented } from '../components/common/UI';
import { hourStats, HOUR_LABEL, HOUR_TONE } from '../utils/domain';
import { fmtHM, fmtHMSigned, parseDate, MONTHS_SHORT, toISODate, fmtDate } from '../utils/format';
import { exportCsv } from '../services/files';

export function hourStateText(h) {
  if (h.type === 'ya') return 'Aprobado al instante';
  if (h.type === 'debe') return 'Registrado';
  if (h.status === 'pending') return 'Pendiente de admin';
  const who = h.reviewerName ? ` por ${h.reviewerName.split(' ')[0]}` : '';
  return h.status === 'approved' ? `Aprobado${who}` : `Rechazado${who}`;
}

export function HourRow({ h, showEmployee }) {
  const { colors } = useTheme();
  const d = parseDate(h.date);
  const amtColor = h.type === 'debe' ? colors.dangerFg : h.status === 'pending' ? colors.warningFg : h.status === 'rejected' ? colors.muted : colors.successFg;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }}>
      <View style={{ width: 40, alignItems: 'center' }}>
        <T mono weight="semibold" size={18}>{d ? String(d.getDate()).padStart(2, '0') : '—'}</T>
        <T size={11} color={colors.text3}>{d ? MONTHS_SHORT[d.getMonth()] : ''}</T>
      </View>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <T size={15} weight="semibold" numberOfLines={1}>{showEmployee ? `${h.employeeName || '—'} · ${h.reason}` : h.reason}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tag label={HOUR_LABEL[h.type]} tone={HOUR_TONE[h.type]} />
          <T size={12.5} color={colors.text3} numberOfLines={1} style={{ flex: 1 }}>{hourStateText(h)}</T>
        </View>
      </View>
      <T mono weight="semibold" size={16} color={amtColor} style={h.status === 'rejected' ? { textDecorationLine: 'line-through' } : null}>
        {h.type === 'debe' ? '−' : '+'}{fmtHM(h.hours)}
      </T>
    </View>
  );
}

export async function exportHoursCsv(rows, filename) {
  const typeLabel = (t) => (t === 'ya' ? 'Inmediata' : t === 'bolsa' ? 'Bolsa' : 'Debo');
  await exportCsv(filename,
    ['Fecha', 'Empleado', 'Motivo', 'Horas', 'Tipo', 'Estado', 'Revisado por', 'Fecha solicitud'],
    rows.map((r) => [
      r.date, r.employeeName || '', r.reason || '', String(r.hours).replace('.', ','), typeLabel(r.type),
      r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente',
      r.reviewerName || '—', r.createdAt ? fmtDate(r.createdAt) : '—',
    ]));
}

export default function HorasScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useAuth();
  const { hourCompensations, refresh } = useData();
  const [filter, setFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showDates, setShowDates] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mine = useMemo(() => hourCompensations.filter((h) => String(h.employeeId) === String(user?.id)), [hourCompensations, user?.id]);
  const inRange = mine.filter((h) => (!from || h.date >= from) && (!to || h.date <= to));
  const stats = hourStats(inRange);
  const rows = inRange
    .filter((h) => filter === 'all' || h.type === filter)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const total = stats.credit + stats.debe + stats.pending || 1;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <Screen tabBarSpace onRefresh={onRefresh} refreshing={refreshing}>
      <Header
        title="Horas"
        right={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {user?.role === 'admin' ? <IconButton icon={Users} size={40} onPress={() => navigation.navigate('AdminHours')} accessibilityLabel="Horas del equipo" /> : null}
            {rows.length ? (
              <IconButton icon={Download} size={40} accessibilityLabel="Descargar CSV" onPress={async () => {
                try { await exportHoursCsv(rows, `horas-${toISODate(new Date())}.csv`); } catch (e) { toast.error(toUserMessage(e)); }
              }} />
            ) : null}
            <GlassButton title="Registrar" icon={Plus} size="sm" onPress={() => navigation.navigate('NewHours')} />
          </View>
        )}
      />

      <GlassCard radius={26} padding={20} strong style={{ gap: 14 }}>
        <Label>Saldo aprobado{from || to ? ' · periodo filtrado' : ''}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <T mono weight="semibold" size={48} tracking={-2} style={{ lineHeight: 52 }} color={stats.balance < 0 ? colors.dangerFg : colors.text} numberOfLines={1} adjustsFontSizeToFit>
            {fmtHMSigned(stats.balance)}
          </T>
          <T size={15} color={colors.text3} style={{ paddingBottom: 8 }}>horas</T>
        </View>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
          <View style={{ flex: Math.max(0.0001, stats.credit / total), backgroundColor: colors.success }} />
          <View style={{ flex: Math.max(0.0001, stats.debe / total), backgroundColor: colors.danger }} />
          <View style={{ flex: Math.max(0.0001, stats.pending / total), backgroundColor: colors.warning }} />
        </View>
        <View style={{ gap: 8 }}>
          {[
            ['Ganadas', `+${fmtHM(stats.credit)}`, colors.success],
            ['Debo', `−${fmtHM(stats.debe)}`, colors.danger],
            ['En revisión', `+${fmtHM(stats.pending)}`, colors.warning],
          ].map(([label, value, c]) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
                <T size={14} color={colors.text2}>{label}</T>
              </View>
              <T mono weight="semibold" size={14}>{value}</T>
            </View>
          ))}
        </View>
      </GlassCard>

      <Segmented value={filter} onChange={setFilter} height={40}
        options={[{ value: 'all', label: 'Todo' }, { value: 'ya', label: 'Ya' }, { value: 'bolsa', label: 'Bolsa' }, { value: 'debe', label: 'Debo' }]} />

      <View style={{ gap: 10 }}>
        <Pressable onPress={() => setShowDates((s) => !s)} accessibilityRole="button" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T size={14} weight="medium" color={colors.accentFg}>{showDates ? 'Ocultar filtro de fechas' : 'Filtrar por fechas'}</T>
          <T size={13} color={colors.text3}>{rows.length} registro{rows.length === 1 ? '' : 's'}</T>
        </Pressable>
        {showDates ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DateField label="Desde" value={from} onChange={setFrom} style={{ flex: 1 }} placeholder="Inicio" />
              <DateField label="Hasta" value={to} onChange={setTo} style={{ flex: 1 }} placeholder="Hoy" />
            </View>
            {from || to ? <GlassButton title="Limpiar fechas" variant="ghost" size="sm" onPress={() => { setFrom(''); setTo(''); }} /> : null}
          </View>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        {rows.length === 0 ? (
          <EmptyState icon={Timer} title="No hay registros aún" message="Usa «Registrar» para añadir horas." />
        ) : rows.map((h) => <HourRow key={h.id} h={h} />)}
      </View>
    </Screen>
  );
}
