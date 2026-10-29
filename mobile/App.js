import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Poppins_300Light } from '@expo-google-fonts/poppins/300Light';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono/600SemiBold';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ToastProvider } from './src/context/ToastContext';
import { ConfirmProvider } from './src/context/ConfirmContext';
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
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    Poppins_300Light, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, GeistMono_500Medium, GeistMono_600SemiBold,
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
          <ConfirmProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
