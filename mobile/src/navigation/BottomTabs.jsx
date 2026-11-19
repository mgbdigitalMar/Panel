import { useEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, CalendarDays, Inbox, Timer, LayoutGrid, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { T } from '../components/common/Text';
import { GlassFill, GlassGroup } from '../components/common/LiquidGlass';
import { useActiveBlurTarget } from '../components/common/BlurTarget';
import { PressScale } from '../components/common/Pressable';
import { useReduceMotion } from '../components/common/AuthBackdrop';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import { TAB_BAR_HEIGHT, NATIVE_TABS } from './tabBarMetrics';
import { DockScrubber } from './DockScrubber';
import { DOCK_STYLE, DOCK_PADDING, DOCK_GAP, dockTheme } from '@shared/config/dock';
import { tabBarCompact, setTabBarReduceMotion } from './tabBarScroll';
import { DUR, EASE, TAB_SHIFT } from '../theme/motion';
import DashboardScreen from '../screens/DashboardScreen';
import ReservationsScreen from '../screens/ReservationsScreen';
import RequestsScreen from '../screens/RequestsScreen';
import HorasScreen from '../screens/HorasScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const NativeTab = createNativeBottomTabNavigator();

// SF Symbols for the system tab bar (iOS): outline at rest, filled when open where a fill exists
const SF = {
  Dashboard: ['house', 'house.fill'],
  Reservations: ['calendar', 'calendar'],
  Requests: ['tray', 'tray.fill'],
  Horas: ['timer', 'timer'],
  Settings: ['square.grid.2x2', 'square.grid.2x2.fill'],
};

/* Switching tab: the new screen fades in while travelling TAB_SHIFT px from the side of its tab in
   the dock (a tab to the right comes in from the right), so the content follows the indicator.
   `progress` is -1 for tabs left of the open one, 0 for the open one and 1 for those to its right. */
function forTabShift({ current }) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
      transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-TAB_SHIFT, 0, TAB_SHIFT] }) }],
    },
  };
}

/* "Reduce motion": the screens only cross-fade */
function forTabFade({ current }) {
  return {
    sceneStyle: { opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }) },
  };
}

const TAB_SPEC = { animation: 'timing', config: { duration: DUR.tab, easing: EASE.out } };
const TAB_SPEC_REDUCED = { animation: 'timing', config: { duration: DUR.reduced, easing: EASE.out } };

const TABS = [
  { name: 'Dashboard', label: 'Inicio', icon: Home, component: DashboardScreen },
  { name: 'Reservations', label: 'Reservas', icon: CalendarDays, component: ReservationsScreen },
  { name: 'Requests', label: 'Solicitudes', icon: Inbox, component: RequestsScreen },
  { name: 'Horas', label: 'Horas', icon: Timer, component: HorasScreen },
  { name: 'Settings', label: 'Más', icon: LayoutGrid, component: SettingsScreen },
];

/** A tab's icon (with its pending count) and name. Rendered by the real tab and, still, inside the
 * dock's lens (DockScrubber). The open tab takes the theme's accent on its blue glass capsule. */
function TabFace({ tab, focused, badge }) {
  const { colors, theme } = useTheme();
  const palette = dockTheme(theme);
  const Icon = tab.icon;
  const color = focused ? palette.activeTab : palette.inactive;
  return (
    <>
      <View>
        <Icon size={DOCK_STYLE.iconSize} color={color} strokeWidth={focused ? 2.1 : 1.8} />
        {badge ? (
          <View
            style={{
              position: 'absolute', top: -7, right: -10, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
              backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.badgeRing,
            }}
          >
            <T size={9.5} weight="bold" color="#FFFFFF" style={{ lineHeight: 11 }}>{badge > 99 ? '99+' : badge}</T>
          </View>
        ) : null}
      </View>
      <T size={DOCK_STYLE.labelSize} weight="medium" color={color} numberOfLines={1} style={{ lineHeight: DOCK_STYLE.labelLineHeight, maxWidth: '100%' }}>{tab.label}</T>
    </>
  );
}

const TAB_CELL = {
  height: DOCK_STYLE.height - DOCK_PADDING * 2, flex: 1, minWidth: 0, paddingHorizontal: 1, borderRadius: (DOCK_STYLE.height - DOCK_PADDING * 2) / 2,
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
};

function TabItem({ tab, focused, badge, onPress, onLongPress }) {
  // Press feedback: the cell dips slightly under the finger. The haptic is fired by the caller,
  // only when the tab actually changes.
  return (
    <PressScale
      haptic={null}
      scaleTo={0.94}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${tab.label}, ${badge} pendientes` : tab.label}
      style={TAB_CELL}
    >
      <TabFace tab={tab} focused={focused} badge={badge} />
    </PressScale>
  );
}

const DOCK_ROW = { flex: 1, flexDirection: 'row', alignItems: 'center', gap: DOCK_STYLE.actionGap };

/** The dock's row: one glass group for the bar and the round button (GlassGroup). */
function DockGlassGroup({ children }) {
  return <GlassGroup spacing={DOCK_STYLE.actionGap} style={DOCK_ROW}>{children}</GlassGroup>;
}

/** Floating glass nav pill with a round "new request" button beside it. It shrinks while the
 * screen scrolls and returns to its size when it stops (tabBarScroll.js), as the web's dock does. */
function TabBar({ state, navigation, badges }) {
  // The whole dock is the theme's Liquid Glass (shared/config/dock.js): white glass with ink icons
  // in the light theme, smoked glass with white icons in the dark one; solid with the effect off
  const { theme, effectiveGlass, material } = useTheme();
  const palette = dockTheme(theme);
  const glass = effectiveGlass === 'off' ? palette.solid : effectiveGlass === 'strong' ? palette.glass : material.chrome;
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  // Android: the dock blurs the screen in front, cards and all (BlurTarget.jsx)
  const blurTarget = useActiveBlurTarget();
  // Set by a tab press, so the dock's lens lifts only for a switch made on the dock
  const pressedRef = useRef(false);
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
      {/* iOS 26: the bar and the round button share one GlassEffectContainer, as Apple requires for
          neighbouring glass (one cannot sample the other; together they render as one material) */}
      <DockGlassGroup>
      <DockScrubber activeIndex={state.index} count={state.routes.length} pressedRef={pressedRef} palette={palette}
        lensContent={state.routes.map((route, index) => (
          <View key={route.key} style={TAB_CELL}>
            <TabFace tab={TABS.find((t) => t.name === route.name)} focused={state.index === index} badge={badges[route.name]} />
          </View>
        ))}
        backdrop={<GlassFill radius={TAB_BAR_HEIGHT / 2} tint={glass} nativeTint={null} systemMaterial edgeColor={palette.edge} rimColor={palette.rim} target={blurTarget} />}
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              pressedRef.current = true;
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
        nativeGlass
        style={{ width: DOCK_STYLE.actionSize, height: DOCK_STYLE.actionSize, borderRadius: DOCK_STYLE.actionSize / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        {/* The same glass as the bar, its plus in the theme's accent */}
        <GlassFill radius={DOCK_STYLE.actionSize / 2} tint={glass} nativeTint={null} systemMaterial edgeColor={palette.edge} rimColor={palette.rim} target={blurTarget} interactive />
        <View pointerEvents="none"><Plus size={24} color={palette.action} strokeWidth={2} /></View>
      </PressScale>
      </DockGlassGroup>
    </Animated.View>
  );
}

/**
 * iOS: the system's own tab bar (UITabBar), which iOS 26 draws in Liquid Glass with its lens,
 * haptics and scroll-to-top — nothing hand-made (the claude-liquid-glass skill). The open tab takes
 * the brand accent; the bar minimises while scrolling down, as the system apps do. Five tabs: the
 * iPhone bar shows five at most, and a sixth (a detached search tab) would add a system «More»
 * tab, so search stays in the top bar.
 */
function NativeTabs({ badges }) {
  const { theme, colors } = useTheme();
  const palette = dockTheme(theme);
  return (
    <NativeTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.activeTab,
        tabBarInactiveTintColor: colors.text2,
        tabBarMinimizeBehavior: 'onScrollDown',
      }}
    >
      {TABS.map((t) => (
        <NativeTab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{
            title: t.label,
            tabBarIcon: ({ focused }) => ({ type: 'sfSymbol', name: SF[t.name][focused ? 1 : 0] }),
            tabBarBadge: badges[t.name] || undefined,
          }}
        />
      ))}
    </NativeTab.Navigator>
  );
}

export default function BottomTabs() {
  const { user } = useAuth();
  const { requests, personalDays } = useData();
  const pending = usePendingApprovals();
  const reduce = useReduceMotion();

  const badges = useMemo(() => {
    const myPending = [...requests, ...personalDays].filter((r) => r.employeeId === user?.id && r.status === 'pending').length;
    return {
      Requests: myPending || 0,
      Settings: user?.role === 'admin' ? pending.length : 0,
    };
  }, [requests, personalDays, user, pending.length]);

  if (NATIVE_TABS) return <NativeTabs badges={badges} />;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        sceneStyleInterpolator: reduce ? forTabFade : forTabShift,
        transitionSpec: reduce ? TAB_SPEC_REDUCED : TAB_SPEC,
      }}
      tabBar={(props) => <TabBar {...props} badges={badges} />}
    >
      {TABS.map((t) => <Tab.Screen key={t.name} name={t.name} component={t.component} options={{ title: t.label }} />)}
    </Tab.Navigator>
  );
}
