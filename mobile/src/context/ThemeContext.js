import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import { GLASS_STORAGE_KEY, normalizeGlass, glassMaterial } from '@shared/config/glass';
import * as SystemUI from 'expo-system-ui';
import { PALETTES } from '../theme/tokens';
import { getItem, setItem, KEYS } from '../services/storage';

const ThemeCtx = createContext(null);

// mode = 'light' | 'dark' | 'system' (same values and default as the web ThemeProvider)
export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState('dark');
  const [ready, setReady] = useState(false);
  const [glassIntensity, setGlassState] = useState('normal');
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    Promise.all([getItem(KEYS.themeMode, 'dark'), getItem(GLASS_STORAGE_KEY, 'normal')]).then(([m, glass]) => {
      if (m === 'light' || m === 'dark' || m === 'system') setModeState(m);
      setGlassState(normalizeGlass(glass));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => subscription.remove();
  }, []);

  const resolved = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const effectiveGlass = reduceTransparency ? 'off' : glassIntensity;
  const material = useMemo(() => glassMaterial(effectiveGlass, resolved === 'dark'), [effectiveGlass, resolved]);
  const colors = useMemo(() => ({
    ...PALETTES[resolved],
    card: material.card,
    glassFill: material.chrome,
    glassStrong: material.popover,
    glassSheen: material.sheen,
    navBg: material.chrome,
    sheetBg: material.popover,
    inputBg: material.popover,
  }), [resolved, material]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  const value = useMemo(() => ({
    mode,
    theme: resolved,
    colors,
    ready,
    glassIntensity,
    effectiveGlass,
    material,
    reduceTransparency,
    setGlassIntensity: (value) => {
      const next = normalizeGlass(value);
      setGlassState(next);
      setItem(GLASS_STORAGE_KEY, next);
    },
    setMode: (m) => {
      setModeState(m);
      setItem(KEYS.themeMode, m);
    },
  }), [mode, resolved, colors, ready, glassIntensity, effectiveGlass, material, reduceTransparency]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
