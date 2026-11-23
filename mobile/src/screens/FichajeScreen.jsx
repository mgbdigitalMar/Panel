// Fichaje (registro de jornada), the app's version of the web's /fichaje: the clock on the brand
// panel with the one or two actions that make sense now, today's events, the month against the
// schedule, and corrections. The server sets every time (shared/services/timeTracking.js).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import { LogIn, LogOut, Coffee, Play, PenLine, Check, X, Undo2, Clock, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import {
  CLOCK_KINDS, CLOCK_STATES, CORRECTION_KINDS, CORRECTION_STATUS, FALLBACK_SCHEDULE,
  clockEvent, clockState, summarizeDay, summarizeRange, expectedMinutes, resolveSchedule,
  fetchTimeEntries, fetchTimeCorrections, fetchWorkSchedules, requestTimeCorrection, reviewTimeCorrection, cancelTimeCorrection,
  formatMinutes, madridDayKey, madridTime, madridInstant, monthStart, monthEnd, addDays, weekStart,
} from '@shared/services/timeTracking.js';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton } from '../components/common/GlassButton';
import { GlassInput, DateField, TimeField } from '../components/common/GlassInput';
import { BrandPanel, ON_BRAND } from '../components/common/Brand';
import { PressScale, HapticPressable } from '../components/common/Pressable';
import { Tag } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { Banner, ChipRail, EmptyState, Loading, ProgressBar, SectionHead, Sheet } from '../components/common/UI';
import { BRAND } from '../theme/tokens';

const ICONS = { in: LogIn, break_start: Coffee, break_end: Play, out: LogOut };
const TONE = { warning: 'amber', success: 'green', danger: 'rose', neutral: 'neutral', accent: 'accent' };
const monthTitle = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayTitle = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** The clock on the brand panel. Only this part re-renders every second. */
function ClockPanel({ entries, schedule, onClock, busy, error, unavailable }) {
  const now = useNow();
  const today = madridDayKey(now);
  const status = clockState(entries, now);
  const day = summarizeDay((entries || []).filter((e) => madridDayKey(e.at) === today), { now, dayKey: today });
  const expected = expectedMinutes(schedule, today);
  const pct = expected ? Math.min(100, (day.workedMinutes / expected) * 100) : 0;

  return (
    <BrandPanel padding={20} radius={28} style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <T size={13} weight="semibold" color={ON_BRAND.text2} style={{ textTransform: 'capitalize', flex: 1 }}>
          {now.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' })}
        </T>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.state === 'working' ? '#34D399' : status.state === 'break' ? '#FBBF24' : status.state === 'done' ? '#B7C8FF' : '#CBD2DF' }} />
          <T size={12.5} weight="bold" color={ON_BRAND.text}>{CLOCK_STATES[status.state].label}</T>
        </View>
      </View>

      <T heading size={56} weight="semibold" color={ON_BRAND.text} accessibilityLabel={`Son las ${madridTime(now)}`} style={{ fontVariant: ['tabular-nums'], lineHeight: 60 }}>
        {madridTime(now)}
        <T size={22} color={ON_BRAND.text2}> {String(now.getSeconds()).padStart(2, '0')}</T>
      </T>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          ['Entrada', status.firstIn ? madridTime(status.firstIn.at) : '—'],
          ['Trabajado', formatMinutes(day.workedMinutes)],
          ['Descansos', formatMinutes(day.breakMinutes)],
        ].map(([label, value]) => (
          <View key={label} style={{ flex: 1, padding: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', gap: 2 }}>
            <T size={11.5} weight="semibold" color={ON_BRAND.text2}>{label}</T>
            <T size={15.5} weight="bold" color={ON_BRAND.text} numberOfLines={1}>{value}</T>
          </View>
        ))}
      </View>

      {expected > 0 ? (
        <View style={{ gap: 6 }}>
          <ProgressBar value={pct} color="#FFFFFF" track="rgba(255,255,255,0.18)" height={8} accessibilityLabel="Jornada de hoy" />
          <T size={12.5} color={ON_BRAND.text2}>
            {day.workedMinutes >= expected ? `Jornada de hoy cumplida (${formatMinutes(expected)}).` : `Te quedan ${formatMinutes(expected - day.workedMinutes)} de ${formatMinutes(expected)}.`}
          </T>
        </View>
      ) : null}

      {unavailable ? (
        <T size={13.5} weight="semibold" color={ON_BRAND.text}>El fichaje aún no está activado: falta aplicar su migración en Supabase.</T>
      ) : (
        <View style={{ gap: 10 }}>
          {status.allowed.map((kind, i) => {
            const Icon = ICONS[kind];
            const primary = i === 0;
            return (
              <PressScale key={kind} haptic="medium" disabled={!!busy} onPress={() => onClock(kind)} accessibilityRole="button"
                accessibilityLabel={CLOCK_KINDS[kind].action} accessibilityState={{ disabled: !!busy, busy: busy === kind }}
                style={{
                  minHeight: 56, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                  backgroundColor: primary ? '#FFFFFF' : 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: primary ? '#FFFFFF' : 'rgba(255,255,255,0.24)',
                  opacity: busy && busy !== kind ? 0.6 : 1,
                }}>
                <Icon size={20} color={primary ? BRAND.navy : '#FFFFFF'} strokeWidth={2.2} />
                <T size={16} weight="bold" color={primary ? BRAND.navy : '#FFFFFF'}>{busy === kind ? 'Registrando…' : CLOCK_KINDS[kind].action}</T>
              </PressScale>
            );
          })}
          {error ? <T size={13.5} weight="semibold" color="#FECDD3" accessibilityRole="alert">{error}</T> : null}
        </View>
      )}
    </BrandPanel>
  );
}

/** Ask for (or, RR. HH., apply) a correction of one day's events. */
function CorrectionSheet({ visible, onClose, dayKey, employeeId, isAdmin, onDone }) {
  const { colors } = useTheme();
  const today = madridDayKey();
  const [day, setDay] = useState(dayKey || today);
  const [kind, setKind] = useState('out');
  const [time, setTime] = useState('');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [dayEntries, setDayEntries] = useState(undefined);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDay(dayKey || today); setKind('out'); setTime(''); setTarget(''); setReason(''); setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, dayKey]);

  useEffect(() => {
    if (!visible || !day) return undefined;
    let live = true;
    setDayEntries(undefined);
    fetchTimeEntries(supabase, { employeeId, from: day, to: day }).then((res) => {
      if (live) setDayEntries(res.error ? null : res.rows.filter((e) => !e.voided));
    });
    return () => { live = false; };
  }, [visible, day, employeeId]);

  const isVoid = kind === 'void';
  const submit = async () => {
    if (saving) return;
    if (!day || day > today) return setError('Elige un día que ya haya pasado o el de hoy.');
    if (isVoid && !target) return setError('Marca el fichaje que sobra.');
    if (!isVoid && !/^\d{2}:\d{2}$/.test(time)) return setError('Indica la hora correcta.');
    if (reason.trim().length < 5) return setError('Explica el motivo (al menos 5 caracteres).');
    const at = isVoid ? null : madridInstant(day, time);
    if (at && new Date(at) > new Date()) return setError('La hora corregida no puede ser futura.');
    setSaving(true);
    const res = await requestTimeCorrection(supabase, { kind, at, reason: reason.trim(), targetEntryId: target || null, employeeId: isAdmin ? employeeId : undefined });
    setSaving(false);
    if (res.error) return setError(toUserMessage(res.error));
    onDone(isAdmin ? 'Corrección aplicada' : 'Corrección enviada a RR. HH.');
    return onClose();
  };

  const choice = (id, label) => (
    <HapticPressable key={id} haptic="selection" onPress={() => { setTarget(id); setError(''); }}
      accessibilityRole="radio" accessibilityState={{ checked: target === id }}
      style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center', borderWidth: 1.5, borderColor: target === id ? colors.accent : colors.glassBorder, backgroundColor: target === id ? colors.accentSoft : 'transparent' }}>
      <T size={14.5} weight={target === id ? 'semibold' : 'regular'}>{label}</T>
    </HapticPressable>
  );

  return (
    <Sheet visible={visible} onClose={saving ? () => {} : onClose} title={isAdmin ? 'Corregir fichaje' : 'Solicitar corrección'}
      footer={<GlassButton title={isAdmin ? 'Aplicar corrección' : 'Enviar a RR. HH.'} size="lg" loading={saving} onPress={submit} />}>
      <View style={{ gap: 14 }}>
        <T size={13.5} color={colors.text2}>
          {isAdmin ? 'Se aplica al momento y queda registrada a tu nombre.' : 'RR. HH. la revisará. El fichaje original no se borra: queda marcado como corregido.'}
        </T>
        <DateField label="Día" value={day} onChange={(v) => { setDay(v); setTarget(''); setError(''); }} maximumDate={new Date()} required />
        <T size={13} weight="medium">Qué hay que corregir</T>
        <ChipRail value={kind} onChange={(v) => { setKind(v); setTarget(''); setError(''); }}
          options={Object.entries(CORRECTION_KINDS).map(([value, label]) => ({ value, label }))} />
        {!isVoid ? <TimeField label="Hora correcta" value={time} onChange={(v) => { setTime(v); setError(''); }} required /> : null}
        {dayEntries === undefined ? <Loading label="Cargando los fichajes de ese día…" /> : dayEntries === null ? (
          <Banner tone="danger">No se han podido cargar los fichajes de ese día.</Banner>
        ) : dayEntries.length ? (
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            <T size={13} weight="medium">{isVoid ? 'Fichaje que sobra' : '¿Sustituye a alguno? (si la hora estaba mal)'}</T>
            {!isVoid ? choice('', 'No, faltaba este fichaje') : null}
            {dayEntries.map((e) => choice(e.id, `${madridTime(e.at)} · ${CLOCK_KINDS[e.kind]?.label}${e.source === 'correction' ? ' (corregido)' : ''}`))}
          </View>
        ) : (
          <T size={13} color={colors.text3}>{isVoid ? 'Ese día no hay fichajes que quitar.' : 'Ese día no hay ningún fichaje.'}</T>
        )}
        <GlassInput label="Motivo" value={reason} onChangeText={(v) => { setReason(v); setError(''); }} multiline rows={3} maxLength={500} required
          placeholder="Por ejemplo: olvidé fichar la salida" />
        {error ? <T size={13.5} weight="semibold" color={colors.dangerFg} accessibilityRole="alert">{error}</T> : null}
      </View>
    </Sheet>
  );
}

export default function FichajeScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { user, employees = [] } = useAuth();
  const { personalDays = [] } = useData();
  const isAdmin = user?.role === 'admin';
  const today = madridDayKey();

  const [schedules, setSchedules] = useState([FALLBACK_SCHEDULE]);
  const [recent, setRecent] = useState({ rows: [], state: 'loading', missing: false });
  const [month, setMonth] = useState(monthStart(today));
  const [monthData, setMonthData] = useState({ rows: [], state: 'loading' });
  const [corrections, setCorrections] = useState({ rows: [], state: 'loading' });
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(null);
  const [clockError, setClockError] = useState('');
  const [sheet, setSheet] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(null);

  const loadRecent = useCallback(async () => {
    if (!user?.id) return;
    const res = await fetchTimeEntries(supabase, { employeeId: user.id, from: weekStart(today), to: today });
    setRecent(res.error ? (p) => ({ ...p, state: 'error', missing: !!res.missing }) : { rows: res.rows, state: 'ready', missing: false });
  }, [user?.id, today]);
  const loadMonth = useCallback(async () => {
    if (!user?.id) return;
    setMonthData((p) => ({ ...p, state: 'loading' }));
    const res = await fetchTimeEntries(supabase, { employeeId: user.id, from: month, to: monthEnd(month) });
    setMonthData(res.error ? { rows: [], state: 'error' } : { rows: res.rows, state: 'ready' });
  }, [user?.id, month]);
  const loadCorrections = useCallback(async () => {
    if (!user?.id) return;
    const res = await fetchTimeCorrections(supabase, { employeeId: user.id, limit: 30 });
    setCorrections(res.error ? { rows: [], state: 'error' } : { rows: res.rows, state: 'ready' });
    if (isAdmin) {
      const all = await fetchTimeCorrections(supabase, { status: 'pending' });
      if (!all.error) setPending(all.rows);
    }
  }, [user?.id, isAdmin]);
  const loadAll = useCallback(() => Promise.all([
    fetchWorkSchedules(supabase).then((l) => { if (l?.length) setSchedules(l); }),
    loadRecent(), loadMonth(), loadCorrections(),
  ]), [loadRecent, loadMonth, loadCorrections]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    // Clocked on the web meanwhile: catch up when the app comes back
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { loadRecent(); loadMonth(); loadCorrections(); } });
    return () => sub.remove();
  }, [loadRecent, loadMonth, loadCorrections]);

  const schedule = useMemo(() => resolveSchedule(schedules, user), [schedules, user]);
  const daysOff = useMemo(() => personalDays.filter((p) => p.status === 'approved' && String(p.employeeId) === String(user?.id)).map((p) => p.date), [personalDays, user?.id]);
  const { days, totals } = useMemo(() => summarizeRange(monthData.rows, { from: month, to: monthEnd(month), schedule, daysOff }), [monthData.rows, month, schedule, daysOff]);
  const shown = days.filter((d) => !d.future && (d.events.length || d.expectedMinutes)).reverse();
  const todays = recent.rows.filter((e) => madridDayKey(e.at) === today).sort((a, b) => new Date(a.at) - new Date(b.at));

  const onClock = async (kind) => {
    if (busy) return;
    setBusy(kind);
    setClockError('');
    const res = await clockEvent(supabase, kind, { source: 'app' });
    setBusy(null);
    if (res.error) {
      setClockError(toUserMessage(res.error));
      toast.error(toUserMessage(res.error));
      loadRecent();
      return;
    }
    toast.success(`${CLOCK_KINDS[kind].past} a las ${madridTime(res.entry.at)}`);
    setRecent((p) => ({ ...p, rows: [...p.rows, res.entry], state: 'ready' }));
    if (month === monthStart(today)) loadMonth();
  };

  const afterCorrection = (msg) => { toast.success(msg); loadRecent(); loadMonth(); loadCorrections(); };
  const review = async (id, approve, note) => {
    setReviewBusy(id);
    const res = await reviewTimeCorrection(supabase, id, approve, note);
    setReviewBusy(null);
    if (res.error) { toast.error(toUserMessage(res.error)); return false; }
    toast.success(approve ? 'Corrección aprobada' : 'Corrección rechazada');
    loadCorrections();
    return true;
  };
  const cancel = async (id) => {
    setReviewBusy(id);
    const res = await cancelTimeCorrection(supabase, id);
    setReviewBusy(null);
    if (res.error) toast.error(toUserMessage(res.error));
    else { toast.success('Corrección cancelada'); loadCorrections(); }
  };
  const nameOf = (id) => employees.find((e) => String(e.id) === String(id))?.name || '—';
  const describe = (c) => (c.kind === 'void' ? 'Quitar un fichaje que sobra' : `${CORRECTION_KINDS[c.kind]} · ${c.at ? `${dayTitle(madridDayKey(c.at))} ${madridTime(c.at)}` : ''}`);

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };
  const isCurrentMonth = month === monthStart(today);

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <Header back title="Fichaje" subtitle="Registro de jornada" />

      <ClockPanel entries={recent.rows} schedule={schedule} onClock={onClock} busy={busy}
        error={clockError || (recent.state === 'error' && !recent.missing ? 'No se han podido cargar tus fichajes de hoy.' : '')}
        unavailable={recent.missing} />

      <SectionHead title="Hoy" icon={Clock} action="Corregir" onAction={() => setSheet({ dayKey: today })} />
      {todays.length ? (
        <GlassCard padding={0}>
          {todays.map((e, i) => (
            <View key={e.id} accessible accessibilityLabel={`${madridTime(e.at)}, ${CLOCK_KINDS[e.kind]?.label}${e.voided ? ', anulado' : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
              <T mono weight="bold" size={15} style={e.voided ? { textDecorationLine: 'line-through', color: colors.text3 } : null}>{madridTime(e.at)}</T>
              <T size={14.5} style={[{ flex: 1 }, e.voided ? { textDecorationLine: 'line-through', color: colors.text3 } : null]} numberOfLines={1}>
                {CLOCK_KINDS[e.kind]?.label}{e.note ? ` · ${e.note}` : ''}
              </T>
              <T size={12} color={colors.text3}>{e.voided ? 'anulado' : e.source === 'correction' ? 'corregido' : e.source}</T>
            </View>
          ))}
        </GlassCard>
      ) : <T size={14} color={colors.text3}>Aún no has fichado hoy.</T>}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <T size={18} weight="semibold" accessibilityRole="header" style={{ textTransform: 'capitalize', flex: 1 }}>{monthTitle(month)}</T>
        <PressScale onPress={() => setMonth(monthStart(addDays(month, -1)))} accessibilityRole="button" accessibilityLabel="Mes anterior"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong }}>
          <ChevronLeft size={20} color={colors.text} />
        </PressScale>
        <PressScale disabled={isCurrentMonth} onPress={() => setMonth(monthStart(addDays(monthEnd(month), 1)))} accessibilityRole="button" accessibilityLabel="Mes siguiente"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, opacity: isCurrentMonth ? 0.4 : 1 }}>
          <ChevronRight size={20} color={colors.text} />
        </PressScale>
      </View>

      {monthData.state === 'loading' ? <Loading label="Cargando registro…" /> : monthData.state === 'error' ? (
        <EmptyState icon={Clock} title="No se ha podido cargar el registro" message="Comprueba la conexión." action={<GlassButton title="Reintentar" size="sm" onPress={loadMonth} />} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['Trabajado', formatMinutes(totals.worked)],
              ['Según horario', formatMinutes(totals.expected)],
              ['Diferencia', formatMinutes(totals.balance, { signed: true })],
              ['Por revisar', `${totals.incompleteDays + totals.missingDays} días`],
            ].map(([label, value]) => (
              <GlassCard key={label} padding={12} style={{ flexBasis: '47%', flexGrow: 1, gap: 2 }}>
                <T size={12} weight="semibold" color={colors.text3}>{label}</T>
                <T size={17} weight="bold">{value}</T>
              </GlassCard>
            ))}
          </View>
          {shown.length ? (
            <GlassCard padding={0}>
              {shown.map((d, i) => {
                const flag = d.incomplete ? ['Incompleto', 'rose'] : d.open ? ['En curso', 'accent'] : d.missing ? ['Sin fichar', 'amber'] : d.dayOff ? ['Día libre', 'neutral'] : null;
                return (
                  <PressScale key={d.dayKey} scaleTo={0.985} onPress={() => setSheet({ dayKey: d.dayKey })} accessibilityRole="button"
                    accessibilityLabel={`${dayTitle(d.dayKey)}: ${formatMinutes(d.workedMinutes)} de ${formatMinutes(d.expectedMinutes)}${flag ? `, ${flag[0]}` : ''}. Pulsa para corregir`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
                    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                      <T size={14.5} weight="semibold" style={{ textTransform: 'capitalize' }}>{dayTitle(d.dayKey)}</T>
                      <T size={12.5} color={colors.text3} numberOfLines={1}>
                        {d.events.length ? `${d.firstIn ? madridTime(d.firstIn) : '—'} – ${d.lastOut ? madridTime(d.lastOut) : '…'}` : 'Sin fichajes'} · {formatMinutes(d.workedMinutes)} de {formatMinutes(d.expectedMinutes)}
                      </T>
                    </View>
                    {flag ? <Tag label={flag[0]} tone={flag[1]} /> : d.diffMinutes ? (
                      <T mono weight="semibold" size={13.5} color={d.diffMinutes > 0 ? colors.successFg : colors.dangerFg}>{formatMinutes(d.diffMinutes, { signed: true })}</T>
                    ) : null}
                  </PressScale>
                );
              })}
            </GlassCard>
          ) : <EmptyState icon={Clock} title="Sin fichajes este mes" message="Cuando fiches, cada día aparecerá aquí con sus horas." />}
        </>
      )}

      {isAdmin && pending.length ? (
        <>
          <SectionHead title="Correcciones del equipo" count={pending.length} />
          <GlassCard padding={0}>
            {pending.map((c, i) => (
              <View key={c.id} style={{ padding: 16, gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
                <T size={15} weight="semibold">{nameOf(c.employeeId)}</T>
                <T size={13} color={colors.text2}>{describe(c)}</T>
                <T size={13} color={colors.text3}>{c.reason}</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <GlassButton title="Aprobar" icon={Check} size="sm" loading={reviewBusy === c.id} onPress={() => review(c.id, true)} style={{ flex: 1 }} />
                  <GlassButton title="Rechazar" icon={X} size="sm" variant="glass" disabled={reviewBusy === c.id} onPress={() => { setRejecting(c.id); setRejectNote(''); }} style={{ flex: 1 }} />
                </View>
              </View>
            ))}
          </GlassCard>
        </>
      ) : null}

      <SectionHead title="Tus correcciones" icon={PenLine} />
      {corrections.state === 'loading' ? <Loading /> : corrections.rows.length ? (
        <GlassCard padding={0}>
          {corrections.rows.map((c, i) => {
            const st = CORRECTION_STATUS[c.status];
            return (
              <View key={c.id} style={{ padding: 16, gap: 6, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T size={14.5} weight="semibold" style={{ flex: 1 }} numberOfLines={2}>{describe(c)}</T>
                  <Tag label={st.text} tone={TONE[st.tone]} />
                </View>
                <T size={13} color={colors.text3}>{c.reason}</T>
                {c.reviewNote ? <T size={13} color={colors.text2}>RR. HH.: {c.reviewNote}</T> : null}
                {c.status === 'pending' ? (
                  <GlassButton title="Cancelar" icon={Undo2} size="sm" variant="ghost" loading={reviewBusy === c.id} onPress={() => cancel(c.id)} />
                ) : null}
              </View>
            );
          })}
        </GlassCard>
      ) : <T size={14} color={colors.text3}>Si olvidas fichar, pulsa un día para pedir la corrección.</T>}

      <T size={12} color={colors.text3}>
        Registro diario de jornada (art. 34.9 ET). La hora la pone el servidor; los registros se conservan cuatro años y una corrección deja constancia del original.
      </T>

      <CorrectionSheet visible={!!sheet} onClose={() => setSheet(null)} dayKey={sheet?.dayKey} employeeId={user?.id} isAdmin={isAdmin} onDone={afterCorrection} />

      <Sheet visible={!!rejecting} onClose={() => setRejecting(null)} title="Rechazar corrección"
        footer={<GlassButton title="Rechazar" icon={X} size="lg" loading={reviewBusy === rejecting} onPress={async () => { if (await review(rejecting, false, rejectNote)) setRejecting(null); }} />}>
        <GlassInput label="Motivo del rechazo" value={rejectNote} onChangeText={setRejectNote} multiline rows={3} maxLength={500}
          hint="La persona recibirá un aviso con este motivo." />
      </Sheet>
    </Screen>
  );
}
