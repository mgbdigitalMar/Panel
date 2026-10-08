// In-app toasts: the mobile equivalent of the web's LiveToastContainer.
// Realtime events and action results are announced here; they auto-dismiss after 6 s.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, XCircle, Bell, Info } from 'lucide-react-native';
import { useTheme } from './ThemeContext';
import { tone } from '../theme/tokens';
import { T } from '../components/common/Text';

const ToastCtx = createContext(null);
const DURATION = 6000;

function ToastItem({ toast, onDismiss }) {
  const { colors } = useTheme();
  const [anim] = useState(() => new Animated.Value(0));
  const [bg, fg] = tone(colors, toast.tone === 'error' ? 'danger' : toast.tone === 'success' ? 'success' : 'accent');
  const Icon = toast.tone === 'error' ? XCircle : toast.tone === 'success' ? CheckCircle2 : toast.tone === 'info' ? Info : Bell;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, damping: 15, stiffness: 250, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        width: '100%',
        maxWidth: 480,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }}
    >
      <Pressable
        onPress={() => { onDismiss(toast.id); toast.onPress?.(); }}
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: colors.sheetBg, borderColor: colors.glassBorderStrong, shadowColor: colors.shadow }]}
      >
        <View style={[styles.icon, { backgroundColor: bg }]}>
          <Icon size={18} color={fg} />
        </View>
        <View style={{ flex: 1 }}>
          <T weight="semibold" size={14} numberOfLines={2}>{toast.title}</T>
          {toast.body ? <T size={13} color={colors.text3} numberOfLines={2}>{toast.body}</T> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const show = useCallback((input) => {
    const t = typeof input === 'string' ? { title: input } : input;
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [{ id, tone: 'info', ...t }, ...prev].slice(0, 3));
    if (t.tone === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    else if (t.tone === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});
    setTimeout(() => dismiss(id), t.duration || DURATION);
  }, [dismiss]);

  const value = useMemo(() => ({
    show,
    success: (title, body) => show({ title, body, tone: 'success' }),
    error: (title, body) => show({ title, body, tone: 'error' }),
    info: (title, body) => show({ title, body, tone: 'info' }),
  }), [show]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
      </View>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, gap: 8, zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
