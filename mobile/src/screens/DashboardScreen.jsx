// Inicio: hero card for the day, a bento row (days left, hour balance), the week as capsule bars,
// quick access, agenda, news and birthdays.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Building2, Car, Timer, CalendarDays, Inbox, ShieldCheck, Pin, ChevronRight, Gift, Newspaper, Clock, CalendarCheck, Hourglass,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Screen } from '../components/common/Screen';
import { TopBar } from '../components/common/TopBar';
import { GlassCard } from '../components/common/GlassCard';
import { PressScale } from '../components/common/Pressable';
import { StatusBadge } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { BrandPanel, HeroCard, HeroChip, ON_BRAND } from '../components/common/Brand';
import { AccentTile, BigFigure, CapsuleBars, InfoTile } from '../components/common/Bento';
import { ActionGrid, Avatar, IconTile, Pill, ProgressBar, Row, SectionHead, WashCard } from '../components/common/UI';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import { buildRequestItems, hourStats, personalDaysSummary, requestTitle, requestDetail, REQUEST_TONE, reservationStatusLabel, reservationTone } from '../utils/domain';
import { fmtHM, fmtHMSigned, firstName, greeting, todayISO, fmtDate, parseDate, toISODate, addDays, startOfWeek, MONTHS, MONTHS_SHORT, DAYS, DAYS_SHORT } from '../utils/format';
import { workdayProgress, isWeekend, motivationFor } from '../utils/workday';
import { requestIcon } from '../utils/icons';
import { BRAND } from '../theme/tokens';

/** Re-renders once a minute so the greeting, hero and rings stay current. */
function useNow(interval = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

function HeroMeta({ icon: Icon, value, label, color, onPress }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} scaleTo={0.94}
      hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }}>
      <Icon size={16} color={color || ON_BRAND.text2} strokeWidth={2} />
      <T size={14} weight="semibold" color={ON_BRAND.text} numberOfLines={1}>{value}</T>
    </PressScale>
  );
}

/** Mon–Fri as capsules filled with the workday: past days full, today partial, future empty. */
function WeekCapsules({ now, busyDays }) {
  const today = toISODate(now);
  const monday = startOfWeek(now);
  const items = [0, 1, 2, 3, 4].map((i) => {
    const d = addDays(monday, i);
    const iso = toISODate(d);
    const value = iso < today ? 100 : iso === today ? workdayProgress(now) : 0;
    const isToday = iso === today;
    const busy = busyDays.has(iso);
    return {
      key: iso,
      label: `${DAYS_SHORT[d.getDay()]} ${d.getDate()}`,
      value,
      highlight: isToday,
      dot: busy,
      accessibilityLabel: `${DAYS[d.getDay()]} ${d.getDate()}${isToday ? ', hoy' : ''}, jornada ${Math.round(value)}%${busy ? ', con reservas o solicitudes' : ''}`,
    };
  });
  return <CapsuleBars items={items} height={104} width={16} />;
}

/** The first agenda card is washed in brand blue. */
function AgendaCard({ item, highlight }) {
  const { colors } = useTheme();
  const body = (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon={item.icon} tone={highlight ? 'neutral' : item.tone} size={46} solid={highlight} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T size={15.5} weight="semibold" numberOfLines={1}>{item.title}</T>
          <T size={13} color={colors.text3} numberOfLines={1}>{item.subtitle}</T>
        </View>
        {item.badge}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pill label={item.time} mono={item.timeMono} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <T size={13} weight="medium" color={colors.text2}>{item.when}</T>
          <ChevronRight size={16} color={colors.text2} />
        </View>
      </View>
    </View>
  );
  if (highlight) return <WashCard onPress={item.onPress} accessibilityLabel={`${item.title}, ${item.time}, ${item.when}`}>{body}</WashCard>;
  return <GlassCard onPress={item.onPress} radius={24} accessibilityLabel={`${item.title}, ${item.time}, ${item.when}`}>{body}</GlassCard>;
}

function NewsRow({ n, onPress, first, last }) {
  const { colors } = useTheme();
  const d = parseDate(n.date || n.createdAt);
  const event = n.type === 'event';
  return (
    <Row
      first={first}
      last={last}
      onPress={onPress}
      left={(
        <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: event ? colors.warningSoft : colors.accentSoft }}>
          <T size={16} weight="semibold" heading color={event ? colors.warningFg : colors.accentFg} style={{ lineHeight: 18 }}>{d ? d.getDate() : '—'}</T>
          <T size={10.5} weight="semibold" color={event ? colors.warningFg : colors.accentFg}>{d ? MONTHS_SHORT[d.getMonth()] : ''}</T>
        </View>
      )}
      title={(
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {n.pinned ? <Pin size={13} color={colors.accentFg} fill={colors.accentFg} /> : null}
          <T size={14.5} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{n.title}</T>
        </View>
      )}
      subtitle={[event ? 'Evento' : n.category || 'Noticia', n.authorName].filter(Boolean).join(' · ')}
      subtitleLines={1}
      right={<ChevronRight size={18} color={colors.text3} />}
    />
  );
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { user, employees } = useAuth();
  const { requests, personalDays, reservations, hourCompensations, news, refresh } = useData();
  const pendingApprovals = usePendingApprovals();
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow();

  const today = todayISO();
  const days = personalDaysSummary(personalDays, user?.id);
  const myItems = useMemo(() => buildRequestItems(requests, personalDays, employees).filter((r) => r.employeeId === user?.id), [requests, personalDays, employees, user?.id]);
  const myPending = myItems.filter((r) => r.status === 'pending');
  const hours = hourStats(hourCompensations.filter((h) => String(h.employeeId) === String(user?.id)));
  const myReservations = reservations.filter((r) => r.employeeId === user?.id && r.status !== 'cancelled' && r.status !== 'rejected');
  const allUpcoming = myReservations
    .filter((r) => r.date >= today)
    .sort((a, b) => (a.date + a.timeStart).localeCompare(b.date + b.timeStart));
  const upcoming = allUpcoming.slice(0, 3);
  const latestNews = useMemo(() => news
    .filter((n) => n.isActive !== false)
    .sort((a, b) => (b.pinned === true) - (a.pinned === true) || String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt)))
    .slice(0, 3), [news]);

  // Days this week with a reservation or an approved remote/external day (dot under the ring)
  const busyDays = new Set(myReservations.map((r) => r.date));
  for (let i = 0; i < 5; i += 1) {
    const iso = toISODate(addDays(startOfWeek(now), i));
    if (myItems.some((r) => r.status === 'approved' && r.startDate && iso >= r.startDate && iso <= (r.endDate || r.startDate))) busyDays.add(iso);
  }

  const weekBusy = [0, 1, 2, 3, 4].filter((i) => busyDays.has(toISODate(addDays(startOfWeek(now), i)))).length;

  const upcomingBirthdays = useMemo(() => {
    if (!employees || !employees.length) return [];
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return employees
      .filter((e) => e.birthdate && String(e.birthdate).includes('-'))
      .map((e) => {
        const [, m, d] = String(e.birthdate).slice(0, 10).split('-').map((x) => parseInt(x, 10));
        if (!m || !d) return null;
        let next = new Date(midnight.getFullYear(), m - 1, d);
        if (next < midnight) next = new Date(midnight.getFullYear() + 1, m - 1, d);
        const daysLeft = Math.round((next - midnight) / 86400000);
        return { ...e, daysLeft, bdDisplay: `${d} ${MONTHS_SHORT[m - 1]}` };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3);
  }, [employees]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  const agenda = [
    ...upcoming.map((r) => ({
      key: `r${r.id}`,
      icon: r.type === 'vehicle' ? Car : Building2,
      tone: r.type === 'vehicle' ? 'teal' : 'accent',
      title: r.resourceName,
      subtitle: r.purpose || (r.type === 'vehicle' ? 'Reserva de vehículo' : 'Reserva de sala'),
      time: `${r.timeStart}–${r.timeEnd}`,
      timeMono: true,
      when: r.date === today ? 'Hoy' : fmtDate(r.date, { year: false }),
      badge: <StatusBadge status={reservationTone(r.status)} label={reservationStatusLabel(r.status)} small />,
      onPress: () => navigation.navigate('MyReservations', { scope: 'mine' }),
    })),
    ...myPending.slice(0, 2).map((r) => ({
      key: `q${r.type}${r.id}`,
      icon: requestIcon(r.type),
      tone: REQUEST_TONE[r.type],
      title: requestTitle(r),
      subtitle: requestDetail(r),
      time: 'En revisión',
      when: 'Ver solicitud',
      badge: <StatusBadge status="pending" small />,
      onPress: () => navigation.navigate('RequestDetail', { id: String(r.id), kind: r.type === 'asuntos_propios' ? 'asuntos_propios' : 'request' }),
    })),
  ];

  const progress = workdayProgress(now);
  const weekend = isWeekend(now);
  const status = weekend ? 'Fin de semana' : progress >= 100 ? 'Jornada completada' : progress <= 0 ? 'Antes de jornada' : 'En curso';
  const workdayText = weekend ? 'Disfruta del descanso' : progress >= 100 ? '¡Buen trabajo hoy!' : progress <= 0 ? 'La jornada empieza a las 8:00' : motivationFor(now);
  const endsAt = now.getDay() === 5 ? '14:30' : '17:00';

  return (
    <Screen tabBarSpace onRefresh={onRefresh} refreshing={refreshing}>
      <TopBar />

      <View style={{ gap: 2 }}>
        <T size={14} color={colors.text3}>{greeting(now)},</T>
        <T size={36} weight="light" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} accessibilityRole="header">
          {firstName(user?.name)}
        </T>
      </View>

      <HeroCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <HeroChip label={status} dot={weekend || progress >= 100 ? '#B8BEC9' : progress <= 0 ? '#F5B544' : '#34D399'} />
          <T mono weight="semibold" size={14} color={ON_BRAND.text}>{Math.round(progress)}%</T>
        </View>
        <View style={{ flex: 1, minHeight: 36 }} />
        <View style={{ gap: 10 }}>
          <View>
            <T size={13} weight="medium" color={ON_BRAND.text2} upper>{DAYS[now.getDay()]}, {now.getDate()} de {MONTHS[now.getMonth()]}</T>
            <T size={29} weight="light" color={ON_BRAND.text} numberOfLines={2}>{workdayText}</T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 }}>
            <HeroMeta icon={Clock} value={weekend ? 'Libre' : `8:00–${endsAt}`} label="Horario de hoy" onPress={() => navigation.navigate('Horas')} />
          </View>
          <ProgressBar value={progress} track={ON_BRAND.track} color="#FFFFFF" height={6} accessibilityLabel="Progreso de jornada laboral" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={13} color={ON_BRAND.text2}>{myPending.length ? `${myPending.length} solicitud${myPending.length === 1 ? '' : 'es'} en revisión` : 'Nada pendiente'}</T>
            <Pressable onPress={() => navigation.navigate('Requests')} accessibilityRole="button" hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}>
              <T size={13.5} weight="semibold" color={ON_BRAND.text}>Mis solicitudes</T>
              <ChevronRight size={16} color={ON_BRAND.text} />
            </Pressable>
          </View>
        </View>
      </HeroCard>

      {/* Bento: the days left stand out in brand blue, the hour balance beside them in glass */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AccentTile
          icon={CalendarCheck}
          label="Días propios"
          value={`${days.left}/${days.total}`}
          sub="Disponibles este año"
          style={{ flex: 1.1 }}
          onPress={() => navigation.navigate('NewRequest', { type: 'asuntos_propios' })}
          accessibilityLabel={`Días propios disponibles: ${days.left} de ${days.total}`}
        />
        <InfoTile
          icon={Hourglass}
          label="Bolsa de horas"
          value={fmtHMSigned(hours.balance)}
          valueColor={hours.balance < 0 ? colors.dangerFg : colors.text}
          sub={hours.pending ? `+${fmtHM(hours.pending)} en revisión` : 'Ver registro'}
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('Horas')}
        />
      </View>

      <GlassCard padding={18} style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
            <T size={15} weight="semibold" accessibilityRole="header">Esta semana</T>
            <T size={13} color={colors.text3}>{MONTHS[startOfWeek(now).getMonth()]} {startOfWeek(now).getDate()}–{addDays(startOfWeek(now), 4).getDate()}</T>
          </View>
          <BigFigure value={String(weekBusy)} unit={weekBusy === 1 ? 'día con agenda' : 'días con agenda'} size={28}
            accessibilityLabel={`${weekBusy} días con reservas o solicitudes esta semana`} />
        </View>
        <WeekCapsules now={now} busyDays={busyDays} />
      </GlassCard>

      {user?.role === 'admin' && pendingApprovals.length > 0 ? (
        <PressScale onPress={() => navigation.navigate('Admin')} accessibilityRole="button" scaleTo={0.98}
          accessibilityLabel={`${pendingApprovals.length} pendientes de aprobar`}>
          <BrandPanel padding={20} radius={28} rings={false} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
              <T size={15.5} weight="semibold" color={ON_BRAND.text} style={{ flex: 1 }}>Por aprobar</T>
              <ShieldCheck size={18} color={ON_BRAND.text2} />
            </View>
            <T size={13} color={ON_BRAND.text2} style={{ maxWidth: 260 }}>Solicitudes, reservas y horas del equipo esperando tu revisión.</T>
            <View style={{ marginVertical: 4, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)' }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <BigFigure value={String(pendingApprovals.length)} unit={`pendiente${pendingApprovals.length === 1 ? '' : 's'}`} size={40}
                color={ON_BRAND.text} unitColor={ON_BRAND.text2} />
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={20} color={BRAND.navy} />
              </View>
            </View>
          </BrandPanel>
        </PressScale>
      ) : null}

      <View style={{ gap: 10 }}>
        <SectionHead title="Accesos rápidos" />
        <ActionGrid
          items={[
            { key: 'room', icon: Building2, tone: 'accent', label: 'Reservar sala', sub: 'Salas de reunión', onPress: () => navigation.navigate('Reservations', { tab: 'room' }) },
            { key: 'vehicle', icon: Car, tone: 'teal', label: 'Reservar vehículo', sub: 'Coches de empresa', onPress: () => navigation.navigate('Reservations', { tab: 'vehicle' }) },
            { key: 'hours', icon: Timer, tone: 'purple', label: 'Registrar horas', sub: `Saldo ${fmtHMSigned(hours.balance)}`, onPress: () => navigation.navigate('NewHours') },
            { key: 'mine', icon: CalendarDays, tone: 'amber', label: 'Mis reservas', sub: allUpcoming.length ? `${allUpcoming.length} próxima${allUpcoming.length === 1 ? '' : 's'}` : 'Sin reservas próximas', onPress: () => navigation.navigate('MyReservations', { scope: 'mine' }) },
          ]}
        />
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
          <T size={15} weight="semibold" accessibilityRole="header">Agenda</T>
          <T size={13.5} color={colors.text3}>Hoy, {now.getDate()} {MONTHS_SHORT[now.getMonth()]}</T>
        </View>
        {agenda.length === 0 ? (
          <GlassCard radius={24} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile icon={Inbox} tone="neutral" size={46} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={15} weight="semibold">Nada pendiente</T>
              <T size={13} color={colors.text3}>No tienes reservas próximas ni solicitudes en revisión.</T>
            </View>
          </GlassCard>
        ) : agenda.map((a, i) => <AgendaCard key={a.key} item={a} highlight={i === 0} />)}
      </View>

      {latestNews.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHead title="Comunicados" action="Ver todos" onAction={() => navigation.navigate('News')} />
          <View style={{ gap: 6 }}>
            {latestNews.map((n) => (
              <NewsRow key={n.id} n={n} onPress={() => navigation.navigate('News', { id: n.id })} />
            ))}
          </View>
        </View>
      ) : (
        <GlassCard onPress={() => navigation.navigate('News')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }} accessibilityLabel="Comunicados">
          <IconTile icon={Newspaper} tone="neutral" />
          <T size={14} color={colors.text3} style={{ flex: 1 }}>No hay comunicados nuevos.</T>
          <ChevronRight size={18} color={colors.text3} />
        </GlassCard>
      )}

      {upcomingBirthdays.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHead title="Cumpleaños" icon={Gift} />
          <GlassCard padding={6} radius={24}>
            {upcomingBirthdays.map((b, i) => {
              const isToday = b.daysLeft === 0;
              return (
                <View
                  key={b.id || i}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10,
                    borderBottomWidth: i === upcomingBirthdays.length - 1 ? 0 : 1, borderBottomColor: colors.divider,
                  }}
                >
                  <Avatar name={b.name} initials={b.avatar} src={b.avatarUrl} size={40} />
                  <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                    <T size={14.5} weight="semibold" numberOfLines={1}>{b.name}</T>
                    <T size={12.5} color={colors.text3} numberOfLines={1}>{b.bdDisplay} · {b.dept || 'Margube'}</T>
                  </View>
                  <Pill label={isToday ? '¡Hoy! 🎉' : b.daysLeft === 1 ? 'Mañana' : `en ${b.daysLeft} días`} tone={isToday ? 'amber' : undefined} />
                </View>
              );
            })}
          </GlassCard>
        </View>
      ) : null}
    </Screen>
  );
}
