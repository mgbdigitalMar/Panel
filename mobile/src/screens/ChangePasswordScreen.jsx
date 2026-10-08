// 02 · Primer acceso: nueva contraseña (ChangePasswordPage on the web)
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyRound, Check } from 'lucide-react-native';
import { verifyPasswordAsync } from '@shared/services/auth.js';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth, FIRST_ACCESS_PASSWORD } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import bcrypt from '../lib/bcrypt';
import { Screen } from '../components/common/Screen';
import { GlassCard } from '../components/common/GlassCard';
import { GlassInput } from '../components/common/GlassInput';
import { GlassButton } from '../components/common/GlassButton';
import { T } from '../components/common/Text';
import { Banner } from '../components/common/UI';
import { firstName } from '../utils/format';

export const MIN_PASSWORD = 8; // same minimum as the web

export function passwordChecks(p) {
  return {
    length: p.length >= MIN_PASSWORD,
    mixed: /[A-ZÁÉÍÓÚÑ]/.test(p) && /\d/.test(p),
    symbol: /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(p),
    long: p.length >= 12,
  };
}

export function StrengthMeter({ value }) {
  const { colors } = useTheme();
  const c = passwordChecks(value);
  const score = value ? [c.length, c.mixed, c.symbol, c.long].filter(Boolean).length : 0;
  const label = ['', 'Débil', 'Aceptable', 'Segura', 'Muy segura'][score];
  const color = score <= 1 ? colors.dangerFg : score === 2 ? colors.warningFg : colors.successFg;
  return (
    <View style={{ gap: 8 }} accessibilityLabel={`Seguridad: ${label || 'sin contraseña'}`}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < score ? color : colors.segTrack }} />
        ))}
      </View>
      {label ? <T size={13} weight="medium" color={color}>{label}</T> : null}
    </View>
  );
}

function Rule({ ok, children }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{
        width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
        backgroundColor: ok ? colors.success : 'transparent', borderWidth: ok ? 0 : 1.5, borderColor: colors.text3,
      }}
      >
        {ok ? <Check size={14} color="#062016" strokeWidth={3} /> : null}
      </View>
      <T size={14} color={ok ? colors.text : colors.text2}>{children}</T>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const { colors } = useTheme();
  const { user, setNewPassword, logout } = useAuth();
  const toast = useToast();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const c = passwordChecks(pass);

  const save = async () => {
    setErr('');
    if (!c.length) return setErr(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (pass !== confirm) return setErr('Las contraseñas no coinciden.');
    if (pass === FIRST_ACCESS_PASSWORD) return setErr('Elige una contraseña distinta de la temporal.');
    setLoading(true);
    try {
      const { data } = await supabase.from('profiles').select('password_hash').eq('id', user.id).single();
      if (data?.password_hash && await verifyPasswordAsync(pass, data.password_hash, bcrypt)) {
        setLoading(false);
        return setErr('Elige una contraseña distinta de la temporal.');
      }
      const { error } = await setNewPassword(pass);
      setLoading(false);
      if (error) return setErr(toUserMessage(error));
      toast.success('Contraseña guardada', 'Ya puedes usar la intranet.');
    } catch (e) {
      setLoading(false);
      setErr(toUserMessage(e));
    }
    return undefined;
  };

  return (
    <Screen contentStyle={{ paddingTop: 70, gap: 24 }}
      footer={<GlassButton title="Guardar y continuar" size="lg" onPress={save} loading={loading} disabled={!pass || !confirm} />}>
      <View style={{ gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' }}>
          <KeyRound size={26} color={colors.warningFg} />
        </View>
        <T size={13} weight="semibold" color={colors.warningFg} upper>Primer acceso</T>
        <T size={30} weight="semibold">Crea tu propia contraseña</T>
        <T size={15} color={colors.text2}>
          Hola {firstName(user?.name)}, la contraseña temporal que te ha dado RRHH ya no sirve. Elige una nueva para continuar.
        </T>
      </View>

      <GlassCard radius={26} padding={20} style={{ gap: 16 }}>
        <GlassInput label="Nueva contraseña" value={pass} onChangeText={setPass} secure autoComplete="new-password" textContentType="newPassword" />
        <StrengthMeter value={pass} />
        <View style={{ gap: 10 }}>
          <Rule ok={c.length}>Mínimo {MIN_PASSWORD} caracteres</Rule>
          <Rule ok={c.mixed}>Una mayúscula y un número (recomendado)</Rule>
          <Rule ok={c.symbol}>Un símbolo (opcional)</Rule>
        </View>
        <GlassInput label="Repite la contraseña" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password"
          error={confirm && pass !== confirm ? 'Las contraseñas no coinciden.' : ''} returnKeyType="go" onSubmitEditing={save} />
        {err ? <Banner tone="danger">{err}</Banner> : null}
      </GlassCard>

      <Pressable onPress={logout} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
        <T size={14} weight="medium" color={colors.text3}>Salir y entrar con otra cuenta</T>
      </Pressable>
    </Screen>
  );
}
