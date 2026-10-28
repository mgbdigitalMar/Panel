// 01 · Iniciar sesión — dark hero with the Margube monogram, the form on a glass sheet
import { forwardRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AlertCircle, Check, Eye, EyeOff, Fingerprint, Lock, Mail, ScanFace } from 'lucide-react-native';
import { IDLE_TIMEOUT_MOBILE } from '@shared/config/constants.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Screen } from '../components/common/Screen';
import { useReduceMotion } from '../components/common/AuthBackdrop';
import { T } from '../components/common/Text';
import { Banner } from '../components/common/UI';
import { biometricSupport } from '../services/biometrics';
import { isSupabaseConfigured } from '../lib/supabase';
import { firstName, greeting } from '../utils/format';
import { BRAND, FONTS } from '../theme/tokens';

const LOGO = require('../../assets/logo.png');
const HERO_BG = '#0B0F14';
const AnimatedPath = Animated.createAnimatedComponent(Path);

// The "M" of Margube drawn in an 11 × 9 grid of tiles (two legs and a V)
const COLS = 11;
const ROWS = 9;
const TILE = 18;
const GAP = 6;
const TILES = Array.from({ length: ROWS * COLS }, (_, i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const on = c <= 1 || c >= 9 || (r <= 4 && (c === r || c === r + 1 || c === 10 - r || c === 9 - r)) || (r === 5 && c === 5);
  return { key: i, on, delay: (r + c) * 90 };
});
const GRID_W = COLS * TILE + (COLS - 1) * GAP;
const GRID_H = ROWS * TILE + (ROWS - 1) * GAP;

/** Repeats an animation forever after an initial delay; stops on unmount. */
function useLoop(make, deps, reduce) {
  useEffect(() => {
    if (reduce) return undefined;
    const anim = make();
    anim.start();
    return () => anim.stop();
  }, [reduce, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** A lit tile breathing in a wave across the monogram. */
function OnTile({ delay, color, reduce }) {
  const [v] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useLoop(() => Animated.sequence([
    Animated.delay(delay),
    Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1530, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 1870, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ])),
  ]), [delay], reduce);
  return (
    <Animated.View
      style={{
        width: TILE, height: TILE, borderRadius: 5, backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
      }}
    />
  );
}

function Monogram({ color, reduce }) {
  const [scan] = useState(() => new Animated.Value(0));
  useLoop(() => Animated.sequence([
    Animated.delay(1400),
    Animated.loop(Animated.sequence([
      Animated.timing(scan, { toValue: 1, duration: 3100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scan, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(3400),
    ])),
  ]), [], reduce);
  return (
    <View style={{ width: GRID_W, height: GRID_H }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {TILES.map((t) => (t.on
          ? <OnTile key={t.key} delay={t.delay} color={color} reduce={reduce} />
          : <View key={t.key} style={{ width: TILE, height: TILE, borderRadius: 5, backgroundColor: 'rgba(237,241,243,0.055)', borderWidth: 1, borderColor: 'rgba(237,241,243,0.06)' }} />))}
      </View>
      {reduce ? null : (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: -20, right: -20, top: 0, height: 2, backgroundColor: color,
            shadowColor: color, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
            opacity: scan.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 0.55, 0.55, 0] }),
            transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [0, GRID_H] }) }],
          }}
        />
      )}
    </View>
  );
}

/** Dot grid + a slow breathing glow in the brand blue, behind the hero. */
function HeroBackdrop({ color, reduce }) {
  const [b] = useState(() => new Animated.Value(0));
  useLoop(() => Animated.loop(Animated.sequence([
    Animated.timing(b, { toValue: 1, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    Animated.timing(b, { toValue: 0, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
  ])), [], reduce);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: HERO_BG }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <Circle cx="9" cy="9" r="1" fill="rgba(237,241,243,0.075)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dots)" />
      </Svg>
      <Animated.View style={{
        position: 'absolute', top: 40, alignSelf: 'center', width: 380, height: 380,
        opacity: b.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
        transform: [{ scale: b.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }],
      }}
      >
        <Svg width={380} height={380}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color} stopOpacity={0.3} />
              <Stop offset="0.55" stopColor={color} stopOpacity={0.1} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={190} cy={190} r={190} fill="url(#glow)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Field with the icon on the left and the label inside that floats up when focused or filled. */
const FloatField = forwardRef(function FloatField({ icon: Icon, label, value, onChangeText, secure, right, ...input }, ref) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  const up = focus || !!value;
  const [v] = useState(() => new Animated.Value(up ? 1 : 0));
  useEffect(() => {
    Animated.timing(v, { toValue: up ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [up, v]);
  const accent = colors.accentFg;
  return (
    <View style={{ justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 16, zIndex: 1 }}>
        <Icon size={19} color={focus ? accent : colors.text3} strokeWidth={1.9} />
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        accessibilityLabel={label}
        placeholderTextColor="transparent"
        style={{
          height: 56, borderRadius: 18, borderWidth: 1, borderColor: focus ? accent : colors.inputBorder,
          backgroundColor: colors.neutralSoft, color: colors.text, fontFamily: FONTS.medium, fontSize: 16,
          paddingLeft: 48, paddingRight: right ? 54 : 16, paddingTop: 18, paddingBottom: 4,
        }}
        {...input}
      />
      <Animated.Text
        pointerEvents="none"
        style={{
          position: 'absolute', left: 48, fontFamily: up ? FONTS.semibold : FONTS.regular, fontSize: 15,
          color: up ? accent : colors.text3, transformOrigin: 'left center',
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -13] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) },
          ],
        }}
      >
        {up ? label.toUpperCase() : label}
      </Animated.Text>
      {right ? <View style={{ position: 'absolute', right: 6 }}>{right}</View> : null}
    </View>
  );
});

function RememberCheck({ value, onChange }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="checkbox" accessibilityState={{ checked: value }} hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44 }}>
      <View style={{
        width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
        borderColor: value ? colors.accent : colors.text3, backgroundColor: value ? colors.accent : 'transparent',
      }}
      >
        {value ? <Check size={14} color={colors.onAccent} strokeWidth={3} /> : null}
      </View>
      <T size={14}>Recordarme</T>
    </Pressable>
  );
}

/** Primary button with a light sweeping across it now and then. */
function EnterButton({ onPress, loading, disabled, reduce }) {
  const { colors } = useTheme();
  const [s] = useState(() => new Animated.Value(0));
  const [w, setW] = useState(0);
  const [press] = useState(() => new Animated.Value(1));
  useLoop(() => Animated.sequence([
    Animated.delay(2200),
    Animated.loop(Animated.sequence([
      Animated.timing(s, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(s, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])),
  ]), [], reduce);
  const springTo = (to) => Animated.spring(press, { toValue: to, damping: 14, stiffness: 420, useNativeDriver: true }).start();
  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={() => springTo(0.96)} onPressOut={() => springTo(1)}
      accessibilityRole="button" accessibilityState={{ disabled, busy: loading }} accessibilityLabel={loading ? 'Verificando' : 'Entrar'}>
      <Animated.View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{
          height: 56, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.accent,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, transform: [{ scale: press }],
        }}
      >
        {reduce || !w ? null : (
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: -10, bottom: -10, width: w * 0.26, backgroundColor: 'rgba(255,255,255,0.35)',
            transform: [{ translateX: s.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.45, w * 1.25] }) }, { skewX: '-20deg' }],
            left: 0,
          }}
          />
        )}
        {loading ? <ActivityIndicator color={colors.onAccent} /> : null}
        <T size={16} heading weight="semibold" color={colors.onAccent}>{loading ? 'Verificando…' : 'Entrar'}</T>
      </Animated.View>
    </Pressable>
  );
}

/** The greeting's live dot, pinging outwards. */
function PulseDot({ color, reduce }) {
  const [p] = useState(() => new Animated.Value(0));
  useLoop(() => Animated.loop(Animated.timing(p, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true })), [], reduce);
  return (
    <View style={{ width: 7, height: 7 }}>
      <Animated.View style={{
        position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: color,
        opacity: p.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.8, 0, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 2.8, 2.8] }) }],
      }}
      />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

/** Hand-drawn underline under "sesión", drawn once. */
function Squiggle({ color, reduce }) {
  const [d] = useState(() => new Animated.Value(reduce ? 0 : 260));
  useEffect(() => {
    if (reduce) { d.setValue(0); return; }
    Animated.timing(d, { toValue: 0, duration: 1000, delay: 900, easing: Easing.bezier(0.6, 0, 0.2, 1), useNativeDriver: false }).start();
  }, [reduce, d]);
  return (
    <Svg viewBox="0 0 200 20" preserveAspectRatio="none" style={{ position: 'absolute', left: '-2%', bottom: -6, width: '104%', height: 12 }}>
      <AnimatedPath d="M3 13 C 40 4, 70 18, 105 9 S 170 4, 197 11" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray="260" strokeDashoffset={d} />
    </Svg>
  );
}

export default function LoginScreen() {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { login, loginWithBiometrics, biometric, lastEmail } = useAuth();
  const [email, setEmail] = useState(lastEmail || '');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [bio, setBio] = useState({ available: false, label: 'biometría' });
  const passRef = useRef(null);
  const reduce = useReduceMotion();
  const isDark = theme === 'dark';
  // On the dark hero the light blue reads best in both themes
  const heroAccent = isDark ? colors.accent : BRAND.blueLight;

  const [sheetIn] = useState(() => new Animated.Value(reduce ? 1 : 0));
  const [shake] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(sheetIn, { toValue: 1, duration: reduce ? 0 : 900, delay: 150, easing: Easing.bezier(0.2, 0.85, 0.2, 1), useNativeDriver: true }).start();
  }, [reduce, sheetIn]);
  useEffect(() => { biometricSupport().then(setBio); }, []);
  // The remembered email loads after the first render: fill it in once if the field is still empty
  const [seenEmail, setSeenEmail] = useState(lastEmail);
  if (lastEmail !== seenEmail) {
    setSeenEmail(lastEmail);
    if (lastEmail && !email) setEmail(lastEmail);
  }

  const fail = (msg) => {
    setErr(msg);
    if (reduce) return;
    shake.setValue(0);
    Animated.sequence([-8, 8, -8, 8, -4, 4, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: true }))).start();
  };

  const submit = async () => {
    if (loading) return;
    if (!email.trim() || !pass) return fail('Introduce tu correo y tu contraseña.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return fail('Revisa el correo (nombre@margube.es).');
    setLoading(true);
    setErr('');
    const res = await login(email, pass, { remember });
    setLoading(false);
    if (!res.ok) fail(res.msg);
    return undefined;
  };

  const bioLogin = async () => {
    setErr('');
    const res = await loginWithBiometrics();
    if (!res.ok && res.msg) fail(res.msg);
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
  const BioIcon = /face/i.test(bio.label) ? ScanFace : Fingerprint;
  const idleMin = Math.round(IDLE_TIMEOUT_MOBILE / 60000);
  const hello = canBio && biometric.name ? `${greeting(new Date())}, ${firstName(biometric.name)}` : greeting(new Date());

  return (
    <Screen
      padded={false}
      glow={false}
      backdrop={<HeroBackdrop color={heroAccent} reduce={reduce} />}
      contentStyle={{ flexGrow: 1, paddingTop: 0, paddingBottom: 0, gap: 0, maxWidth: '100%' }}
    >
      <StatusBar style="light" />

      {/* Hero: the logo pill and the monogram */}
      <View style={{ flex: 1, minHeight: 330, alignItems: 'center', justifyContent: 'center', gap: 28, paddingTop: insets.top + 18, paddingBottom: 46 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderTopColor: 'rgba(255,255,255,0.24)',
        }}
        >
          <Image source={LOGO} style={{ width: 30, height: 30, borderRadius: 9 }} accessibilityLabel="Logotipo de Margube" />
          <T size={17} heading weight="bold" color="#EDF1F3" tracking={-0.5}>Margube</T>
          <T size={10} mono weight="semibold" color="#B8C2C9" tracking={1.4}>INTRANET</T>
        </View>
        <Monogram color={heroAccent} reduce={reduce} />
      </View>

      {/* Glass sheet with the form */}
      <Animated.View style={{
        marginTop: -30, paddingTop: 10, paddingHorizontal: 22, paddingBottom: Math.max(insets.bottom, 12) + 18,
        borderTopLeftRadius: 34, borderTopRightRadius: 34, backgroundColor: isDark ? 'rgba(19,22,29,0.97)' : 'rgba(250,251,252,0.98)',
        borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.14)' : '#FFFFFF',
        shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: -12 }, elevation: 16,
        transform: [{ translateY: sheetIn.interpolate({ inputRange: [0, 1], outputRange: [380, 0] }) }],
      }}
      >
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: colors.inputBorder, alignSelf: 'center', marginBottom: 18 }} />

        <Animated.View style={{ gap: 10, maxWidth: 440, width: '100%', alignSelf: 'center', transform: [{ translateX: shake }] }}>
          <View style={{ gap: 10, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <PulseDot color={colors.accent} reduce={reduce} />
              <T size={11} mono weight="semibold" color={colors.text3} tracking={1.3}>{hello.toUpperCase()}</T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <T size={34} heading weight="bold" tracking={-1.5} style={{ lineHeight: 38 }} accessibilityRole="header">Inicia </T>
              <View>
                <T size={34} heading weight="bold" tracking={-1.5} style={{ lineHeight: 38 }}>sesión</T>
                <Squiggle color={colors.accent} reduce={reduce} />
              </View>
            </View>
          </View>

          {!isSupabaseConfigured ? (
            <Banner tone="danger" title="Configuración incompleta">Falta la conexión con el servidor (EXPO_PUBLIC_SUPABASE_URL / KEY).</Banner>
          ) : null}

          <FloatField
            icon={Mail}
            label="Correo corporativo"
            value={email}
            onChangeText={(t) => { setEmail(t); setErr(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
          />
          <FloatField
            ref={passRef}
            icon={Lock}
            label="Contraseña"
            value={pass}
            onChangeText={(t) => { setPass(t); setErr(''); }}
            secure={!show}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            right={(
              <Pressable onPress={() => setShow((x) => !x)} accessibilityRole="button" accessibilityLabel={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                {show ? <EyeOff size={19} color={colors.text3} /> : <Eye size={19} color={colors.text3} />}
              </Pressable>
            )}
          />

          {err ? (
            <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 11, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.dangerSoft }}>
              <AlertCircle size={17} color={colors.dangerFg} style={{ marginTop: 1 }} />
              <T size={13.5} color={colors.dangerFg} style={{ flex: 1 }}>{err}</T>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <RememberCheck value={remember} onChange={setRemember} />
            <Pressable onPress={help} accessibilityRole="button" hitSlop={8} style={{ paddingVertical: 12 }}>
              <T size={14} style={{ textDecorationLine: 'underline', textDecorationColor: colors.accent }}>¿Olvidaste la contraseña?</T>
            </Pressable>
          </View>

          <EnterButton onPress={submit} loading={loading} disabled={loading} reduce={reduce} />

          {canBio ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.inputBorder }} />
                <T size={11} mono weight="semibold" color={colors.text3} tracking={1.5}>O</T>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.inputBorder }} />
              </View>
              <Pressable onPress={bioLogin} disabled={loading} accessibilityRole="button" accessibilityLabel={`Entrar con ${bio.label}`}
                style={({ pressed }) => ({
                  height: 54, borderRadius: 18, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.neutralSoft,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <BioIcon size={24} color={colors.accentFg} strokeWidth={1.8} />
                <T size={15} weight="semibold">Entrar con {bio.label}</T>
              </Pressable>
            </>
          ) : null}

          <T size={12.5} color={colors.text3} align="center" style={{ marginTop: 6 }}>
            La sesión se pausa tras {idleMin} minutos de inactividad.
          </T>
        </Animated.View>
      </Animated.View>
    </Screen>
  );
}
