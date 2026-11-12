import { useEffect, useMemo } from 'react';
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
import { DockScrubber } from './DockScrubber';
import { DOCK_STYLE, DOCK_PADDING, DOCK_GAP, dockTint as getDockTint } from '@shared/config/dock';
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
  const Icon = tab.icon;
  const h = DOCK_STYLE.height - DOCK_PADDING * 2;
  const color = focused ? DOCK_STYLE.active : DOCK_STYLE.inactive;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${tab.label}, ${badge} pendientes` : tab.label}
      style={{
        height: h, flex: 1, minWidth: 0, paddingHorizontal: 1, borderRadius: h / 2,
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}
    >
      <View>
        <Icon size={DOCK_STYLE.iconSize} color={color} strokeWidth={focused ? 2.1 : 1.8} />
        {badge ? (
          <View
            style={{
              position: 'absolute', top: -7, right: -10, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
              backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: DOCK_STYLE.surface,
            }}
          >
            <T size={9.5} weight="bold" color="#FFFFFF" style={{ lineHeight: 11 }}>{badge > 99 ? '99+' : badge}</T>
          </View>
        ) : null}
      </View>
      <T size={DOCK_STYLE.labelSize} weight="medium" color={color} numberOfLines={1} style={{ lineHeight: DOCK_STYLE.labelLineHeight, maxWidth: '100%' }}>{tab.label}</T>
    </Pressable>
  );
}

/** Floating glass nav pill with a round "new request" button beside it. It shrinks while the
 * screen scrolls and returns to its size when it stops (tabBarScroll.js), as the web's dock does. */
function TabBar({ state, navigation, badges }) {
  const { material } = useTheme();
  const dockTint = getDockTint(material.strength);
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  useEffect(() => { setTabBarReduceMotion(reduce); }, [reduce]);
  const bottom = insets.bottom + DOCK_STYLE.bottomGap;
  // React Native scales from the centre: moving down by half the lost height keeps the bottom
  // edge where it was, so the bar shrinks towards the bottom of the screen like the web's dock
  const shrink = DOCK_STYLE.shrink;
  const sink = ((1 - shrink) * (TAB_BAR_HEIGHT + bottom)) / 2;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DOCK_STYLE.actionGap,
        paddingHorizontal: Math.max(DOCK_STYLE.outerGutter, insets.left, insets.right), paddingBottom: bottom,
        transform: [
          { translateY: tabBarCompact.interpolate({ inputRange: [0, 1], outputRange: [0, sink] }) },
          { scale: tabBarCompact.interpolate({ inputRange: [0, 1], outputRange: [1, shrink] }) },
        ],
      }}
    >
      <DockScrubber activeIndex={state.index} count={state.routes.length}
        backdrop={<GlassFill radius={TAB_BAR_HEIGHT / 2} tint={dockTint} sheen={false} edgeColor={DOCK_STYLE.selectionEdge} rimColor={DOCK_STYLE.selectionEdge} />}
        onSelect={(index) => {
          const route = state.routes[index];
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (event.defaultPrevented) return false;
          if (state.index !== index && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => {});
            navigation.navigate(route.name);
          }
          return true;
        }}
        style={{
          flex: 1,
          height: TAB_BAR_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: DOCK_GAP,
          paddingHorizontal: DOCK_PADDING,
          borderRadius: TAB_BAR_HEIGHT / 2,
        }}
      >
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
      </DockScrubber>
      <PressScale
        haptic={null}
        onPress={() => { Haptics.selectionAsync().catch(() => {}); navigation.navigate('NewRequest'); }}
        accessibilityRole="button"
        accessibilityLabel="Nueva solicitud"
        scaleTo={DOCK_STYLE.actionPressScale}
        style={{ width: DOCK_STYLE.actionSize, height: DOCK_STYLE.actionSize, borderRadius: DOCK_STYLE.actionSize / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <GlassFill radius={DOCK_STYLE.actionSize / 2} tint={DOCK_STYLE.action} sheen={false} edgeColor="rgba(255,255,255,0.3)" rimColor="rgba(255,255,255,0.3)" />
        <Plus size={24} color={DOCK_STYLE.active} strokeWidth={2} />
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
    <Tab.Navigator screenOptions={{ headerShown: false, animation: 'none' }} tabBar={(props) => <TabBar {...props} badges={badges} />}>
      {TABS.map((t) => <Tab.Screen key={t.name} name={t.name} component={t.component} options={{ title: t.label }} />)}
    </Tab.Navigator>
  );
}
