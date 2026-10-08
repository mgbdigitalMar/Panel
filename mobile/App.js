import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono/600SemiBold';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ToastProvider } from './src/context/ToastContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import RootNavigator from './src/navigation/RootNavigator';
import LockOverlay from './src/components/LockOverlay';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { colors, ready: themeReady } = useTheme();
  const { authLoading, touch, user, locked } = useAuth();
  const [navReady, setNavReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, GeistMono_500Medium, GeistMono_600SemiBold,
  });
  const fontsReady = fontsLoaded || !!fontError;
  const ready = fontsReady && themeReady && !authLoading;

  useEffect(() => {
    if (ready && navReady) SplashScreen.hideAsync().catch(() => {});
  }, [ready, navReady]);

  const onNavReady = useCallback(() => setNavReady(true), []);

  if (!ready) return null;

  return (
    // Any touch counts as activity for the 30-minute idle lock.
    <View style={{ flex: 1, backgroundColor: colors.bg }} onTouchStart={touch}>
      <StatusBar style={colors.statusBar} />
      <DataProvider>
        <RootNavigator onReady={onNavReady} />
        {user && locked ? <LockOverlay /> : null}
      </DataProvider>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
