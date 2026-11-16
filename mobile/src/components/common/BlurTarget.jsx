import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

/**
 * Real blur on Android. expo-blur only blurs on Android through a BlurTargetView: the content to
 * blur is wrapped in it, and each BlurView takes its ref (`blurTarget`). In this app what lies behind
 * every glass card is the screen's wallpaper, so each Screen wraps its Wallpaper in a target and
 * hands the ref to its cards through this context. One target serves every card of the screen,
 * which the expo-blur docs recommend over one target per card.
 *
 * The dock floats above all the tab screens, outside any of them, so it blurs the wallpaper of the
 * screen in front: each Screen registers its target while it is focused.
 *
 * Android 12+ only (RenderNode blur). Older versions keep the translucent fill, as expo-blur's own
 * 'dimezisBlurViewSdk31Plus' method does.
 */
export const ANDROID_BLUR = Platform.OS === 'android' && Platform.Version >= 31;

export const BlurTargetContext = createContext(null);

/** The BlurTargetView ref of the screen this component sits in (null outside a Screen, or off Android). */
export function useBlurTarget() {
  return useContext(BlurTargetContext);
}

let active = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => active;

/** The target of the screen in front, for chrome that floats over every screen (the dock). */
export function useActiveBlurTarget() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Registers `ref` as the screen in front while its screen is focused. Safe outside a navigator. */
export function useRegisterBlurTarget(ref) {
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    if (!ANDROID_BLUR || !ref) return undefined;
    const claim = () => { if (active !== ref) { active = ref; emit(); } };
    const release = () => { if (active === ref) { active = null; emit(); } };
    if (!navigation) { claim(); return release; }
    if (navigation.isFocused?.()) claim();
    const offFocus = navigation.addListener?.('focus', claim);
    const offBlur = navigation.addListener?.('blur', release);
    return () => { offFocus?.(); offBlur?.(); release(); };
  }, [navigation, ref]);
}
