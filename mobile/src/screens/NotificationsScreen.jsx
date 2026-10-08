// 06 · Centro de notificaciones (NotificationsDropdown on the web)
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CalendarDays, ShoppingCart, FileText, Clock, Bell, CheckCheck, BellOff } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassButton } from '../components/common/GlassButton';
import { PressScale } from '../components/common/Pressable';
import { T, Label } from '../components/common/Text';
import { EmptyState, IconTile, Segmented } from '../components/common/UI';
import { openNotificationTarget } from '../navigation/notificationTarget';
import { dayBucket, fmtRelative } from '../utils/format';

const ENTITY_ICON = {
  reservation: CalendarDays,
  request: ShoppingCart,
  personal_day: CalendarDays,
  document: FileText,
  hour_compensation: Clock,
};

// Titles come with a leading emoji from the web ("✅ Solicitud aprobada"); the icon tile replaces it.
const clean = (s) => String(s || '').replace(/^[^0-9A-Za-zÀ-ÿ¿¡]+/, '');

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { params } = useRoute();
  const { user } = useAuth();
  const { notifications, unreadCount, markNotifRead, markAllNotifsRead, refresh } = useData();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Deep link margube://notificaciones/<id>
  useEffect(() => {
    if (!params?.id) return;
    const n = notifications.find((x) => String(x.id) === String(params.id));
    if (n) {
      markNotifRead(n.id);
      openNotificationTarget(navigation, n, user);
    }
  }, [params?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const list = notifications.filter((n) => filter === 'all' || !n.read);
    const out = {};
    list.forEach((n) => {
      const k = dayBucket(n.created_at);
      (out[k] = out[k] || []).push(n);
    });
    return ['Hoy', 'Ayer', 'Anteriores'].filter((k) => out[k]).map((k) => [k, out[k]]);
  }, [notifications, filter]);

  const open = (n) => {
    if (!n.read) markNotifRead(n.id);
    openNotificationTarget(navigation, n, user);
  };

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing}>
      <Header
        back
        title="Notificaciones"
        right={unreadCount ? <GlassButton title="Marcar todo leído" icon={CheckCheck} variant="glass" size="sm" onPress={markAllNotifsRead} /> : null}
      />
      <Segmented value={filter} onChange={setFilter}
        options={[{ value: 'all', label: 'Todas' }, { value: 'unread', label: `Sin leer · ${unreadCount}` }]} />

      {groups.length === 0 ? (
        <EmptyState icon={BellOff} title={filter === 'unread' ? 'Todo al día' : 'Sin notificaciones'}
          message={filter === 'unread' ? 'No tienes notificaciones pendientes de leer.' : 'Aquí verás las novedades de tus solicitudes, reservas y documentos.'} />
      ) : groups.map(([label, items]) => (
        <View key={label} style={{ gap: 8 }}>
          <Label>{label}</Label>
          {items.map((n) => {
            const tone = n.type === 'success' ? 'green' : n.type === 'error' ? 'rose' : n.entity_type === 'document' ? 'teal' : n.entity_type === 'hour_compensation' ? 'amber' : 'accent';
            return (
              <PressScale
                key={n.id}
                onPress={() => open(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n.read ? '' : 'Sin leer. '}${clean(n.title)}. ${n.body || ''}`}
                style={{
                  flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, alignItems: 'flex-start',
                  backgroundColor: n.read ? 'transparent' : colors.glass, borderWidth: 1, borderColor: n.read ? colors.divider : colors.glassBorder,
                }}
              >
                <IconTile icon={ENTITY_ICON[n.entity_type] || Bell} tone={tone} size={40} radius={13} />
                <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}>
                    <T size={15} weight={n.read ? 'medium' : 'semibold'} style={{ flex: 1 }} color={n.read ? colors.text2 : colors.text}>{clean(n.title)}</T>
                    <T mono size={12} color={colors.text3}>{fmtRelative(n.created_at)}</T>
                  </View>
                  {n.body ? <T size={13} color={colors.text3}>{n.body}</T> : null}
                </View>
                {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 }} /> : null}
              </PressScale>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
