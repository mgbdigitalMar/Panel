import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, View, TextInput, ScrollView, KeyboardAvoidingView, Keyboard, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { X, RotateCcw, ArrowUp, ShieldCheck, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LeafMark } from './common/Brand';
import { BRAND } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { GlassFill } from './common/LiquidGlass';
import { GlassButton, IconButton } from './common/GlassButton';
import { HapticPressable, PressScale } from './common/Pressable';
import { T } from './common/Text';
import { useReduceMotion } from './common/AuthBackdrop';
import { useAssistantConversation } from '@shared/hooks/useAssistantConversation.js';
import { nativeAssistantContext } from '@shared/services/assistantNative.js';
import { ASSISTANT_EXAMPLES } from '@shared/services/assistantClient.js';

const endpoint = `${(process.env.EXPO_PUBLIC_WEB_URL || 'https://margube.vercel.app').replace(/\/$/, '')}/api/assistant`;
const getAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token;
};

/** Three dots that rise in turn while the assistant answers (still with Reduce motion on). */
function TypingDots({ color }) {
  const reduce = useReduceMotion();
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.35)));
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.stagger(150, dots.map((v) => Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.35, duration: 300, useNativeDriver: true }),
    ]))));
    loop.start();
    return () => loop.stop();
  }, [reduce, dots]);
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0.35, 1], outputRange: [0, -3] }) }] }} />
      ))}
    </View>
  );
}

export default function AssistantWidget() {
  const { user } = useAuth();
  const data = useData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scroll = useRef(null);
  const input = useRef(null);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const chat = useAssistantConversation({ context: nativeAssistantContext(user, data), getAccessToken, endpoint, loadingData: data.loadingData, loadFailed: data.loadFailed });
  const canSend = !chat.blocked && !!chat.input.trim();
  const danger = !!chat.proposal?.prepared.danger;
  const close = () => setOpen(false);

  return <>
    <HapticPressable accessibilityRole="button" accessibilityLabel="Abrir asistente" onPress={() => setOpen(true)}
      style={[styles.launcher, { backgroundColor: BRAND.blue, bottom: insets.bottom + 92 }]}>
      <LeafMark tile={false} size={34} />
    </HapticPressable>
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <HapticPressable accessibilityLabel="Cerrar asistente" haptic={null} onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.window, {
          width: Math.min(440, width - 16),
          marginTop: insets.top + 8,
          marginBottom: keyboardOpen ? 8 : insets.bottom + 8,
          borderColor: colors.glassBorder,
        }]}>
          <GlassFill radius={24} edgeColor={colors.glassBorder} rimColor={colors.glassRim} />

          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <LeafMark size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={16} weight="semibold" color={colors.text} accessibilityRole="header" numberOfLines={1}>Asistente Margube</T>
              <T size={12.5} color={colors.muted} numberOfLines={1}>{chat.busy ? 'Escribiendo…' : 'Consulta y prepara tus trámites'}</T>
            </View>
            {chat.messages.length > 0 && (
              <IconButton icon={RotateCcw} variant="plain" accessibilityLabel="Nueva conversación" onPress={() => { if (!chat.busy) chat.clear(); }} />
            )}
            <IconButton icon={X} variant="plain" accessibilityLabel="Cerrar asistente" onPress={close} />
          </View>

          <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.log} keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => { if (chat.messages.length) scroll.current?.scrollToEnd({ animated: true }); }}>
            {!chat.messages.length && (
              <View style={{ gap: 8 }}>
                <T size={20} weight="semibold" color={colors.text}>¿Qué necesitas hacer?</T>
                <T size={14.5} color={colors.muted} style={{ lineHeight: 21 }}>Consulta tus trámites o prepara una solicitud o reserva. Revisarás una propuesta antes de confirmar cualquier cambio.</T>
                <View style={styles.examples}>
                  {ASSISTANT_EXAMPLES.map((example) => (
                    <HapticPressable key={example} accessibilityRole="button" disabled={chat.busy}
                      onPress={() => { chat.setInput(example); input.current?.focus(); }}
                      style={({ pressed }) => [styles.chip, { backgroundColor: colors.inputBg, borderColor: pressed ? colors.accentBorder : colors.divider }]}>
                      <T size={14.5} color={colors.text}>{example}</T>
                    </HapticPressable>
                  ))}
                </View>
                <View style={styles.privacy}>
                  <ShieldCheck size={14} color={colors.muted} />
                  <T size={12} color={colors.muted} style={{ flex: 1, lineHeight: 17 }}>Las consultas se procesan con Groq. El chat se borra al cerrar sesión.</T>
                </View>
              </View>
            )}

            {chat.messages.map((message, index) => {
              const mine = message.role === 'user';
              return (
                <View key={index} style={[styles.bubble, mine
                  ? { alignSelf: 'flex-end', backgroundColor: BRAND.blue, borderBottomRightRadius: 6 }
                  : { alignSelf: 'flex-start', backgroundColor: colors.inputBg, borderColor: colors.divider, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 6 }]}>
                  <T selectable size={15.5} color={mine ? '#FFFFFF' : colors.text} style={{ lineHeight: 22 }}
                    accessibilityLabel={`${mine ? 'Tú' : 'Asistente'}: ${message.content}`}>{message.content}</T>
                </View>
              );
            })}

            {chat.busy && (
              <View accessibilityLiveRegion="polite" accessibilityLabel={chat.proposal ? 'Comprobando y ejecutando la acción' : 'Preparando la respuesta'}
                style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: colors.inputBg, borderColor: colors.divider, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 6, paddingVertical: 14 }]}>
                <TypingDots color={colors.muted} />
              </View>
            )}

            {chat.proposal && (
              <View style={[styles.card, { backgroundColor: colors.inputBg, borderColor: danger ? colors.dangerBorder : colors.accentBorder }]}>
                <T size={12} weight="semibold" color={danger ? colors.dangerFg : colors.accentFg}>Propuesta sin ejecutar</T>
                <T size={16} weight="semibold" color={colors.text}>{chat.proposal.prepared.title}</T>
                <View style={{ gap: 3 }}>
                  {chat.proposal.prepared.details.map((detail, index) => <T key={index} size={14} color={colors.text}>• {detail}</T>)}
                </View>
                <T size={12.5} color={colors.muted}>{danger ? 'Revisa los datos: esta acción puede eliminar el registro o cambiar su estado.' : 'Se aplicarán las mismas validaciones que en el formulario.'}</T>
                <View style={styles.actions}>
                  <GlassButton title="Descartar" variant="glass" size="sm" icon={X} onPress={chat.cancel} disabled={chat.busy} style={{ flex: 1 }} />
                  <GlassButton title="Confirmar acción" variant={danger ? 'danger' : 'primary'} size="sm" icon={Check} onPress={chat.confirm}
                    loading={chat.busy} disabled={data.loadingData || data.loadFailed} style={{ flex: 1.4 }} />
                </View>
              </View>
            )}

            {!!chat.error && (
              <View accessibilityRole="alert" style={[styles.card, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder }]}>
                <T size={14} color={colors.dangerFg}>{chat.error}</T>
              </View>
            )}
            {(data.loadingData || data.loadFailed) && (
              <T size={13} color={colors.muted}>{data.loadFailed ? 'No se han podido cargar todos los datos.' : 'Cargando tus trámites…'}</T>
            )}
            {data.loadFailed && <GlassButton title="Actualizar datos" variant="glass" size="sm" onPress={data.refresh} disabled={data.loadingData || chat.busy} style={{ alignSelf: 'flex-start' }} />}
          </ScrollView>

          <View style={[styles.composer, { borderTopColor: colors.divider }]}>
            <View style={[styles.field, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, opacity: chat.blocked ? 0.65 : 1 }]}>
              <TextInput ref={input} accessibilityLabel="Tu mensaje"
                placeholder={chat.proposal ? 'Confirma o descarta la propuesta' : 'Escribe tu consulta…'} placeholderTextColor={colors.muted}
                value={chat.input} onChangeText={chat.setInput} editable={!chat.blocked} multiline maxLength={3000}
                style={[styles.input, { color: colors.text }]} />
              <PressScale haptic="medium" accessibilityRole="button" accessibilityLabel="Enviar" accessibilityState={{ disabled: !canSend }}
                disabled={!canSend} onPress={chat.send} scaleTo={0.92}
                style={[styles.send, { backgroundColor: canSend ? BRAND.blue : colors.divider }]}>
                <ArrowUp size={20} color={canSend ? '#FFFFFF' : colors.muted} strokeWidth={2.4} />
              </PressScale>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  launcher: { position: 'absolute', right: 16, width: 56, height: 56, borderRadius: 28, borderBottomRightRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 90 },
  overlay: { flex: 1, alignItems: 'center' },
  window: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  log: { padding: 16, gap: 10, flexGrow: 1 },
  examples: { alignItems: 'flex-start', gap: 8, marginTop: 8, marginBottom: 4 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, maxWidth: '100%' },
  privacy: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 4 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  card: { padding: 14, borderRadius: 18, borderWidth: 1, gap: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  composer: { padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  field: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderRadius: 24, borderWidth: 1, paddingLeft: 14, padding: 5 },
  input: { flex: 1, fontSize: 16, minHeight: 38, maxHeight: 120, paddingTop: 9, paddingBottom: 9, textAlignVertical: 'center' },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
