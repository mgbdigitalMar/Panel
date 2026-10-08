// 01 · Iniciar sesión
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, View } from 'react-native';
import { Fingerprint, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Screen } from '../components/common/Screen';
import { GlassCard } from '../components/common/GlassCard';
import { GlassInput } from '../components/common/GlassInput';
import { GlassButton } from '../components/common/GlassButton';
import { T } from '../components/common/Text';
import { Banner } from '../components/common/UI';
import { biometricSupport } from '../services/biometrics';
import { isSupabaseConfigured } from '../lib/supabase';
import { firstName } from '../utils/format';

const logo = require('../../assets/logo.png');

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login, loginWithBiometrics, biometric, lastEmail } = useAuth();
  const [email, setEmail] = useState(lastEmail || '');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [bio, setBio] = useState({ available: false, label: 'biometría' });
  const passRef = useRef(null);

  useEffect(() => { biometricSupport().then(setBio); }, []);

  const submit = async () => {
    if (!email.trim() || !pass) {
      setErr('Introduce tu correo y tu contraseña.');
      return;
    }
    setLoading(true);
    setErr('');
    const res = await login(email, pass);
    setLoading(false);
    if (!res.ok) setErr(res.msg);
  };

  const bioLogin = async () => {
    setErr('');
    const res = await loginWithBiometrics();
    if (!res.ok && res.msg) setErr(res.msg);
  };

  const help = () => Alert.alert(
    '¿Primer acceso o contraseña olvidada?',
    'RRHH te facilita una contraseña temporal. Al entrar por primera vez la app te pedirá crear una propia.\n\nSi la has olvidado, escribe a rrhh@margube.com para que te la restablezcan.',
    [
      { text: 'Cerrar', style: 'cancel' },
      { text: 'Escribir a RRHH', onPress: () => Linking.openURL('mailto:rrhh@margube.com?subject=Acceso%20a%20la%20intranet') },
    ],
  );

  const canBio = bio.available && biometric.enabled && biometric.userId;

  return (
    <Screen glowVariant="login" contentStyle={{ paddingTop: 0, flexGrow: 1, justifyContent: 'space-between', gap: 24, maxWidth: 440, width: '100%', alignSelf: 'center' }}>
      <View style={{ gap: 32, paddingTop: 56 }}>
        <View style={{ gap: 18 }}>
          <Image source={logo} style={{ width: 64, height: 64, borderRadius: 18 }} accessibilityLabel="Margube" />
          <View style={{ gap: 6 }}>
            <T size={34} weight="semibold" style={{ lineHeight: 36 }}>
              {canBio && biometric.name ? `Hola de nuevo,\n${firstName(biometric.name)}` : 'Te damos la\nbienvenida'}
            </T>
            <T size={15} color={colors.text3}>Entra con tu cuenta corporativa.</T>
          </View>
        </View>

        {!isSupabaseConfigured ? (
          <Banner tone="danger" title="Configuración incompleta">Falta la conexión con el servidor (EXPO_PUBLIC_SUPABASE_URL / KEY).</Banner>
        ) : null}

        <GlassCard radius={28} padding={20} style={{ gap: 14 }}>
          <GlassInput
            label="Correo"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
            placeholder="nombre@margube.es"
          />
          <GlassInput
            ref={passRef}
            label="Contraseña"
            value={pass}
            onChangeText={setPass}
            secure
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {err ? <Banner tone="danger">{err}</Banner> : null}
          <GlassButton title="Entrar" size="lg" onPress={submit} loading={loading} style={{ marginTop: 6 }} />
          {canBio ? (
            <GlassButton title={`Entrar con ${bio.label}`} icon={Fingerprint} variant="glass" size="md" onPress={bioLogin} />
          ) : null}
        </GlassCard>
      </View>

      <View style={{ alignItems: 'center', gap: 10, paddingBottom: 8 }}>
        <Pressable onPress={help} accessibilityRole="button" hitSlop={8}>
          <T size={14} weight="medium" color={colors.accentFg}>¿Primer acceso o contraseña olvidada?</T>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} color={colors.text3} />
          <T size={12} color={colors.text3}>Sesión guardada de forma segura en el dispositivo</T>
        </View>
      </View>
    </Screen>
  );
}
