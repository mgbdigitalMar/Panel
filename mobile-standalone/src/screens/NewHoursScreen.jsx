// 15 · Registrar horas (Ya / Bolsa / Debo) — "Nueva solicitud" tab of the web HorasPage
import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { HOUR_TYPES } from '@shared/config/constants.js';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { ModalHeader } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton } from '../components/common/GlassButton';
import { GlassInput, DateField } from '../components/common/GlassInput';
import { PressScale } from '../components/common/Pressable';
import { T } from '../components/common/Text';
import { Segmented } from '../components/common/UI';
import { hourStats } from '../utils/domain';
import { fmtHM, fmtHMSigned, todayISO } from '../utils/format';

const MAX_MIN = 24 * 60; // web: 0 < hours <= 24
const CTA = { ya: 'Registrar ahora', bolsa: 'Enviar a aprobación', debe: 'Registrar deuda' };
const PREVIEW = { ya: 'Tu saldo aprobado', bolsa: 'Si se aprueba', debe: 'Tu saldo quedará' };
const SUCCESS = {
  ya: 'Compensación registrada',
  bolsa: 'Solicitud enviada. Pendiente de aprobación.',
  debe: 'Horas de deuda registradas',
};

export default function NewHoursScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useAuth();
  const { hourCompensations, createHourCompensation } = useData();
  const [mode, setMode] = useState('bolsa');
  const [min, setMin] = useState(60);
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const cfg = HOUR_TYPES[mode];
  const color = mode === 'ya' ? colors.successFg : mode === 'debe' ? colors.dangerFg : colors.accentFg;
  const balance = hourStats(hourCompensations.filter((h) => String(h.employeeId) === String(user?.id))).balance;
  const after = balance + (mode === 'debe' ? -min : min) / 60;

  const bump = (delta) => {
    Haptics.selectionAsync().catch(() => {});
    setMin((m) => Math.max(15, Math.min(MAX_MIN, m + delta)));
  };

  const submit = async () => {
    if (!date || !reason.trim() || min <= 0) return;
    setSaving(true);
    const res = await createHourCompensation({ date, reason: reason.trim(), hours: Math.round((min / 60) * 100) / 100, type: mode });
    setSaving(false);
    if (res?.error) {
      toast.error(toUserMessage(res.error));
      return;
    }
    toast.success(SUCCESS[mode]);
    navigation.goBack();
  };

  return (
    <Screen
      glow={false}
      footer={(
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={14} color={colors.text3}>{PREVIEW[mode]}</T>
            <T mono weight="semibold" size={15}>
              <T mono size={15} color={colors.text3}>{fmtHMSigned(balance)} → </T>{fmtHMSigned(after)}
            </T>
          </View>
          <GlassButton title={CTA[mode]} size="lg" color={mode === 'ya' ? colors.success : mode === 'debe' ? colors.danger : colors.accent}
            onPress={submit} loading={saving} disabled={!date || !reason.trim()} />
        </>
      )}
    >
      <ModalHeader title="Registrar horas" />

      <Segmented
        value={mode}
        onChange={setMode}
        height={48}
        options={[
          { value: 'ya', label: 'Ya', color: colors.successFg },
          { value: 'bolsa', label: 'Bolsa', color: colors.accentFg },
          { value: 'debe', label: 'Debo', color: colors.dangerFg },
        ]}
      />
      <T size={14} color={colors.text2}>{cfg.desc}. {cfg.banner}</T>

      <GlassCard radius={26} padding={18} style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressScale onPress={() => bump(-15)} accessibilityRole="button" accessibilityLabel="Restar 15 minutos"
            style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorderStrong }}>
            <T size={26} weight="medium">−</T>
          </PressScale>
          <View style={{ alignItems: 'center' }} accessibilityLiveRegion="polite">
            <T mono weight="semibold" size={52} color={color} tracking={-2} style={{ lineHeight: 58 }}>{mode === 'debe' ? '−' : '+'}{fmtHM(min / 60)}</T>
            <T size={12.5} color={colors.text3}>horas : minutos</T>
          </View>
          <PressScale onPress={() => bump(15)} accessibilityRole="button" accessibilityLabel="Sumar 15 minutos"
            style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorderStrong }}>
            <T size={26} weight="medium">+</T>
          </PressScale>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[30, 60, 120, 240].map((m) => {
            const on = m === min;
            return (
              <PressScale key={m} onPress={() => { Haptics.selectionAsync().catch(() => {}); setMin(m); }} accessibilityRole="button"
                style={{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.segOn : colors.segTrack }}>
                <T mono weight="semibold" size={14} color={on ? color : colors.text2}>{fmtHM(m / 60)}</T>
              </PressScale>
            );
          })}
        </View>
      </GlassCard>

      <DateField label={cfg.dateLabel} value={date} onChange={setDate} required />
      <GlassInput
        label={mode === 'debe' ? 'Motivo (llegada tarde, salida anticipada…)' : 'Motivo'}
        value={reason}
        onChangeText={setReason}
        required
        placeholder={mode === 'debe' ? 'Ej.: he entrado 30 min tarde por ir al banco' : 'Describe brevemente el motivo'}
      />
    </Screen>
  );
}
