// Confirmations (delete, reject, sign out) on liquid glass instead of the system alert, which
// can't be styled. `confirm()` returns a promise: true when the person confirms.
//   const confirm = useConfirm();
//   if (await confirm({ title: 'Eliminar reserva', message: '…', confirmText: 'Eliminar' })) { … }
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Trash2, AlertTriangle } from 'lucide-react-native';
import { useTheme } from './ThemeContext';
import { tone } from '../theme/tokens';
import { T } from '../components/common/Text';
import { GlassFill } from '../components/common/LiquidGlass';
import { GlassButton } from '../components/common/GlassButton';

const ConfirmCtx = createContext(null);
const RADIUS = 30;

function ConfirmSheet({ request, onAnswer }) {
  const { colors, theme } = useTheme();
  const [anim] = useState(() => new Animated.Value(0));
  const danger = request.tone !== 'accent';
  const [orbBg, orbFg] = tone(colors, danger ? 'danger' : 'accent');
  const Icon = request.icon || (danger ? Trash2 : AlertTriangle);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, damping: 18, stiffness: 260, mass: 0.9, useNativeDriver: true }).start();
    if (danger) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    AccessibilityInfo.announceForAccessibility?.(`${request.title}. ${request.message || ''}`);
  }, [anim, danger, request.title, request.message]);

  return (
    <View style={styles.root} accessibilityViewIsModal>
      {/* The screen behind goes out of focus; tapping it cancels */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onAnswer(false)} accessibilityLabel="Cancelar" accessibilityRole="button">
        {Platform.OS === 'ios'
          ? <BlurView style={StyleSheet.absoluteFill} tint={theme === 'dark' ? 'dark' : 'light'} intensity={30} />
          : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
      </Pressable>

      <Animated.View
        accessibilityRole="alert"
        style={[styles.card, {
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          shadowColor: colors.shadow,
        }]}
      >
        <GlassFill radius={RADIUS} />
        <View style={[styles.orb, { backgroundColor: orbBg, borderColor: danger ? colors.dangerBorder : colors.glassBorder }]}>
          <Icon size={26} color={orbFg} />
        </View>
        <T size={19} weight="semibold" heading align="center">{request.title}</T>
        {request.message ? <T size={14.5} color={colors.text2} align="center" style={{ lineHeight: 21 }}>{request.message}</T> : null}
        <View style={styles.actions}>
          <GlassButton title={request.cancelText || 'Cancelar'} variant="glass" size="lg" style={{ flex: 1 }} onPress={() => onAnswer(false)} />
          <GlassButton title={request.confirmText || 'Eliminar'} variant={danger ? 'danger' : 'primary'} size="lg" style={{ flex: 1 }} onPress={() => onAnswer(true)} />
        </View>
      </Animated.View>
    </View>
  );
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const answer = useCallback((ok) => {
    resolver.current?.(ok);
    resolver.current = null;
    setRequest(null);
  }, []);

  const confirm = useCallback((req) => new Promise((resolve) => {
    // A second request replaces an unanswered one, which counts as cancelled
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest(req);
  }), []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      <Modal visible={!!request} transparent animationType="fade" statusBarTranslucent onRequestClose={() => answer(false)}>
        {request ? <ConfirmSheet request={request} onAnswer={answer} /> : null}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/** `confirm({ title, message, confirmText, cancelText, tone: 'danger' | 'accent', icon })` → Promise<boolean> */
export function useConfirm() {
  return useContext(ConfirmCtx);
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 10,
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 20,
    borderRadius: RADIUS,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.28,
    shadowRadius: 40,
    elevation: 18,
  },
  orb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 12 },
});
