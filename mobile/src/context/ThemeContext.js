import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { PALETTES } from '../theme/tokens';
import { getItem, setItem, KEYS } from '../services/storage';

const ThemeCtx = createContext(null);

// mode = 'light' | 'dark' | 'system' (same values and default as the web ThemeProvider)
export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getItem(KEYS.themeMode, 'dark').then((m) => {
      if (m === 'light' || m === 'dark' || m === 'system') setModeState(m);
      setReady(true);
    });
  }, []);

  const resolved = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const colors = PALETTES[resolved];

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  const value = useMemo(() => ({
    mode,
    theme: resolved,
    colors,
    ready,
    setMode: (m) => {
      setModeState(m);
      setItem(KEYS.themeMode, m);
    },
  }), [mode, resolved, colors, ready]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
