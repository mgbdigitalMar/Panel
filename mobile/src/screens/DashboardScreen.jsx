// Inicio — the web's dashboard for a phone: greeting, the day in a brand panel,
// quick actions, what's next, news and birthdays.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Building2, Car, Timer, CalendarDays, Inbox, ShieldCheck, Pin, ChevronRight, Gift, Newspaper } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Screen } from '../components/common/Screen';
import { GlassCard } from '../components/common/GlassCard';
import { IconButton } from '../components/common/GlassButton';
import { PressScale } from '../components/common/Pressable';
import { Fab } from '../components/common/Fab';
import { StatusBadge } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { BrandPanel, ON_BRAND } from '../components/common/Brand';
import { ActionGrid, Avatar, IconTile, ProgressBar, Row, SectionHead } from '../components/common/UI';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import { buildRequestItems, hourStats, personalDaysSummary, requestTitle, requestDetail, REQUEST_TONE, reservationStatusLabel, reservationTone } from '../utils/domain';
import { fmtDayLong, fmtHMSigned, firstName, greeting, todayISO, fmtDate, parseDate, MONTHS_SHORT } from '../utils/format';
import { workdayProgress, isWeekend, motivationFor } from '../utils/workday';
import { requestIcon } from '../utils/icons';

/** Re-renders once a minute so the greeting and workday bar stay current. */
function useNow(interval = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

/** A figure on the brand panel. */
function BrandStat({ value, label, color, onPress }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} scaleTo={0.95}
      style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <T mono weight="semibold" size={26} color={color || ON_BRAND.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</T>
      <T size={12} color={ON_BRAND.text3} numberOfLines={2}>{label}</T>
    </PressScale>
  );
}

/** News row with a date tile (web: newsRow). */
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
        <View style={{ width: 48, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: event ? colors.warningSoft : colors.accentSoft }}>
          <T size={18} weight="semibold" heading color={event ? colors.warningFg : colors.accentFg} style={{ lineHeight: 20 }}>{d ? d.getDate() : '—'}</T>
          <T size={11.5} weight="semibold" color={event ? colors.warningFg : colors.accentFg}>{d ? MONTHS_SHORT[d.getMonth()] : ''}</T>
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
  const { requests, personalDays, reservations, hourCompensations, news, unreadCount, refresh } = useData();
  const pendingApprovals = usePendingApprovals();
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow();

  const today = todayISO();
  const days = personalDaysSummary(personalDays, user?.id);
  const myItems = useMemo(() => buildRequestItems(requests, personalDays, employees).filter((r) => r.employeeId === user?.id), [requests, personalDays, employees, user?.id]);
  const myPending = myItems.filter((r) => r.status === 'pending');
  const hours = hourStats(hourCompensations.filter((h) => String(h.employeeId) === String(user?.id)));
  const allUpcoming = reservations
    .filter((r) => r.employeeId === user?.id && r.date >= today && r.status !== 'cancelled' && r.status !== 'rejected')
    .sort((a, b) => (a.date + a.timeStart).localeCompare(b.date + b.timeStart));
  const upcoming = allUpcoming.slice(0, 3);
  const latestNews = useMemo(() => news
    .filter((n) => n.isActive !== false)
    .sort((a, b) => (b.pinned === true) - (a.pinned === true) || String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt)))
    .slice(0, 3), [news]);

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
      subtitle: `${r.date === today ? 'Hoy' : fmtDate(r.date, { year: false })} · ${r.timeStart}–${r.timeEnd}${r.purpose ? ` · ${r.purpose}` : ''}`,
      badge: <StatusBadge status={reservationTone(r.status)} label={reservationStatusLabel(r.status)} small />,
      onPress: () => navigation.navigate('MyReservations', { scope: 'mine' }),
    })),
    ...myPending.slice(0, 2).map((r) => ({
      key: `q${r.type}${r.id}`,
      icon: requestIcon(r.type),
      tone: REQUEST_TONE[r.type],
      title: requestTitle(r),
      subtitle: requestDetail(r),
      badge: <StatusBadge status="pending" small />,
      onPress: () => navigation.navigate('RequestDetail', { id: String(r.id), kind: r.type === 'asuntos_propios' ? 'asuntos_propios' : 'request' }),
    })),
  ];

  const progress = workdayProgress(now);
  const weekend = isWeekend(now);
  const workdayText = weekend ? 'Fin de semana' : progress >= 100 ? 'Jornada completada' : progress <= 0 ? 'La jornada empieza a las 8:00' : motivationFor(now);
  const daysPct = days.total > 0 ? (days.left / days.total) * 100 : 0;

  return (
    <Screen tabBarSpace onRefresh={onRefresh} refreshing={refreshing} fab={<Fab onPress={() => navigation.navigate('NewRequest')} />}>
      {/* Greeting */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
        <Pressable onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel="Mi perfil" hitSlop={4}>
          <Avatar name={user?.name} initials={user?.avatar} src={user?.avatarUrl} size={46} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={13} weight="medium" color={colors.text3} numberOfLines={1}>{fmtDayLong(now)}</T>
          <T size={22} weight="semibold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} accessibilityRole="header">
            {greeting(now)}, {firstName(user?.name)}
          </T>
        </View>
        <IconButton icon={Bell} badge={unreadCount} onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'} />
      </View>

      {/* The day — the one brand panel on this screen */}
      <BrandPanel padding={20} style={{ gap: 16 }}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: weekend || progress >= 100 ? ON_BRAND.text3 : '#34D399' }} />
              <T size={12} weight="semibold" color={ON_BRAND.text2} upper>Tu jornada</T>
            </View>
            <T mono weight="semibold" size={14} color={ON_BRAND.text}>{Math.round(progress)}%</T>
          </View>
          <ProgressBar value={progress} gradient track={ON_BRAND.track} accessibilityLabel="Progreso de jornada laboral" />
          <T size={13.5} color={ON_BRAND.text2} numberOfLines={1}>{workdayText}</T>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <BrandStat value={`${days.left}/${days.total}`} label="Días propios" onPress={() => navigation.navigate('NewRequest', { type: 'asuntos_propios' })} />
          <BrandStat value={myPending.length} label="Pendientes" color={myPending.length ? '#F5B544' : undefined} onPress={() => navigation.navigate('Requests')} />
          <BrandStat value={fmtHMSigned(hours.balance)} label="Bolsa de horas" color={hours.balance < 0 ? '#FB7185' : '#34D399'} onPress={() => navigation.navigate('Horas')} />
        </View>
        <ProgressBar value={daysPct} color="#9DB4FF" track={ON_BRAND.track} height={4} accessibilityLabel={`Días propios disponibles: ${days.left} de ${days.total}`} />
      </BrandPanel>

      {/* Quick access */}
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

      {user?.role === 'admin' && pendingApprovals.length > 0 ? (
        <GlassCard onPress={() => navigation.navigate('Admin')} tint={colors.accentSoft} border={colors.accentBorder}
          accessibilityLabel={`${pendingApprovals.length} pendientes de aprobar`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <IconTile icon={ShieldCheck} tone="accent" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={15} weight="semibold">{pendingApprovals.length} pendiente{pendingApprovals.length === 1 ? '' : 's'} de aprobar</T>
            <T size={13} color={colors.text3} numberOfLines={1}>Solicitudes, reservas y horas del equipo</T>
          </View>
          <ChevronRight size={20} color={colors.accentFg} />
        </GlassCard>
      ) : null}

      {/* Next up */}
      <View style={{ gap: 10 }}>
        <SectionHead title="Próximo" action={agenda.length ? 'Mis reservas' : undefined} onAction={() => navigation.navigate('MyReservations', { scope: 'mine' })} />
        <View style={{ gap: 2 }}>
          {agenda.length === 0 ? (
            <Row
              left={<IconTile icon={Inbox} tone="neutral" />}
              title="Nada pendiente"
              subtitle="No tienes reservas próximas ni solicitudes en revisión."
            />
          ) : agenda.map((a, i) => (
            <Row
              key={a.key}
              first={i === 0}
              last={i === agenda.length - 1}
              left={<IconTile icon={a.icon} tone={a.tone} size={40} />}
              title={a.title}
              subtitle={a.subtitle}
              subtitleLines={1}
              right={a.badge}
              onPress={a.onPress}
            />
          ))}
        </View>
      </View>

      {/* News */}
      {latestNews.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHead title="Comunicados" action="Ver todos" onAction={() => navigation.navigate('News')} />
          <View style={{ gap: 2 }}>
            {latestNews.map((n, i) => (
              <NewsRow key={n.id} n={n} first={i === 0} last={i === latestNews.length - 1} onPress={() => navigation.navigate('News', { id: n.id })} />
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

      {/* Birthdays */}
      {upcomingBirthdays.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionHead title="Cumpleaños" icon={Gift} />
          <GlassCard padding={6}>
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
                  <Avatar name={b.name} initials={b.avatar} src={b.avatarUrl} size={38} />
                  <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                    <T size={14.5} weight="semibold" numberOfLines={1}>{b.name}</T>
                    <T size={12.5} color={colors.text3} numberOfLines={1}>{b.bdDisplay} · {b.dept || 'Margube'}</T>
                  </View>
                  <View style={{ paddingHorizontal: 10, height: 26, justifyContent: 'center', borderRadius: 13, backgroundColor: isToday ? colors.warningSoft : colors.neutralSoft }}>
                    <T size={12} weight="semibold" color={isToday ? colors.warningFg : colors.text2}>
                      {isToday ? '¡Hoy! 🎉' : b.daysLeft === 1 ? 'Mañana' : `en ${b.daysLeft} días`}
                    </T>
                  </View>
                </View>
              );
            })}
          </GlassCard>
        </View>
      ) : null}
    </Screen>
  );
}
