// "Sesión en pausa" (design 03): shown after 30 minutes of inactivity.
// The session is kept; the user resumes it with biometrics or the password.
import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Fingerprint, Lock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { biometricSupport } from '../services/biometrics';
import { Glow } from './common/Screen';
import { T } from './common/Text';
import { Avatar } from './common/UI';
import { GlassButton } from './common/GlassButton';
import { GlassInput } from './common/GlassInput';
import { firstName } from '../utils/format';

export default function LockOverlay() {
  const { colors } = useTheme();
  const { user, biometric, unlockWithBiometrics, unlockWithPassword, logout } = useAuth();
  const [bio, setBio] = useState({ available: false, label: 'biometría' });
  const [usePassword, setUsePassword] = useState(false);
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const bioEnabled = biometric.enabled && biometric.userId === user?.id && bio.available;

  useEffect(() => {
    biometricSupport().then((b) => {
      setBio(b);
      if (b.available && biometric.enabled && biometric.userId === user?.id) unlockWithBiometrics();
    });
    // The lock must not be dismissable with the back button.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!pass) return;
    setBusy(true);
    setErr('');
    const res = await unlockWithPassword(pass);
    setBusy(false);
    if (!res.ok) setErr(res.msg || 'Contraseña incorrecta.');
  };

  return (
    <KeyboardAvoidingView style={[StyleSheet.absoluteFill, { zIndex: 500, elevation: 500 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
        <Glow />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <View
          accessibilityViewIsModal
          style={{
            maxWidth: 440,
            width: '100%',
            alignSelf: 'center',
            borderRadius: 32, padding: 22, paddingTop: 28, gap: 18, alignItems: 'center',
            backgroundColor: colors.sheetBg, borderWidth: 1, borderColor: colors.glassBorderStrong,
            shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 30 }, elevation: 20,
          }}
        >
          <View>
            <Avatar name={user?.name} initials={user?.avatar} size={76} />
            <View style={{ position: 'absolute', right: -4, bottom: -4, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.sheetBg, borderWidth: 2, borderColor: colors.glassBorderStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={14} color={colors.text} />
            </View>
          </View>
          <View style={{ gap: 8, alignItems: 'center' }}>
            <T size={24} weight="semibold">Sesión en pausa</T>
            <T size={15} color={colors.text2} style={{ textAlign: 'center' }}>
              Has estado fuera más de 30 minutos. Por seguridad, confirma que eres tú, {firstName(user?.name)}.
            </T>
          </View>

          {usePassword || !bioEnabled ? (
            <View style={{ alignSelf: 'stretch', gap: 12 }}>
              <GlassInput label="Contraseña" value={pass} onChangeText={setPass} secure autoFocus error={err}
                autoComplete="current-password" returnKeyType="go" onSubmitEditing={submit} />
              <GlassButton title="Continuar" size="lg" onPress={submit} loading={busy} disabled={!pass} />
            </View>
          ) : (
            <View style={{ alignSelf: 'stretch', gap: 10 }}>
              <GlassButton title={`Desbloquear con ${bio.label}`} icon={Fingerprint} size="lg" onPress={unlockWithBiometrics} />
              <GlassButton title="Usar contraseña" variant="glass" size="lg" onPress={() => setUsePassword(true)} />
            </View>
          )}

          <Pressable onPress={logout} accessibilityRole="button" hitSlop={8} style={{ padding: 8 }}>
            <T size={15} weight="medium" color={colors.dangerFg}>Cerrar sesión</T>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
