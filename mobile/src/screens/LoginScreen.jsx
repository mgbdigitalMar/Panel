// 01 · Iniciar sesión
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Pressable, View } from 'react-native';
import { Fingerprint, Info, LogIn, Moon, Sun } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Screen } from '../components/common/Screen';
import { GlassInput } from '../components/common/GlassInput';
import { GlassButton, IconButton } from '../components/common/GlassButton';
import { AuthBackdrop, BrandOrb, useReduceMotion } from '../components/common/AuthBackdrop';
import { T } from '../components/common/Text';
import { Banner } from '../components/common/UI';
import { biometricSupport } from '../services/biometrics';
import { isSupabaseConfigured } from '../lib/supabase';
import { firstName } from '../utils/format';

/** Staggered fade-up for the screen's blocks, on the native driver. */
function useEntrance(count, reduce) {
  const [values] = useState(() => Array.from({ length: count }, () => new Animated.Value(0)));
  useEffect(() => {
    if (reduce) { values.forEach((v) => v.setValue(1)); return; }
    Animated.stagger(70, values.map((v) => Animated.timing(v, {
      toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }))).start();
  }, [reduce, values]);
  return values.map((v) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  }));
}

function Divider({ label }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
      <T size={13} color={colors.text3}>{label}</T>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
    </View>
  );
}

export default function LoginScreen() {
  const { colors, theme, setMode } = useTheme();
  const { login, loginWithBiometrics, biometric, lastEmail } = useAuth();
  const [email, setEmail] = useState(lastEmail || '');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [bio, setBio] = useState({ available: false, label: 'biometría' });
  const passRef = useRef(null);
  const reduce = useReduceMotion();
  const [aTop, aOrb, aTitle, aForm, aFoot] = useEntrance(5, reduce);

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
  const isDark = theme === 'dark';

  return (
    <Screen
      backdrop={<AuthBackdrop />}
      contentStyle={{ flexGrow: 1, justifyContent: 'space-between', gap: 20, maxWidth: 440, width: '100%', alignSelf: 'center' }}
    >
      <View>
        {/* Top bar */}
        <Animated.View style={[{ flexDirection: 'row', justifyContent: 'space-between' }, aTop]}>
          <IconButton
            icon={isDark ? Sun : Moon}
            onPress={() => setMode(isDark ? 'light' : 'dark')}
            accessibilityLabel={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          />
          <IconButton icon={Info} onPress={help} accessibilityLabel="Ayuda para acceder" />
        </Animated.View>

        {/* Orb + heading */}
        <Animated.View style={[{ alignItems: 'center', marginTop: -24 }, aOrb]}>
          <BrandOrb size={100} />
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center', gap: 8, marginTop: -8, paddingHorizontal: 12 }, aTitle]}>
          <T size={28} weight="semibold" style={{ textAlign: 'center', lineHeight: 34 }}>
            {canBio && biometric.name ? `¡Hola de nuevo, ${firstName(biometric.name)}!` : 'Te damos la bienvenida'}
          </T>
          <T size={14.5} color={colors.text3} style={{ textAlign: 'center', lineHeight: 21, maxWidth: 300 }}>
            Inicia sesión para acceder a tus reservas, solicitudes y novedades de Margube.
          </T>
        </Animated.View>

        {/* Form */}
        <Animated.View style={[{ gap: 16, marginTop: 28 }, aForm]}>
          {!isSupabaseConfigured ? (
            <Banner tone="danger" title="Configuración incompleta">Falta la conexión con el servidor (EXPO_PUBLIC_SUPABASE_URL / KEY).</Banner>
          ) : null}

          <GlassInput
            label="Correo electrónico"
            required
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
          <View style={{ gap: 10 }}>
            <GlassInput
              ref={passRef}
              label="Contraseña"
              required
              value={pass}
              onChangeText={setPass}
              secure
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              placeholder="Tu contraseña"
            />
            <Pressable onPress={help} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'flex-end' }}>
              <T size={13} weight="medium" color={colors.accentFg}>¿Olvidaste tu contraseña?</T>
            </Pressable>
          </View>

          {err ? <Banner tone="danger">{err}</Banner> : null}

          <GlassButton title="Iniciar sesión" icon={LogIn} size="lg" onPress={submit} loading={loading} style={{ marginTop: 4 }} />

          {canBio ? (
            <>
              <Divider label="o continúa con" />
              <GlassButton title={`Entrar con ${bio.label}`} icon={Fingerprint} variant="glass" size="md" onPress={bioLogin} />
            </>
          ) : null}
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View style={[{ alignItems: 'center', paddingBottom: 4 }, aFoot]}>
        <Pressable onPress={help} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T size={14} color={colors.text3}>¿Primer acceso? </T>
          <T size={14} weight="semibold" color={colors.text}>Contacta con RRHH</T>
        </Pressable>
      </Animated.View>
    </Screen>
  );
}
