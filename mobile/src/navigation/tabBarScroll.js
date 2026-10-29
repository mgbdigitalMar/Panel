import { Animated } from 'react-native';

// The floating tab bar shrinks while a tab screen scrolls and springs back once it stops,
// the same as the web's dock. One value for the whole app: 0 = full size, 1 = compact.
export const tabBarCompact = new Animated.Value(0);

const IDLE_MS = 220;
let compact = false;
let timer = null;
let reduceMotion = false;

export function setTabBarReduceMotion(value) {
  reduceMotion = value;
}

function settle(toValue) {
  if (reduceMotion) {
    tabBarCompact.setValue(toValue);
    return;
  }
  if (toValue) {
    Animated.timing(tabBarCompact, { toValue, duration: 180, useNativeDriver: true }).start();
  } else {
    Animated.spring(tabBarCompact, { toValue, damping: 14, stiffness: 220, mass: 0.8, useNativeDriver: true }).start();
  }
}

/** onScroll of the tab screens (Screen with tabBarSpace): shrink now, grow back when idle. */
export function onTabScreenScroll() {
  if (!compact) {
    compact = true;
    settle(1);
  }
  clearTimeout(timer);
  timer = setTimeout(() => {
    compact = false;
    settle(0);
  }, IDLE_MS);
}
