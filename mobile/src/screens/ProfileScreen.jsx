// Mi perfil (ProfilePage on the web): info, work mode, password. Documents live in DocumentsScreen.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FileText, ChevronRight, ChevronLeft, KeyRound, Lock, CheckCircle2, Clock } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { allowedWorkModes, formatTeleworkDays } from '@shared/services/workMode.js';
import { fetchPolicySignatures, latestSignatureByUser, formatSignedAt } from '@shared/services/policy.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { GlassCard } from '../components/common/GlassCard';
import { GlassInput } from '../components/common/GlassInput';
import { GlassButton, IconButton } from '../components/common/GlassButton';
import { PressScale } from '../components/common/Pressable';
import { T } from '../components/common/Text';
import { Avatar, Segmented, IconTile, Banner, Sheet } from '../components/common/UI';
import { BrandPanel, BrandTag, ON_BRAND } from '../components/common/Brand';
import { WORK_MODES } from './EmployeesScreen';
import { MIN_PASSWORD, StrengthMeter } from './ChangePasswordScreen';
import { SignatureView } from '../components/SignaturePad';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../utils/format';

/** One label/value pair of "Mi información" (two per row). */
function Field({ label, value, mono }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '50%', paddingRight: 10, paddingBottom: 12, gap: 3 }}>
      <T size={11.5} weight="semibold" color={colors.text3}>{label}</T>
      <T size={14.5} weight="semibold" mono={mono} numberOfLines={2}>{value || '—'}</T>
    </View>
  );
}

/** Card title, 15 px semibold (Poppins) */
function CardTitle({ children }) {
  return <T size={15} heading weight="semibold" accessibilityRole="header">{children}</T>;
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user, changePassword } = useAuth();
  const { documents, requests, setWorkMode } = useData();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);
  const pendingDocs = documents.filter((d) => String(d.recipientId) === String(user?.id) && d.status === 'pending').length;
  const [pwOpen, setPwOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  // Own signature of the internal rules (the rules only return this person's)
  const [signature, setSignature] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    fetchPolicySignatures(supabase).then((list) => setSignature(list ? latestSignatureByUser(list)[user.id] || null : null));
  }, [user?.id, user?.policyAccepted]);

  const changeMode = async (mode) => {
    if (mode === (user?.workMode || 'Office')) return;
    setModeSaving(true);
    const { error } = await setWorkMode(user.id, mode);
    setModeSaving(false);
    if (error) toast.error(toUserMessage(error));
    else if (mode === 'Office') toast.success('Has vuelto a la oficina', 'Se ha avisado a administración.');
    else toast.success('Modo de trabajo actualizado correctamente');
  };
  // Remote / external need an approved request covering today
  const allowedModes = allowedWorkModes(requests, user?.id, undefined, user);

  const savePassword = async () => {
    setPwErr('');
    if (!pw.current) return setPwErr('Introduce la contraseña actual.');
    if (pw.next.length < MIN_PASSWORD) return setPwErr(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (pw.next !== pw.confirm) return setPwErr('Las contraseñas no coinciden.');
    setSaving(true);
    const { error } = await changePassword(pw.current, pw.next);
    setSaving(false);
    if (error) return setPwErr(toUserMessage(error));
    setPw({ current: '', next: '', confirm: '' });
    setPwOpen(false);
    toast.success('Contraseña actualizada', 'Usa la nueva en tu próximo inicio de sesión.');
    return undefined;
  };

  const workMode = user?.workMode || 'Office';
  const role = user?.role === 'admin' ? 'Administrador' : 'Empleado';
  const policySigned = !!signature || user?.policyAccepted === true;

  return (
    <Screen>
      {/* Back, title in the middle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <T size={17} heading weight="semibold" align="center" style={{ flex: 1 }} accessibilityRole="header">Mi perfil</T>
        <View style={{ width: 44 }} />
      </View>

      {/* Identity: the brand panel with the person's leaf avatar, centred */}
      <BrandPanel padding={22} style={{ alignItems: 'center', gap: 12 }}>
        <Avatar name={user?.name} initials={user?.avatar} src={user?.avatarUrl} size={84} ring="rgba(255,255,255,0.12)" />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T size={22} heading weight="semibold" color={ON_BRAND.text} align="center">{user?.name}</T>
          <T size={14} color={ON_BRAND.text2} align="center">{[user?.position, user?.dept].filter(Boolean).join(' · ') || role}</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          <BrandTag label={role} />
          <BrandTag label={WORK_MODES[workMode]?.label || 'Oficina'} />
          {user?.email ? <BrandTag label={user.email} /> : null}
        </View>
      </BrandPanel>

      <GlassCard style={{ gap: 12 }}>
        <CardTitle>Modo de trabajo{modeSaving ? ' · guardando…' : ''}</CardTitle>
        <Segmented value={workMode} onChange={changeMode} height={46}
          options={Object.entries(WORK_MODES).map(([k, m]) => ({ value: k, label: m.label, disabled: modeSaving || !allowedModes.has(k) }))} />
        {user?.teleworkDays?.length ? (
          <T size={12.5} color={colors.text3}>
            Teletrabajas los {formatTeleworkDays(user.teleworkDays)}: esos días tu modo pasa a Remoto automáticamente y el resto a Oficina.
          </T>
        ) : null}
        <T size={12.5} color={colors.text3}>
          {workMode === 'Office'
            ? 'Remoto y externo se activan solos cuando administración aprueba tu solicitud para hoy.'
            : 'Si vuelves antes a la oficina, elige Oficina: se avisará a administración.'}
        </T>
      </GlassCard>

      <GlassCard style={{ gap: 12 }}>
        <CardTitle>Mi información</CardTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: -12 }}>
          <Field label="Departamento" value={user?.dept} />
          <Field label="Rol" value={role} />
          <Field label="DNI" value={user?.phone} mono />
          <Field label="Fecha nacimiento" value={user?.birthdate ? fmtDate(user.birthdate) : 'No especificada'} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <IconTile icon={policySigned ? CheckCircle2 : Clock} tone={policySigned ? 'green' : 'amber'} size={34} />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <T size={14} weight="semibold">{policySigned ? 'Normas internas firmadas' : 'Normas internas pendientes'}</T>
            <T size={12.5} color={colors.text3} numberOfLines={1}>
              {signature ? formatSignedAt(signature.signedAt) : policySigned ? 'Registradas por RRHH' : 'Pendientes de firma'}
            </T>
          </View>
          {signature?.strokes ? (
            <Pressable onPress={() => setSignatureOpen(true)} accessibilityRole="button" hitSlop={10}>
              <T size={13.5} weight="semibold" color={colors.accentFg}>Ver firma</T>
            </Pressable>
          ) : null}
        </View>
      </GlassCard>

      {/* Password and documents as rows; the password form opens in place */}
      <GlassCard padding={0}>
        <PressScale onPress={() => setPwOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: pwOpen }} scaleTo={0.985}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16 }}>
          <Lock size={19} color={colors.text2} />
          <T size={15} weight="medium" style={{ flex: 1 }}>Cambiar contraseña</T>
          <ChevronRight size={18} color={colors.text3} style={{ transform: [{ rotate: pwOpen ? '90deg' : '0deg' }] }} />
        </PressScale>
        {pwOpen ? (
          <View style={{ gap: 14, paddingHorizontal: 16, paddingBottom: 16 }}>
            <GlassInput label="Contraseña actual" value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} secure autoComplete="current-password" />
            <GlassInput label="Nueva contraseña" value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} secure autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} />
            {pw.next ? <StrengthMeter value={pw.next} /> : null}
            <GlassInput label="Confirmar nueva contraseña" value={pw.confirm} onChangeText={(v) => setPw((p) => ({ ...p, confirm: v }))} secure autoComplete="new-password" />
            {pwErr ? <Banner tone="danger">{pwErr}</Banner> : null}
            <GlassButton title="Actualizar contraseña" icon={KeyRound} onPress={savePassword} loading={saving} disabled={!pw.next} />
          </View>
        ) : null}
        <PressScale onPress={() => navigation.navigate('Documents')} accessibilityRole="button" scaleTo={0.985}
          accessibilityLabel={pendingDocs ? `Mis documentos, ${pendingDocs} pendientes` : 'Mis documentos'}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <FileText size={19} color={colors.text2} />
          <T size={15} weight="medium" style={{ flex: 1 }}>Mis documentos</T>
          {pendingDocs ? (
            <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
              <T size={12} weight="bold" color="#FFFFFF" style={{ lineHeight: 14 }}>{pendingDocs}</T>
            </View>
          ) : null}
          <ChevronRight size={18} color={colors.text3} />
        </PressScale>
      </GlassCard>

      <Sheet visible={signatureOpen} onClose={() => setSignatureOpen(false)} title="Tu firma de las normas internas">
        {signature ? (
          <View style={{ gap: 10 }}>
            <SignatureView strokes={signature.strokes} label="Tu firma de las normas internas" />
            <T size={13} color={colors.text3}>Firmadas el {formatSignedAt(signature.signedAt)}{signature.signerName ? ` como «${signature.signerName}»` : ''}</T>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
