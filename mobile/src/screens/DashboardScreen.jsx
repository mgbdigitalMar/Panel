// 04/05/07 · Inicio
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Building2, Car, Timer, CalendarDays, Inbox, ShieldCheck, Pin, ChevronRight, Gift } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Screen } from '../components/common/Screen';
import { GlassCard } from '../components/common/GlassCard';
import { IconButton } from '../components/common/GlassButton';
import { PressScale } from '../components/common/Pressable';
import { Fab } from '../components/common/Fab';
import { StatusBadge, Tag } from '../components/common/StatusBadge';
import { T, Label } from '../components/common/Text';
import { Avatar, IconTile, Row } from '../components/common/UI';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import { buildRequestItems, hourStats, personalDaysSummary, requestTitle, requestDetail, REQUEST_TONE, reservationStatusLabel, reservationTone } from '../utils/domain';
import { fmtDayLong, fmtHMSigned, firstName, greeting, todayISO, fmtDate } from '../utils/format';
import { requestIcon } from '../utils/icons';

function Stat({ value, label, color, onPress }) {
  const { colors } = useTheme();
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <T mono weight="semibold" size={26} color={color || colors.text} tracking={-0.8} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      <T size={12} color={colors.text3} numberOfLines={2}>{label}</T>
    </PressScale>
  );
}

function QuickChip({ icon: Icon, label, onPress }) {
  const { colors } = useTheme();
  return (
    <PressScale onPress={onPress} accessibilityRole="button" style={{
      height: 40, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.glassBorderStrong,
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.glass,
    }}
    >
      <Icon size={18} color={colors.text} />
      <T size={14} weight="medium">{label}</T>
    </PressScale>
  );
}

const MONTHS_SPANISH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export default function DashboardScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { user, employees } = useAuth();
  const { requests, personalDays, reservations, hourCompensations, news, unreadCount, refresh } = useData();
  const pendingApprovals = usePendingApprovals();
  const [refreshing, setRefreshing] = useState(false);

  const today = todayISO();
  const days = personalDaysSummary(personalDays, user?.id);
  const myItems = useMemo(() => buildRequestItems(requests, personalDays, employees).filter((r) => r.employeeId === user?.id), [requests, personalDays, employees, user?.id]);
  const myPending = myItems.filter((r) => r.status === 'pending');
  const hours = hourStats(hourCompensations.filter((h) => String(h.employeeId) === String(user?.id)));
  const upcoming = reservations
    .filter((r) => r.employeeId === user?.id && r.date >= today && r.status !== 'cancelled')
    .sort((a, b) => (a.date + a.timeStart).localeCompare(b.date + b.timeStart))
    .slice(0, 3);
  const latestNews = news.filter((n) => n.isActive !== false).sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1)).slice(0, 4);

  const upcomingBirthdays = useMemo(() => {
    if (!employees || !employees.length) return [];
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDay = now.getDate();

    return employees
      .filter((e) => e.birthdate && String(e.birthdate).includes('-'))
      .map((e) => {
        const parts = String(e.birthdate).split('-');
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (isNaN(m) || isNaN(d)) return null;

        let nextBday = new Date(curYear, m - 1, d);
        if (m - 1 < curMonth || (m - 1 === curMonth && d < curDay)) {
          nextBday = new Date(curYear + 1, m - 1, d);
        }

        const diffTime = nextBday.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          ...e,
          daysLeft: Math.max(0, diffDays),
          bdDisplay: `${d} ${MONTHS_SPANISH[m - 1]}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3);
  }, [employees]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const agenda = [
    ...upcoming.map((r) => ({
      key: `r${r.id}`,
      icon: r.type === 'vehicle' ? Car : Building2,
      tone: r.type === 'vehicle' ? 'teal' : 'accent',
      title: r.resourceName,
      subtitle: `${r.date === today ? 'Hoy' : fmtDate(r.date, { year: false })} · ${r.timeStart}–${r.timeEnd}${r.purpose ? ` · ${r.purpose}` : ''}`,
      badge: <StatusBadge status={reservationTone(r.status)} label={reservationStatusLabel(r.status)} />,
      onPress: () => navigation.navigate('MyReservations', { scope: 'mine' }),
    })),
    ...myPending.slice(0, 2).map((r) => ({
      key: `q${r.type}${r.id}`,
      icon: requestIcon(r.type),
      tone: REQUEST_TONE[r.type],
      title: requestTitle(r),
      subtitle: requestDetail(r),
      badge: <StatusBadge status="pending" />,
      onPress: () => navigation.navigate('RequestDetail', { id: String(r.id), kind: r.type === 'asuntos_propios' ? 'asuntos_propios' : 'request' }),
    })),
  ];

  return (
    <Screen tabBarSpace onRefresh={onRefresh} refreshing={refreshing} fab={<Fab onPress={() => navigation.navigate('NewRequest')} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
        <Pressable onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel="Mi perfil">
          <Avatar name={user?.name} initials={user?.avatar} size={44} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T size={13} color={colors.text3}>{fmtDayLong(new Date())}</T>
          <T size={20} weight="semibold" numberOfLines={1}>{greeting()}, {firstName(user?.name)}</T>
        </View>
        <IconButton icon={Bell} badge={unreadCount} onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'} />
      </View>

      <GlassCard radius={26} padding={18} strong style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label>Tu resumen</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
            <T size={12} color={colors.successFg}>En directo</T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat value={days.left} label={`Días propios de ${days.total}`} onPress={() => navigation.navigate('NewRequest', { type: 'asuntos_propios' })} />
          <Stat value={myPending.length} label="Pendientes" color={colors.warningFg} onPress={() => navigation.navigate('Requests')} />
          <Stat value={fmtHMSigned(hours.balance)} label="Horas bolsa" color={hours.balance < 0 ? colors.dangerFg : colors.successFg} onPress={() => navigation.navigate('Horas')} />
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.segTrack, overflow: 'hidden' }}>
          <View style={{ width: `${days.total > 0 ? Math.min(100, Math.max(0, (days.left / days.total) * 100)) : 0}%`, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
        </View>
      </GlassCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        <QuickChip icon={Building2} label="Sala" onPress={() => navigation.navigate('Reservations', { tab: 'room' })} />
        <QuickChip icon={Car} label="Vehículo" onPress={() => navigation.navigate('Reservations', { tab: 'vehicle' })} />
        <QuickChip icon={Timer} label="Horas" onPress={() => navigation.navigate('NewHours')} />
        <QuickChip icon={CalendarDays} label="Mis reservas" onPress={() => navigation.navigate('MyReservations', { scope: 'mine' })} />
      </ScrollView>

      {user?.role === 'admin' && pendingApprovals.length > 0 ? (
        <GlassCard onPress={() => navigation.navigate('Admin')} tint={colors.accentSoft} border={colors.accentBorder} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <IconTile icon={ShieldCheck} tone="accent" />
          <View style={{ flex: 1 }}>
            <T size={15} weight="semibold">{pendingApprovals.length} pendiente{pendingApprovals.length === 1 ? '' : 's'} de aprobar</T>
            <T size={13} color={colors.text3}>Solicitudes, reservas y horas del equipo</T>
          </View>
          <ChevronRight size={20} color={colors.text3} />
        </GlassCard>
      ) : null}

      <View style={{ gap: 2 }}>
        <T size={16} weight="semibold" style={{ marginBottom: 8 }}>Próximo</T>
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
            left={<IconTile icon={a.icon} tone={a.tone} size={40} radius={20} />}
            title={a.title}
            subtitle={a.subtitle}
            subtitleLines={1}
            right={a.badge}
            onPress={a.onPress}
          />
        ))}
      </View>

      {upcomingBirthdays.length > 0 ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Gift size={18} color={colors.accentFg} />
            <T size={16} weight="semibold">Próximos cumpleaños</T>
          </View>
          <GlassCard padding={8} style={{ gap: 2 }}>
            {upcomingBirthdays.map((b, i) => (
              <View
                key={b.id || i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  borderBottomWidth: i === upcomingBirthdays.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <Avatar name={b.name} initials={b.avatar} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={14.5} weight="semibold" numberOfLines={1}>{b.name}</T>
                  <T size={12.5} color={colors.text3} numberOfLines={1}>{b.bdDisplay} · {b.dept || 'Margube'}</T>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor: b.daysLeft === 0 ? colors.warningSoft : colors.glassStrong,
                    borderWidth: 1,
                    borderColor: b.daysLeft === 0 ? colors.warningFg : colors.glassBorder,
                  }}
                >
                  <T size={12} weight="semibold" color={b.daysLeft === 0 ? colors.warningFg : colors.text2}>
                    {b.daysLeft === 0 ? '🎉 ¡Hoy!' : `en ${b.daysLeft}d`}
                  </T>
                </View>
              </View>
            ))}
          </GlassCard>
        </View>
      ) : null}

      {latestNews.length > 0 ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T size={17} weight="semibold">Comunicados</T>
            <Pressable onPress={() => navigation.navigate('News')} hitSlop={8} accessibilityRole="button">
              <T size={14} weight="medium" color={colors.accentFg}>Ver todo</T>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {latestNews.map((n) => (
              <GlassCard key={n.id} padding={0} radius={20} onPress={() => navigation.navigate('News', { id: n.id })} style={{ width: 272, overflow: 'hidden' }}>
                <View style={{ height: 76, backgroundColor: n.type === 'event' ? '#1E3A8A' : '#0F766E', padding: 12, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'flex-end' }}>
                  <Tag label={n.type === 'event' ? 'Evento' : n.category || 'Noticia'} tone="neutral" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }} />
                  {n.pinned ? <Pin size={16} color="#FFFFFF" fill="#FFFFFF" /> : null}
                </View>
                <View style={{ padding: 12, gap: 3 }}>
                  <T size={14} weight="semibold" numberOfLines={1}>{n.title}</T>
                  <T size={12} color={colors.text3} numberOfLines={1}>{n.content}</T>
                </View>
              </GlassCard>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </Screen>
  );
}

