import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Keyboard, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { LeafMark } from './common/Brand';
import { BRAND } from '../theme/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { GlassFill } from './common/LiquidGlass';
import { useAssistantConversation } from '@shared/hooks/useAssistantConversation.js';
import { nativeAssistantContext } from '@shared/services/assistantNative.js';
import { ASSISTANT_EXAMPLES } from '@shared/services/assistantClient.js';

const endpoint = `${(process.env.EXPO_PUBLIC_WEB_URL || 'https://margube.vercel.app').replace(/\/$/, '')}/api/assistant`;
const getAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token;
};

export default function AssistantWidget() {
  const { user } = useAuth();
  const data = useData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { width } = useWindowDimensions();
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const scroll = useRef(null);
  const chat = useAssistantConversation({ context: nativeAssistantContext(user, data), getAccessToken, endpoint, loadingData: data.loadingData, loadFailed: data.loadFailed });
  const label = { color: colors.text };
  const button = (title, onPress, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, { backgroundColor: colors.accent, opacity: disabled ? 0.5 : 1 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir asistente" onPress={() => setOpen(true)} style={[styles.launcher, { backgroundColor: BRAND.blue, bottom: insets.bottom + 92 }]}><LeafMark tile={false} size={34} /></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <Pressable accessibilityLabel="Cerrar asistente" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.window, { width: Math.min(420, width - 32), marginTop: insets.top + 12, marginBottom: keyboardOpen ? 12 : insets.bottom + 160 }]}>
          <GlassFill radius={24} edgeColor={colors.glassBorder} rimColor={colors.glassRim} />
          <View style={styles.header}><Text accessibilityRole="header" style={[styles.title, label]}>Asistente Margube</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar asistente" onPress={() => setOpen(false)} style={styles.close}><X color={colors.text} size={24} /></Pressable></View>
          <ScrollView ref={scroll} style={styles.log} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
            {!chat.messages.length && <><Text style={[styles.title, label]}>¿Qué necesitas hacer?</Text><Text style={label}>Consulta tus trámites o prepara una solicitud o reserva. Revisarás una propuesta antes de confirmar cualquier cambio.</Text>{ASSISTANT_EXAMPLES.map(example => <Pressable key={example} accessibilityRole="button" onPress={() => chat.setInput(example)} style={[styles.example, { borderColor: colors.divider }]}><Text style={label}>{example}</Text></Pressable>)}<Text style={[styles.notice, label]}>Las consultas se procesan con Groq. El chat se borra al cerrar sesión.</Text></>}
            {chat.messages.map((message, index) => <View key={index} style={[styles.message, message.role === 'user' && { backgroundColor: colors.inputBg, alignSelf: 'flex-end' }]}><Text style={[styles.author, label]}>{message.role === 'user' ? 'Tú' : 'Asistente'}</Text><Text selectable style={[styles.copy, label]}>{message.content}</Text></View>)}
            {chat.busy && <Text accessibilityLiveRegion="polite" style={label}>{chat.proposal ? 'Comprobando y ejecutando…' : 'Preparando respuesta…'}</Text>}
            {chat.proposal && <View style={[styles.example, { borderColor: colors.accent }]}><Text style={[styles.author, label]}>Propuesta sin ejecutar</Text><Text style={[styles.title, label]}>{chat.proposal.prepared.title}</Text>{chat.proposal.prepared.details.map((detail, index) => <Text key={index} style={label}>{detail}</Text>)}{button('Confirmar acción', chat.confirm, chat.busy || data.loadingData || data.loadFailed)}{button('Descartar', chat.cancel, chat.busy)}</View>}
            {!!chat.error && <Text accessibilityRole="alert" style={label}>{chat.error}</Text>}
            {(data.loadingData || data.loadFailed) && <Text style={label}>{data.loadFailed ? 'No se han podido cargar todos los datos.' : 'Cargando tus trámites…'}</Text>}
            {data.loadFailed && button('Actualizar datos', data.refresh, data.loadingData || chat.busy)}
          </ScrollView>
          <View style={styles.composer}><TextInput accessibilityLabel="Tu mensaje" placeholder="Escribe tu consulta" placeholderTextColor={colors.text} value={chat.input} onChangeText={chat.setInput} editable={!chat.blocked} multiline maxLength={3000} style={[styles.input, label, { backgroundColor: colors.inputBg, borderColor: colors.divider }]} />{button('Enviar', chat.send, chat.blocked || !chat.input.trim())}{button('Nueva conversación', chat.clear, chat.busy)}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  launcher: { position: 'absolute', right: 16, width: 56, height: 56, borderRadius: 28, borderBottomRightRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 90 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  window: { flex: 1, maxHeight: 540, marginRight: 16, marginLeft: 16, width: 'auto', maxWidth: 420, alignSelf: 'flex-end', borderRadius: 24, overflow: 'hidden' },
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '600', flexShrink: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  log: { flex: 1 }, messages: { padding: 16, gap: 14 },
  message: { maxWidth: '95%', padding: 12, borderRadius: 16, gap: 6 },
  author: { fontSize: 12, fontWeight: '600' }, copy: { fontSize: 16, lineHeight: 24 },
  example: { padding: 14, borderWidth: 1, borderRadius: 14, gap: 10 }, notice: { fontSize: 12 },
  composer: { padding: 16, gap: 8 }, input: { fontSize: 16, minHeight: 52, maxHeight: 100, borderRadius: 14, padding: 12, borderWidth: 1 },
  button: { minHeight: 44, borderRadius: 14, padding: 12, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '600' },
});
