// 21 · Gestión de usuarios (AdminPage > Empleados on the web)
import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ExpoCrypto from 'expo-crypto';
import { Search, UserPlus, Pencil, KeyRound, UserMinus, UsersRound, PenLine, RotateCcw, Check, ShieldCheck } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { fetchPolicySignatures, latestSignatureByUser, policyStatus, formatSignedAt, PLATFORM_LABELS, POLICY_TITLE } from '@shared/services/policy.js';
import { supabase } from '../../lib/supabase';
import { SignatureView } from '../../components/SignaturePad';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Screen } from '../../components/common/Screen';
import { Header } from '../../components/common/Header';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassButton } from '../../components/common/GlassButton';
import { GlassInput } from '../../components/common/GlassInput';
import { PressScale } from '../../components/common/Pressable';
import { Tag } from '../../components/common/StatusBadge';
import { T } from '../../components/common/Text';
import { Avatar, ChipRail, EmptyState, Sheet, Banner, InfoLine } from '../../components/common/UI';
import { FONTS } from '../../theme/tokens';
import { MIN_PASSWORD } from '../ChangePasswordScreen';

export function tempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = ExpoCrypto.getRandomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, employees, refreshEmployees } = useAuth();
  const { deleteEmployee, resetEmployeePassword, setPolicyAccepted } = useData();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [reset, setReset] = useState(null); // { emp, password }
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Signatures of the internal rules (policy_signatures): who signed, when and from where
  const [signatures, setSignatures] = useState(undefined); // undefined = loading, null = failed
  const loadSignatures = async () => setSignatures(await fetchPolicySignatures(supabase));
  useEffect(() => { fetchPolicySignatures(supabase).then(setSignatures); }, []);
  const lastSignature = useMemo(() => latestSignatureByUser(signatures), [signatures]);
  const policyCounts = useMemo(() => {
    const c = { signed: 0, manual: 0, pending: 0 };
    employees.forEach((e) => { c[policyStatus(e, lastSignature[e.id])]++; });
    return c;
  }, [employees, lastSignature]);
  const [policyId, setPolicyId] = useState(null);
  const policyEmp = employees.find((e) => e.id === policyId) || null;

  const firstAccess = employees.filter((e) => e.firstLogin === true || e.firstLogin === 'true').length;
  const admins = employees.filter((e) => e.role === 'admin').length;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matchRole = (e) => role === 'all'
      || (role === 'first' ? (e.firstLogin === true || e.firstLogin === 'true')
        : role === 'policy' ? policyStatus(e, lastSignature[e.id]) === 'pending'
          : e.role === role);
    return employees.filter((e) => matchRole(e) && (!needle || `${e.name} ${e.email}`.toLowerCase().includes(needle)));
  }, [employees, q, role, lastSignature]);

  const remove = (emp) => {
    if (emp.id === user?.id) {
      toast.error('No puedes darte de baja a ti mismo.');
      return;
    }
    confirm({ title: 'Eliminar empleado', message: `Se eliminará a ${emp.name}, su acceso y todos sus archivos asociados. Esta acción no se puede deshacer.` }).then(async (ok) => {
      if (!ok) return;
      setBusy(true);
      const { error } = await deleteEmployee(emp.id);
      setBusy(false);
      if (error) toast.error(toUserMessage(error));
      else { setExpanded(null); toast.success('Empleado eliminado'); }
    });
  };

  const changePolicy = async (emp, accepted) => {
    setBusy(true);
    const { error } = await setPolicyAccepted(emp.id, accepted);
    setBusy(false);
    if (error) toast.error(toUserMessage(error));
    else toast.success(accepted ? 'Normas marcadas como aceptadas' : 'Se le pedirá firmar de nuevo', accepted ? 'Sin firma digital.' : 'Al entrar tendrá que leer y firmar las normas.');
  };

  const doReset = async () => {
    if (!reset || reset.password.length < MIN_PASSWORD) return;
    setBusy(true);
    const { error } = await resetEmployeePassword(reset.emp.id, reset.password);
    setBusy(false);
    if (error) toast.error(toUserMessage(error));
    else {
      toast.success('Contraseña temporal guardada', `${reset.emp.name.split(' ')[0]} deberá cambiarla al entrar.`);
      setReset(null);
    }
  };

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await Promise.all([refreshEmployees(), loadSignatures()]); setRefreshing(false); }} refreshing={refreshing}>
      <Header back title="Usuarios" right={<GlassButton title="Alta" icon={UserPlus} size="sm" onPress={() => navigation.navigate('UserForm', {})} />} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[[employees.length - firstAccess, 'Activos', colors.successFg], [firstAccess, 'Primer acceso', colors.warningFg], [admins, 'Admins', colors.purpleFg]].map(([n, l, c]) => (
          <GlassCard key={l} padding={12} style={{ flex: 1, gap: 2 }}>
            <T mono weight="semibold" size={24} color={c}>{n}</T>
            <T size={12} color={colors.text3}>{l}</T>
          </GlassCard>
        ))}
      </View>

      <GlassCard padding={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ShieldCheck size={18} color={colors.successFg} />
        <T size={13.5} color={colors.text2} style={{ flex: 1 }}>
          <T size={13.5} weight="semibold">Normas internas: </T>
          {signatures === null ? 'no se han podido cargar las firmas'
            : `${policyCounts.signed} de ${employees.length} firmadas${policyCounts.manual ? ` · ${policyCounts.manual} sin firma` : ''}${policyCounts.pending ? ` · ${policyCounts.pending} pendientes` : ''}`}
        </T>
      </GlassCard>

      <View style={{ justifyContent: 'center' }}>
        <Search size={18} color={colors.text3} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre o correo" placeholderTextColor={colors.muted} accessibilityLabel="Buscar usuario" autoCapitalize="none"
          style={{ height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.glassBorderStrong, backgroundColor: colors.inputBg, color: colors.text, fontFamily: FONTS.regular, fontSize: 15, paddingLeft: 42, paddingRight: 14 }} />
      </View>

      <ChipRail value={role} onChange={setRole} options={[
        { value: 'all', label: 'Todos' }, { value: 'admin', label: 'Admins' }, { value: 'employee', label: 'Empleados' }, { value: 'first', label: 'Primer acceso' },
        { value: 'policy', label: 'Firma pendiente', count: policyCounts.pending },
      ]} />

      <View style={{ gap: 8 }}>
        {list.length === 0 ? <EmptyState icon={UsersRound} title="Sin resultados" /> : list.map((e) => {
          const open = expanded === e.id;
          const first = e.firstLogin === true || e.firstLogin === 'true';
          return (
            <View key={e.id} style={{ borderRadius: 20, backgroundColor: open ? colors.glassStrong : colors.glass, borderWidth: 1, borderColor: open ? colors.accentBorder : colors.glassBorder, overflow: 'hidden' }}>
              <PressScale onPress={() => setExpanded(open ? null : e.id)} scaleTo={0.985} accessibilityRole="button" accessibilityState={{ expanded: open }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                <Avatar name={e.name} initials={e.avatar} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={15} weight="semibold" numberOfLines={1}>{e.name}</T>
                  <T size={12.5} color={first ? colors.warningFg : colors.text3} numberOfLines={1}>
                    {first ? `Primer acceso pendiente · ${e.dept || 'Sin asignar'}` : `${e.dept || 'Sin asignar'} · ${e.email}`}
                  </T>
                  {(() => {
                    const sig = lastSignature[e.id];
                    const st = policyStatus(e, sig);
                    return (
                      <T size={12} weight="medium" numberOfLines={1}
                        color={st === 'signed' ? colors.successFg : st === 'manual' ? colors.text3 : colors.warningFg}>
                        {st === 'signed' ? `Normas firmadas el ${formatSignedAt(sig.signedAt).slice(0, 10)}`
                          : st === 'manual' ? 'Normas aceptadas sin firma' : 'Firma de normas pendiente'}
                      </T>
                    );
                  })()}
                </View>
                <Tag label={e.role === 'admin' ? 'ADMIN' : 'Empleado'} tone={e.role === 'admin' ? 'purple' : 'neutral'} />
              </PressScale>
              {open ? (
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
                  <GlassButton title="Editar" icon={Pencil} variant="glass" size="sm" style={{ flex: 1 }} onPress={() => navigation.navigate('UserForm', { id: e.id })} />
                  <GlassButton title="Clave" icon={KeyRound} variant="glass" size="sm" style={{ flex: 1 }} onPress={() => setReset({ emp: e, password: tempPassword() })} />
                  <GlassButton title="Baja" icon={UserMinus} variant="danger" size="sm" style={{ flex: 1 }} disabled={busy || e.id === user?.id} onPress={() => remove(e)} />
                </View>
              ) : null}
              {open ? (
                <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                  <GlassButton title="Firma de las normas" icon={PenLine} variant="glass" size="sm" onPress={() => setPolicyId(e.id)} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Sheet visible={!!policyEmp} onClose={() => setPolicyId(null)} title="Normas internas"
        footer={policyEmp ? (policyEmp.policyAccepted === true
          ? <GlassButton title="Pedir que vuelva a firmar" icon={RotateCcw} variant="glass" size="lg" loading={busy} onPress={() => changePolicy(policyEmp, false)} />
          : <GlassButton title="Marcar como aceptadas sin firma" icon={Check} variant="glass" size="lg" loading={busy} onPress={() => changePolicy(policyEmp, true)} />) : null}>
        {policyEmp ? (() => {
          const sig = lastSignature[policyEmp.id];
          const st = policyStatus(policyEmp, sig);
          const history = (signatures || []).filter((x) => x.userId === policyEmp.id);
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={policyEmp.name} initials={policyEmp.avatar} size={42} />
                <View style={{ flex: 1 }}>
                  <T size={16} weight="semibold" numberOfLines={1}>{policyEmp.name}</T>
                  <T size={13} color={st === 'signed' ? colors.successFg : st === 'manual' ? colors.text3 : colors.warningFg}>
                    {st === 'signed' ? 'Normas firmadas' : st === 'manual' ? 'Aceptadas sin firma digital' : 'Firma pendiente'}
                  </T>
                </View>
              </View>
              {sig ? (
                <>
                  <T size={12} weight="semibold" color={colors.text3}>{st === 'pending' ? 'ÚLTIMA FIRMA (SE LE HA PEDIDO FIRMAR DE NUEVO)' : 'FIRMA'}</T>
                  <SignatureView strokes={sig.strokes} label={`Firma de ${sig.signerName}`} />
                  <View>
                    <InfoLine label="Nombre escrito" value={sig.signerName} />
                    <InfoLine label="Fecha y hora" value={formatSignedAt(sig.signedAt)} mono />
                    <InfoLine label="Documento" value={sig.documentTitle || POLICY_TITLE} />
                    <InfoLine label="Desde" value={PLATFORM_LABELS[sig.platform] || sig.platform || '—'} />
                    <InfoLine label="Acepta las normas" value="Sí, al firmar" last />
                  </View>
                </>
              ) : (
                <T size={14} color={colors.text2}>
                  {signatures === undefined ? 'Cargando firmas…'
                    : signatures === null ? 'No se han podido cargar las firmas. Desliza hacia abajo en la lista para reintentar.'
                      : st === 'manual' ? 'RRHH marcó las normas como aceptadas sin firma digital (por ejemplo, firmadas en papel).'
                        : 'Todavía no ha firmado. Tendrá que leer y firmar las normas la próxima vez que entre, en la web o en la app.'}
                </T>
              )}
              {history.length > 1 ? (
                <T size={12.5} color={colors.text3}>Firmas anteriores: {history.slice(1).map((x) => formatSignedAt(x.signedAt)).join(' · ')}</T>
              ) : null}
            </>
          );
        })() : null}
      </Sheet>

      <Sheet visible={!!reset} onClose={() => setReset(null)} title="Restablecer contraseña"
        footer={<GlassButton title="Guardar contraseña temporal" size="lg" loading={busy} disabled={!reset || reset.password.length < MIN_PASSWORD} onPress={doReset} />}>
        {reset ? (
          <>
            <T size={15} color={colors.text2}>
              {reset.emp.name} entrará con esta contraseña y la app le pedirá crear una propia.
            </T>
            <GlassInput label="Contraseña temporal" value={reset.password} onChangeText={(v) => setReset((r) => ({ ...r, password: v }))}
              autoCapitalize="none" autoCorrect={false} inputStyle={{ fontFamily: FONTS.mono, letterSpacing: 1 }} selectTextOnFocus />
            <GlassButton title="Generar otra" variant="ghost" size="sm" onPress={() => setReset((r) => ({ ...r, password: tempPassword() }))} />
            <Banner tone="amber">Comunícasela por un canal seguro. No se volverá a mostrar.</Banner>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
