// Lectura obligatoria de normas internas (PolicyModal on the web):
// the user must read the document for at least 5 s and confirm before using the app.
// It shows the onboarding document uploaded by an admin (same source as the web);
// if there is none, the PDF bundled with the app is opened in the device's viewer.
import { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, FileText, ExternalLink } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { DocWebView } from '../components/DocWebView';
import { GlassButton } from '../components/common/GlassButton';
import { T } from '../components/common/Text';
import { Checkbox, Loading, IconTile } from '../components/common/UI';
import { openBundledPdf } from '../services/files';

const BUNDLED_POLICY = require('../../assets/docs/normas-internas-2026.pdf');
const POLICY_TITLE = 'Procedimiento normas internas 2026';

export default function PolicyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { setCurrentUser, logout } = useAuth();
  const { onboardingDocUrl, loadingData } = useData();
  const toast = useToast();
  const [timer, setTimer] = useState(5);
  const [read, setRead] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState(false);

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

  const confirm = async () => {
    setSaving(true);
    const { error } = await setCurrentUser({ policyAccepted: true });
    setSaving(false);
    if (error) toast.error(toUserMessage(error));
  };

  let body;
  if (loadingData) body = <Loading label="Cargando documento…" />;
  else if (onboardingDocUrl) body = <DocWebView url={onboardingDocUrl} title={POLICY_TITLE} />;
  else {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}>
        <IconTile icon={FileText} tone="accent" size={64} radius={20} />
        <T size={18} weight="semibold" style={{ textAlign: 'center' }}>{POLICY_TITLE}</T>
        <T size={14} color={colors.text2} style={{ textAlign: 'center' }}>
          Ábrelo con tu lector de PDF, léelo hasta el final y vuelve aquí para confirmar.
        </T>
        <GlassButton title={opened ? 'Abrir de nuevo' : 'Abrir documento'} icon={ExternalLink} onPress={openPdf} variant={opened ? 'glass' : 'primary'} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <T size={22} weight="semibold">Lectura obligatoria</T>
        <T size={14} color={colors.text2}>
          Para continuar es obligatorio leer y aceptar el Procedimiento de Normas Internas 2026.
        </T>
      </View>
      {body}
      <View style={{ padding: 20, paddingBottom: insets.bottom + 16, gap: 14, backgroundColor: colors.navBg, borderTopWidth: 1, borderTopColor: colors.divider }}>
        <Checkbox
          checked={read}
          onChange={setRead}
          disabled={!counting || timer > 0}
          label="Confirmo que he leído el documento hasta el final"
        />
        <GlassButton
          title={!counting ? 'Abre el documento para continuar' : timer > 0 ? `Espera ${timer} s…` : 'Confirmar lectura'}
          icon={counting && timer <= 0 ? CheckCircle2 : undefined}
          size="lg"
          disabled={!read || timer > 0 || !counting}
          loading={saving}
          onPress={confirm}
        />
        <Pressable onPress={logout} accessibilityRole="button" style={{ alignSelf: 'center', padding: 4 }}>
          <T size={14} color={colors.text3}>Cerrar sesión</T>
        </Pressable>
      </View>
    </View>
  );
}
