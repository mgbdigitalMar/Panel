// 14 · Tiempo a compensar (tab "Mi Registro" of the web HorasPage): the balance as a big figure,
// proportion pills, a month calendar of records with the chosen day in a dark card, then the list.
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
import { PressScale } from '../components/common/Pressable';
import { BigFigure, MonthCalendar, MonthSwitcher, SplitPills } from '../components/common/Bento';
import { BRAND, tone as toneOf } from '../theme/tokens';
import { hourStats, HOUR_LABEL, HOUR_TONE } from '../utils/domain';
import { fmtHM, fmtHMSigned, parseDate, MONTHS_SHORT, DAYS, toISODate, todayISO, fmtDate } from '../utils/format';
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
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [day, setDay] = useState(todayISO);

  const mine = useMemo(() => hourCompensations.filter((h) => String(h.employeeId) === String(user?.id)), [hourCompensations, user?.id]);
  const inRange = mine.filter((h) => (!from || h.date >= from) && (!to || h.date <= to));
  const stats = hourStats(inRange);
  const rows = inRange
    .filter((h) => filter === 'all' || h.type === filter)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Calendar marks: owed hours in rose, waiting for admin in amber, earned in brand blue
  const marks = useMemo(() => {
    const byDay = {};
    mine.forEach((h) => {
      if (!h.date || h.status === 'rejected') return;
      if (!byDay[h.date]) byDay[h.date] = [];
      byDay[h.date].push(h);
    });
    const out = {};
    Object.entries(byDay).forEach(([iso, list]) => {
      const t = list.some((h) => h.type === 'debe') ? 'rose' : list.some((h) => h.status === 'pending') ? 'amber' : 'accent';
      const [bg, fg] = toneOf(colors, t);
      const net = list.reduce((sum, h) => sum + (h.type === 'debe' ? -1 : 1) * (Number(h.hours) || 0), 0);
      out[iso] = { bg, fg, dot: fg, label: `${fmtHMSigned(net)} horas` };
    });
    return out;
  }, [mine, colors]);

  const dayRows = mine.filter((h) => h.date === day);
  const dayNet = dayRows.filter((h) => h.status !== 'rejected')
    .reduce((sum, h) => sum + (h.type === 'debe' ? -1 : 1) * (Number(h.hours) || 0), 0);
  const dayDate = parseDate(day);
  const dayTitle = dayDate ? `${DAYS[dayDate.getDay()].charAt(0).toUpperCase()}${DAYS[dayDate.getDay()].slice(1)} ${dayDate.getDate()} ${MONTHS_SHORT[dayDate.getMonth()]}` : '';

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

      <View style={{ gap: 2 }}>
        <T size={12} weight="semibold" color={colors.text3} upper>Saldo aprobado{from || to ? ' · periodo filtrado' : ''}</T>
        <BigFigure value={fmtHMSigned(stats.balance)} unit="horas" size={54} color={stats.balance < 0 ? colors.dangerFg : colors.text}
          accessibilityLabel={`Saldo aprobado: ${fmtHMSigned(stats.balance)} horas`} />
      </View>

      <SplitPills
        items={[
          { label: 'Ganadas', value: stats.credit, display: `+${fmtHM(stats.credit)}`, bg: BRAND.blue, fg: '#FFFFFF' },
          { label: 'Debo', value: stats.debe, display: `−${fmtHM(stats.debe)}`, bg: colors.plateBg, fg: colors.plateText },
          { label: 'En revisión', value: stats.pending, display: `+${fmtHM(stats.pending)}`, bg: colors.warningSoft, fg: colors.warningFg },
        ]}
      />

      <GlassCard padding={14} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingLeft: 4 }}>
          <T size={15} heading weight="semibold" accessibilityRole="header">Calendario</T>
          <MonthSwitcher value={cursor} onChange={(m) => { setCursor(m); setDay(null); }} />
        </View>
        <MonthCalendar month={cursor} marks={marks} selected={day} onSelect={(iso) => setDay((d) => (d === iso ? null : iso))} />
      </GlassCard>

      {/* The chosen day in the dark brand card: its records and the net amount */}
      {day ? (
        <BrandPanel padding={20} radius={28} rings={false} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
            <T size={15.5} weight="semibold" color={ON_BRAND.text} style={{ flex: 1 }}>{day === todayISO() ? `Hoy · ${dayTitle}` : dayTitle}</T>
          </View>
          {dayRows.length ? dayRows.map((h) => (
            <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={14} weight="semibold" color={ON_BRAND.text} numberOfLines={1}>{HOUR_LABEL[h.type]} · {hourStateText(h)}</T>
                {h.reason ? <T size={12.5} color={ON_BRAND.text2} numberOfLines={2}>{h.reason}</T> : null}
              </View>
              <T mono weight="semibold" size={15} color={ON_BRAND.text} style={h.status === 'rejected' ? { textDecorationLine: 'line-through', opacity: 0.6 } : null}>
                {h.type === 'debe' ? '−' : '+'}{fmtHM(h.hours)}
              </T>
            </View>
          )) : (
            <T size={13} color={ON_BRAND.text2}>Sin registros este día.</T>
          )}
          <View style={{ marginVertical: 2, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <BigFigure value={fmtHMSigned(dayNet)} unit="h · neto" size={34} color={dayNet < 0 ? '#FB7185' : ON_BRAND.text} unitColor={ON_BRAND.text2}
              accessibilityLabel={`Neto del día: ${fmtHMSigned(dayNet)} horas`} />
            <PressScale onPress={() => navigation.navigate('NewHours', { date: day })} accessibilityRole="button" accessibilityLabel="Registrar horas este día"
              style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Plus size={17} color={BRAND.navy} strokeWidth={2.2} />
              <T size={14} weight="semibold" color={BRAND.navy}>Registrar</T>
            </PressScale>
          </View>
        </BrandPanel>
      ) : null}

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
