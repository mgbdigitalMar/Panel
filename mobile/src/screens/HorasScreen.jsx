// 14 · Tiempo a compensar (tab "Mi Registro" of the web HorasPage)
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Plus, Download, Users, Timer, Clock, CheckCircle2, Minus, XCircle } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { TopBar } from '../components/common/TopBar';
import { GlassButton, IconButton } from '../components/common/GlassButton';
import { DateField } from '../components/common/GlassInput';
import { Tag } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { EmptyState, Segmented, IconTile } from '../components/common/UI';
import { GlassCard } from '../components/common/GlassCard';
import { BrandPanel, ON_BRAND } from '../components/common/Brand';
import { hourStats, HOUR_LABEL, HOUR_TONE } from '../utils/domain';
import { fmtHM, fmtHMSigned, parseDate, MONTHS_SHORT, DAYS, toISODate, fmtDate } from '../utils/format';
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

/** A record of "Registros" (one line of the grouped card): the state's icon, the type, the day and the amount. */
function HourItem({ h, first }) {
  const { colors } = useTheme();
  const d = parseDate(h.date);
  const owed = h.type === 'debe';
  const state = h.status === 'rejected' ? ['danger', XCircle, colors.muted, 'Rechazada']
    : owed ? ['danger', Minus, colors.dangerFg, h.status === 'pending' ? 'En revisión' : 'Aprobada']
      : h.status === 'pending' ? ['amber', Clock, colors.warningFg, 'En revisión']
        : ['green', CheckCircle2, colors.successFg, h.type === 'ya' ? 'Compensada' : 'Aprobada'];
  const [tone, Icon, amtColor, stateText] = state;
  const weekday = d ? DAYS[d.getDay()] : '';
  const day = d ? `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : '—';
  return (
    <View
      accessible
      accessibilityLabel={`${HOUR_LABEL[h.type]}, ${day}, ${stateText}, ${owed ? 'menos' : 'más'} ${fmtHM(h.hours)} horas${h.reason ? `. ${h.reason}` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: colors.divider }}
    >
      <IconTile icon={Icon} tone={tone} size={38} />
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <T size={14.5} weight="semibold" numberOfLines={1}>{HOUR_LABEL[h.type]}</T>
        <T size={12.5} color={colors.text3} numberOfLines={1}>{day} · {stateText}{h.reason ? ` · ${h.reason}` : ''}</T>
      </View>
      <T mono weight="semibold" size={15} color={amtColor} style={h.status === 'rejected' ? { textDecorationLine: 'line-through' } : null}>
        {owed ? '−' : '+'}{fmtHM(h.hours)}
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
  const [showFilters, setShowFilters] = useState(false);
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
      <TopBar />
      <Header
        title="Horas"
        right={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {user?.role === 'admin' ? <IconButton icon={Users} onPress={() => navigation.navigate('AdminHours')} accessibilityLabel="Horas del equipo" /> : null}
            {rows.length ? (
              <IconButton icon={Download} accessibilityLabel="Descargar CSV" onPress={async () => {
                try { await exportHoursCsv(rows, `horas-${toISODate(new Date())}.csv`); } catch (e) { toast.error(toUserMessage(e)); }
              }} />
            ) : null}
            <GlassButton title="Registrar" icon={Plus} size="sm" onPress={() => navigation.navigate('NewHours')} />
          </View>
        )}
      />

      <BrandPanel padding={20} style={{ gap: 14 }}>
        <T size={12} weight="semibold" color={ON_BRAND.text2} upper>Saldo aprobado{from || to ? ' · periodo filtrado' : ''}</T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <T mono weight="semibold" size={48} style={{ lineHeight: 56, flexShrink: 1 }} color={stats.balance < 0 ? '#FB7185' : ON_BRAND.text} numberOfLines={1} adjustsFontSizeToFit>
            {fmtHMSigned(stats.balance)}
          </T>
          <T size={15} color={ON_BRAND.text3} style={{ paddingBottom: 10 }}>horas</T>
        </View>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, backgroundColor: ON_BRAND.track }}>
          {stats.credit > 0 ? <View style={{ flex: stats.credit / total, backgroundColor: '#34D399' }} /> : null}
          {stats.debe > 0 ? <View style={{ flex: stats.debe / total, backgroundColor: '#FB7185' }} /> : null}
          {stats.pending > 0 ? <View style={{ flex: stats.pending / total, backgroundColor: '#F5B544' }} /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            ['Ganadas', `+${fmtHM(stats.credit)}`, '#34D399'],
            ['Debo', `−${fmtHM(stats.debe)}`, '#FB7185'],
            ['En revisión', `+${fmtHM(stats.pending)}`, '#F5B544'],
          ].map(([label, value, c]) => (
            <View key={label} style={{ flex: 1, minWidth: 0, gap: 3 }} accessible accessibilityLabel={`${label}: ${value}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
                <T size={12.5} color={ON_BRAND.text2} numberOfLines={1}>{label}</T>
              </View>
              <T mono weight="semibold" size={15} color={ON_BRAND.text} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
            </View>
          ))}
        </View>
      </BrandPanel>

      {/* Registros: one grouped card; type and dates filters fold behind "Filtrar" */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
          <T size={15} heading weight="semibold" accessibilityRole="header">Registros</T>
          <Pressable onPress={() => setShowFilters((x) => !x)} accessibilityRole="button" accessibilityState={{ expanded: showFilters }} hitSlop={10}>
            <T size={14} weight="semibold" color={colors.accentFg}>
              {showFilters ? 'Ocultar filtros' : filter !== 'all' || from || to ? 'Filtros activos' : 'Filtrar'}
            </T>
          </Pressable>
        </View>
        {showFilters ? (
          <View style={{ gap: 10 }}>
            <Segmented value={filter} onChange={setFilter} height={40}
              options={[{ value: 'all', label: 'Todo' }, { value: 'ya', label: 'Ya' }, { value: 'bolsa', label: 'Bolsa' }, { value: 'debe', label: 'Debo' }]} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DateField label="Desde" value={from} onChange={setFrom} style={{ flex: 1 }} placeholder="Inicio" />
              <DateField label="Hasta" value={to} onChange={setTo} style={{ flex: 1 }} placeholder="Hoy" />
            </View>
            {filter !== 'all' || from || to ? (
              <GlassButton title="Quitar filtros" variant="ghost" size="sm" onPress={() => { setFilter('all'); setFrom(''); setTo(''); }} />
            ) : null}
          </View>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState icon={Timer} title="No hay registros aún" message="Usa «Registrar» para añadir horas." />
        ) : (
          <GlassCard padding={0}>
            {rows.map((h, i) => <HourItem key={h.id} h={h} first={i === 0} />)}
          </GlassCard>
        )}
      </View>
    </Screen>
  );
}
