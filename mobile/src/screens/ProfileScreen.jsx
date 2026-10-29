// Mi perfil (ProfilePage on the web): info, work mode, password. Documents live in DocumentsScreen.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FileText, ChevronRight, ChevronLeft, KeyRound, Lock, CheckCircle2, Clock, Cake, IdCard, ArrowDown, Timer } from 'lucide-react-native';
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
import { T } from '../components/common/Text';
import { Avatar, Segmented, IconTile, Banner, Sheet } from '../components/common/UI';
import { BrandTag, ON_BRAND } from '../components/common/Brand';
import { AccentTile, CapsuleBars, FileChip, InfoTile, PhotoHero } from '../components/common/Bento';
import { tone as toneOf } from '../theme/tokens';
import { WORK_MODES } from './EmployeesScreen';
import { MIN_PASSWORD, StrengthMeter } from './ChangePasswordScreen';
import { SignatureView } from '../components/SignaturePad';
import { supabase } from '../lib/supabase';
import { fmtDate, fmtHM, parseDate, MONTHS_SHORT } from '../utils/format';

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
  const { documents, requests, hourCompensations, setWorkMode } = useData();
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

  // Approved hours earned in each of the last six months, scaled to the busiest one
  const months = useMemo(() => {
    const now = new Date();
    const list = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, y: d.getFullYear(), m: d.getMonth(), hours: 0 };
    });
    hourCompensations.forEach((h) => {
      if (String(h.employeeId) !== String(user?.id) || h.status !== 'approved' || h.type === 'debe') return;
      const d = parseDate(h.date);
      const slot = d && list.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
      if (slot) slot.hours += Number(h.hours) || 0;
    });
    const max = Math.max(...list.map((x) => x.hours), 0);
    return list.map((x, i) => ({
      key: x.key,
      label: MONTHS_SHORT[x.m],
      value: max ? (x.hours / max) * 100 : 0,
      highlight: i === list.length - 1,
      accessibilityLabel: `${MONTHS_SHORT[x.m]}: ${fmtHM(x.hours)} horas`,
      hours: x.hours,
    }));
  }, [hourCompensations, user?.id]);
  const sixMonthHours = months.reduce((s, x) => s + x.hours, 0);

  const workMode = user?.workMode || 'Office';
  const role = user?.role === 'admin' ? 'Administrador' : 'Empleado';
  const policySigned = !!signature || user?.policyAccepted === true;
  const birth = parseDate(user?.birthdate);

  return (
    <Screen>
      {/* Identity: the photo (or the leaf avatar on the brand gradient) with the name over it */}
      <PhotoHero
        src={user?.avatarUrl}
        fallback={<Avatar name={user?.name} initials={user?.avatar} size={132} ring="rgba(255,255,255,0.22)" />}
        top={(
          <>
            <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
            <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: 'rgba(10,12,16,0.35)' }}>
              <T size={13} weight="semibold" color={ON_BRAND.text} accessibilityRole="header">Mi perfil</T>
            </View>
          </>
        )}
      >
        <T size={30} weight="light" color={ON_BRAND.text} align="center" numberOfLines={2}>{user?.name}</T>
        <T size={14} color={ON_BRAND.text2} align="center" numberOfLines={1}>{[user?.position, user?.dept].filter(Boolean).join(' · ') || role}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 }}>
          <BrandTag label={role} />
          <BrandTag label={WORK_MODES[workMode]?.label || 'Oficina'} />
        </View>
      </PhotoHero>

      {/* Bento: birthday in brand blue, the DNI beside it */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AccentTile
          icon={Cake}
          label="Cumpleaños"
          value={birth ? `${birth.getDate()} ${MONTHS_SHORT[birth.getMonth()]}` : '—'}
          sub={birth ? String(birth.getFullYear()) : 'No especificada'}
          style={{ flex: 1.1 }}
          accessibilityLabel={birth ? `Fecha de nacimiento: ${fmtDate(user.birthdate)}` : 'Fecha de nacimiento no especificada'}
        />
        <InfoTile icon={IdCard} label="DNI" value={user?.phone || '—'} mono sub={user?.email} style={{ flex: 1 }} />
      </View>

      <GlassCard style={{ gap: 16 }} onPress={() => navigation.navigate('Main', { screen: 'Horas' })}
        accessibilityLabel={`Horas ganadas en los últimos seis meses: ${fmtHM(sixMonthHours)}. Abrir horas`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Timer size={17} color={colors.text2} />
          <CardTitle>Horas ganadas</CardTitle>
          <View style={{ flex: 1 }} />
          <T mono weight="semibold" size={14} color={colors.text2}>{fmtHM(sixMonthHours)} h</T>
          <ChevronRight size={18} color={colors.text3} />
        </View>
        <CapsuleBars items={months} height={84} width={14} />
      </GlassCard>

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
          <Field label="Puesto" value={user?.position} />
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

      {/* Documents and password as file chips; the password form opens below them */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <FileChip
          icon={FileText}
          action={ChevronRight}
          title="Documentos"
          sub={pendingDocs ? `${pendingDocs} por revisar` : 'Nóminas y contratos'}
          badge={pendingDocs || null}
          tone={toneOf(colors, 'accent')}
          onPress={() => navigation.navigate('Documents')}
          accessibilityLabel={pendingDocs ? `Mis documentos, ${pendingDocs} pendientes` : 'Mis documentos'}
        />
        <FileChip
          icon={Lock}
          action={ArrowDown}
          title="Contraseña"
          sub={pwOpen ? 'Cerrar' : 'Cambiar'}
          tone={toneOf(colors, pwOpen ? 'purple' : 'neutral')}
          onPress={() => setPwOpen((o) => !o)}
          accessibilityLabel="Cambiar contraseña"
        />
      </View>
      {pwOpen ? (
        <GlassCard style={{ gap: 14 }}>
          <CardTitle>Cambiar contraseña</CardTitle>
          <GlassInput label="Contraseña actual" value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} secure autoComplete="current-password" />
          <GlassInput label="Nueva contraseña" value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} secure autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} />
          {pw.next ? <StrengthMeter value={pw.next} /> : null}
          <GlassInput label="Confirmar nueva contraseña" value={pw.confirm} onChangeText={(v) => setPw((p) => ({ ...p, confirm: v }))} secure autoComplete="new-password" />
          {pwErr ? <Banner tone="danger">{pwErr}</Banner> : null}
          <GlassButton title="Actualizar contraseña" icon={KeyRound} onPress={savePassword} loading={saving} disabled={!pw.next} />
        </GlassCard>
      ) : null}

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
