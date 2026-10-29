import { useEffect, useMemo, useState } from 'react';
import { Animated, View, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, CalendarDays, Inbox, Timer, LayoutGrid, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { T } from '../components/common/Text';
import { GlassFill } from '../components/common/LiquidGlass';
import { PressScale } from '../components/common/Pressable';
import { useReduceMotion } from '../components/common/AuthBackdrop';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import { TAB_BAR_HEIGHT } from './tabBarMetrics';
import { tabBarCompact, setTabBarReduceMotion } from './tabBarScroll';
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

/** The open tab is named, blue and underlined on a soft blue pill (as on the web); the rest show the icon. */
function TabItem({ tab, focused, badge, onPress, onLongPress }) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const [on] = useState(() => new Animated.Value(focused ? 1 : 0));

  useEffect(() => {
    if (reduce) { on.setValue(focused ? 1 : 0); return; }
    Animated.spring(on, { toValue: focused ? 1 : 0, damping: 16, stiffness: 260, mass: 0.7, useNativeDriver: true }).start();
  }, [focused, reduce, on]);

  const Icon = tab.icon;
  const h = TAB_BAR_HEIGHT - 10;
  const color = focused ? colors.accent : colors.text2;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${tab.label}, ${badge} pendientes` : tab.label}
      style={{
        height: h, minWidth: 44, paddingHorizontal: focused ? 13 : 0, borderRadius: h / 2,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: h / 2,
          backgroundColor: colors.accentSoft, opacity: on,
          transform: [{ scale: on.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        }}
      />
      <View>
        <Icon size={20} color={color} strokeWidth={focused ? 2.1 : 1.8} />
        {badge ? (
          <View
            style={{
              position: 'absolute', top: -7, right: -10, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
              backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg,
            }}
          >
            <T size={9.5} weight="bold" color="#FFFFFF" style={{ lineHeight: 11 }}>{badge > 99 ? '99+' : badge}</T>
          </View>
        ) : null}
      </View>
      {focused ? <T size={13.5} weight="semibold" color={color} numberOfLines={1}>{tab.label}</T> : null}
      {focused ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 13, right: 13, bottom: 6, height: 2.5, borderRadius: 2, backgroundColor: colors.accent, opacity: on }}
        />
      ) : null}
    </Pressable>
  );
}

/** Floating glass nav pill with a round "new request" button beside it. It shrinks while the
 * screen scrolls and returns to its size when it stops (tabBarScroll.js), as the web's dock does. */
function TabBar({ state, navigation, badges }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  useEffect(() => { setTabBarReduceMotion(reduce); }, [reduce]);
  const bottom = Math.max(insets.bottom, 10);
  // React Native scales from the centre: moving down by half the lost height keeps the bottom
  // edge where it was, so the bar shrinks towards the bottom of the screen like the web's dock
  const shrink = 0.84;
  const sink = ((1 - shrink) * (TAB_BAR_HEIGHT + bottom)) / 2;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingHorizontal: Math.max(16, insets.left, insets.right), paddingBottom: bottom,
        transform: [
          { translateY: tabBarCompact.interpolate({ inputRange: [0, 1], outputRange: [0, sink] }) },
          { scale: tabBarCompact.interpolate({ inputRange: [0, 1], outputRange: [1, shrink] }) },
        ],
      }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          flexShrink: 1,
          height: TAB_BAR_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          paddingHorizontal: 5,
          borderRadius: TAB_BAR_HEIGHT / 2,
        }}
      >
        <GlassFill radius={TAB_BAR_HEIGHT / 2} />
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          const focused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name);
            }
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
          return (
            <TabItem key={route.key} tab={tab} focused={focused} badge={badges[route.name]} onPress={onPress} onLongPress={onLongPress} />
          );
        })}
      </View>
      <PressScale
        onPress={() => { Haptics.selectionAsync().catch(() => {}); navigation.navigate('NewRequest'); }}
        accessibilityRole="button"
        accessibilityLabel="Nueva solicitud"
        scaleTo={0.92}
        style={{ width: TAB_BAR_HEIGHT, height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <GlassFill radius={TAB_BAR_HEIGHT / 2} />
        <Plus size={24} color={colors.text} strokeWidth={2} />
      </PressScale>
    </Animated.View>
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
