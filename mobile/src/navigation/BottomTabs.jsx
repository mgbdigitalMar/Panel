import { useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, CalendarDays, Inbox, Timer, LayoutGrid } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { T } from '../components/common/Text';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import DashboardScreen from '../screens/DashboardScreen';
import ReservationsScreen from '../screens/ReservationsScreen';
import RequestsScreen from '../screens/RequestsScreen';
import HorasScreen from '../screens/HorasScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Dashboard', label: 'Inicio', icon: Home, component: DashboardScreen },
  { name: 'Reservations', label: 'Reservas', icon: CalendarDays, component: ReservationsScreen },
  { name: 'Requests', label: 'Solicitudes', icon: Inbox, component: RequestsScreen },
  { name: 'Horas', label: 'Horas', icon: Timer, component: HorasScreen },
  { name: 'Settings', label: 'Más', icon: LayoutGrid, component: SettingsScreen },
];

/** Floating liquid glass tab bar with elevated island layout. */
function TabBar({ state, navigation, badges }) {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
      }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          width: '92%',
          maxWidth: 440,
          marginBottom: Math.max(insets.bottom, 10) + 4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingVertical: 8,
          paddingHorizontal: 6,
          backgroundColor: colors.navBg,
          borderRadius: 32,
          borderWidth: 1.2,
          borderColor: colors.navBorder || colors.glassBorderStrong,
          borderTopColor: colors.navBorderTop || colors.glassBorderStrong,
          shadowColor: theme === 'dark' ? '#000000' : '#11141B',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: theme === 'dark' ? 0.55 : 0.14,
          shadowRadius: 26,
          elevation: 16,
          overflow: 'hidden',
        }}
      >
        {/* Specular glass reflection line at top */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 20,
            right: 20,
            height: 1.2,
            backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.95)',
            borderRadius: 1,
          }}
        />
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          const focused = state.index === index;
          const Icon = tab.icon;
          const badge = badges[route.name];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              navigation.navigate(route.name);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${tab.label}, ${badge} pendientes` : tab.label}
              style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? colors.navActive : 'transparent',
                  borderWidth: focused ? 1.5 : 0,
                  borderColor: focused ? colors.accentBorder : 'transparent',
                  ...(focused ? {
                    shadowColor: colors.accent,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: theme === 'dark' ? 0.35 : 0.15,
                    shadowRadius: 6,
                    elevation: 3,
                  } : null),
                }}
              >
                <Icon size={20} color={focused ? colors.accent : colors.text3} strokeWidth={focused ? 2.3 : 1.8} />
                {badge ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      borderRadius: 8,
                      backgroundColor: colors.danger,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: colors.navBg,
                    }}
                  >
                    <T size={9.5} weight="bold" color="#FFFFFF" style={{ lineHeight: 11 }}>
                      {badge > 99 ? '99+' : badge}
                    </T>
                  </View>
                ) : null}
              </View>
              <T
                size={11}
                weight={focused ? 'semibold' : 'medium'}
                color={focused ? colors.accent : colors.text3}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {tab.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function BottomTabs() {
  const { user } = useAuth();
  const { requests, personalDays } = useData();
  const pending = usePendingApprovals();

  const badges = useMemo(() => {
    const myPending = [...requests, ...personalDays].filter((r) => r.employeeId === user?.id && r.status === 'pending').length;
    return {
      Requests: myPending || 0,
      Settings: user?.role === 'admin' ? pending.length : 0,
    };
  }, [requests, personalDays, user, pending.length]);

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} badges={badges} />}>
      {TABS.map((t) => <Tab.Screen key={t.name} name={t.name} component={t.component} options={{ title: t.label }} />)}
    </Tab.Navigator>
  );
}
