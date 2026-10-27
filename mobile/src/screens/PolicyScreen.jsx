// Lectura y firma obligatoria de normas internas (PolicyModal on the web).
// Step 1: read the document for at least 5 s and confirm. Step 2: full name, acceptance and a
// drawn signature, saved by sign_internal_policy() with the server's date.
// It shows the onboarding document uploaded by an admin (same source as the web);
// if there is none, the PDF bundled with the app is opened in the device's viewer.
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { FileText, ExternalLink, PenLine, Check, ArrowLeft } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { POLICY_TITLE, isSignatureComplete, signInternalPolicy } from '@shared/services/policy.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { DocWebView } from '../components/DocWebView';
import { SignaturePad } from '../components/SignaturePad';
import { GlassButton } from '../components/common/GlassButton';
import { GlassInput } from '../components/common/GlassInput';
import { T } from '../components/common/Text';
import { Checkbox, Loading, IconTile, Banner } from '../components/common/UI';
import { openBundledPdf } from '../services/files';

const BUNDLED_POLICY = require('../../assets/docs/normas-internas-2026.pdf');
// The web serves the same PDF from /public
const BUNDLED_POLICY_URL = '/Procedimiento normas internas 2026.pdf';

export default function PolicyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, setUser, refreshEmployees, logout } = useAuth();
  const { onboardingDocUrl, loadingData } = useData();
  const toast = useToast();
  const [timer, setTimer] = useState(5);
  const [read, setRead] = useState(false);
  const [opened, setOpened] = useState(false);
  const [step, setStep] = useState('read');

  const [name, setName] = useState(user?.name || '');
  const [accepted, setAccepted] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // With the bundled PDF the countdown starts once the user has opened it.
  const counting = !!onboardingDocUrl || opened;
  useEffect(() => {
    if (!counting || timer <= 0) return undefined;
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, counting]);

  const openPdf = async () => {
    try {
      await openBundledPdf(BUNDLED_POLICY, POLICY_TITLE);
      setOpened(true);
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  const signatureDone = isSignatureComplete(strokes);
  const canSign = name.trim().length >= 3 && accepted && signatureDone && !saving;

  const sign = async () => {
    if (!canSign) return;
    setSaving(true);
    setError('');
    const res = await signInternalPolicy(supabase, {
      signerName: name.trim(),
      strokes,
      documentTitle: POLICY_TITLE,
      documentUrl: onboardingDocUrl || BUNDLED_POLICY_URL,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      userAgent: `Margube app ${Constants.expoConfig?.version || ''} · ${Platform.OS} ${Platform.Version}`,
    });
    setSaving(false);
    if (res.error) {
      setError(toUserMessage(res.error, 'No se ha podido guardar la firma. Inténtalo de nuevo.'));
      return;
    }
    toast.success('Normas firmadas', 'Tu firma ha quedado registrada.');
    setUser((prev) => (prev ? { ...prev, policyAccepted: true } : prev));
    refreshEmployees();
  };

  let body;
  if (step === 'sign') {
    body = (
      <ScrollView
        scrollEnabled={!drawing}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 18 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.accentSoft }}>
          <FileText size={18} color={colors.accentFg} />
          <T size={13.5} style={{ flex: 1 }}>Vas a firmar: <T size={13.5} weight="semibold">{POLICY_TITLE}</T></T>
        </View>
        <Pressable onPress={() => setStep('read')} accessibilityRole="button" hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
          <ArrowLeft size={15} color={colors.accentFg} />
          <T size={13.5} weight="semibold" color={colors.accentFg}>Volver al documento</T>
        </Pressable>

        <GlassInput label="Nombre y apellidos" value={name} onChangeText={setName} required autoCapitalize="words" autoComplete="name" textContentType="name" />

        <View style={{ gap: 8 }}>
          <T size={13} weight="medium">Firma</T>
          <SignaturePad onChange={setStrokes} onDrawingChange={setDrawing} disabled={saving} />
          {strokes.length > 0 && !signatureDone ? (
            <T size={12.5} color={colors.warningFg}>La firma es muy corta: firma como lo harías en papel.</T>
          ) : null}
        </View>

        <Checkbox checked={accepted} onChange={setAccepted} disabled={saving}
          label={`He leído y acepto el ${POLICY_TITLE}.`} />

        <T size={12.5} color={colors.text3} style={{ lineHeight: 18 }}>
          Se guardarán tu nombre, tu firma, la fecha y hora, el documento y el dispositivo desde el que firmas. Solo tú y RRHH podéis verla.
        </T>

        {error ? <Banner tone="rose">{error}</Banner> : null}
      </ScrollView>
    );
  } else if (loadingData) {
    body = <Loading label="Cargando documento…" />;
  } else if (onboardingDocUrl) {
    body = <DocWebView url={onboardingDocUrl} title={POLICY_TITLE} />;
  } else {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}>
        <IconTile icon={FileText} tone="accent" size={64} />
        <T size={18} weight="semibold" style={{ textAlign: 'center' }}>{POLICY_TITLE}</T>
        <T size={14} color={colors.text2} style={{ textAlign: 'center' }}>
          Ábrelo con tu lector de PDF, léelo hasta el final y vuelve aquí para continuar.
        </T>
        <GlassButton title={opened ? 'Abrir de nuevo' : 'Abrir documento'} icon={ExternalLink} onPress={openPdf} variant={opened ? 'glass' : 'primary'} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
          <T size={12} weight="semibold" color={colors.accentFg}>{step === 'read' ? 'Paso 1 de 2 · Leer' : 'Paso 2 de 2 · Firmar'}</T>
          <T size={22} weight="semibold" accessibilityRole="header">{step === 'read' ? 'Lectura obligatoria' : 'Firma de las normas'}</T>
          <T size={14} color={colors.text2}>
            {step === 'read'
              ? `Para continuar debes leer y firmar el ${POLICY_TITLE}.`
              : 'Tu firma queda registrada con la fecha y RRHH podrá consultarla.'}
          </T>
        </View>
        {body}
        <View style={{ padding: 20, paddingBottom: insets.bottom + 16, gap: 14, backgroundColor: colors.navBg, borderTopWidth: 1, borderTopColor: colors.divider }}>
          {step === 'read' ? (
            <>
              <Checkbox
                checked={read}
                onChange={setRead}
                disabled={!counting || timer > 0}
                label="Confirmo que he leído el documento hasta el final"
              />
              <GlassButton
                title={!counting ? 'Abre el documento para continuar' : timer > 0 ? `Espera ${timer} s…` : 'Continuar a la firma'}
                icon={counting && timer <= 0 ? PenLine : undefined}
                size="lg"
                disabled={!read || timer > 0 || !counting}
                onPress={() => setStep('sign')}
              />
            </>
          ) : (
            <GlassButton
              title={!signatureDone ? 'Falta tu firma' : !accepted ? 'Marca la casilla de aceptación' : name.trim().length < 3 ? 'Escribe tu nombre completo' : 'Firmar y aceptar'}
              icon={canSign ? Check : undefined}
              size="lg"
              disabled={!canSign}
              loading={saving}
              onPress={sign}
            />
          )}
          <Pressable onPress={logout} accessibilityRole="button" style={{ alignSelf: 'center', padding: 4 }}>
            <T size={14} color={colors.text3}>Cerrar sesión</T>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
