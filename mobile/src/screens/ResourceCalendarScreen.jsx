import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Building2, Car, AlertTriangle, CheckCircle2, Plus } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton, IconButton } from '../components/common/GlassButton';
import { GlassInput, DateField, TimeField } from '../components/common/GlassInput';
import { PressScale } from '../components/common/Pressable';
import { T } from '../components/common/Text';
import { EmptyState, IconTile, Segmented, Sheet } from '../components/common/UI';
import { DAY_START, DAY_END, reservationsFor, findConflicts, nearbyFreeSlots, dayLoad, reservationStatusLabel } from '../utils/domain';
import { addDays, startOfWeek, toISODate, parseDate, fmtMonthYear, fmtDayShort, fmtDayLong, DAYS_SHORT, MONTHS_SHORT, timeToMin, minToTime, todayISO } from '../utils/format';

const HOUR_H = 48;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START / 60 + i);

function loadColor(colors, load) {
  return load === 'full' ? colors.dangerFg : load === 'busy' ? colors.warningFg : colors.successFg;
}

export default function ResourceCalendarScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { params } = useRoute();
  const toast = useToast();
  const { user } = useAuth();
  const { rooms, vehicles, reservations, createReservation } = useData();

  const type = params?.type === 'vehicle' ? 'vehicle' : 'room';
  const resource = (type === 'room' ? rooms : vehicles).find((r) => String(r.id) === String(params?.id));

  const [view, setView] = useState('week');
  const [selDate, setSelDate] = useState(() => parseDate(params?.date) || new Date());
  const [monthCursor, setMonthCursor] = useState(() => new Date(selDate.getFullYear(), selDate.getMonth(), 1));
  const [selection, setSelection] = useState(null); // { start, end }
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState({ date: '', start: '', end: '', purpose: '' });
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const iso = toISODate(selDate);
  const isPast = iso < todayISO();
  const dayItems = useMemo(() => (resource ? reservationsFor(reservations, { type, resourceId: resource.id, date: iso }) : []), [reservations, resource, type, iso]);
  const weekDays = useMemo(() => {
    const start = startOfWeek(selDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selDate]);

  if (!resource) {
    return (
      <Screen>
        <Header title="Recurso" back />
        <EmptyState icon={type === 'room' ? Building2 : Car} title="Recurso no disponible" message="Puede que se haya eliminado o desactivado." />
      </Screen>
    );
  }

  const title = type === 'room' ? resource.name : resource.model;
  const meta = type === 'room'
    ? [`${resource.capacity} personas`, `Planta ${resource.floor}`, (resource.equipment || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ')
    : [resource.plate, resource.type, resource.year].filter(Boolean).join(' · ');

  const loadFor = (d) => dayLoad(reservationsFor(reservations, { type, resourceId: resource.id, date: toISODate(d) }));
  const selConflicts = selection ? findConflicts(dayItems, selection.start, selection.end) : [];

  const pickSlot = (hour) => {
    if (isPast) return;
    const start = hour * 60;
    const end = Math.min(DAY_END, start + 60);
    setSelection({ start: minToTime(start), end: minToTime(end) });
  };

  const openSheet = () => {
    let defaultStart = '09:00';
    let defaultEnd = '10:00';
    if (iso === todayISO()) {
      const currentH = now.getHours();
      const nextH = Math.min(19, Math.max(8, currentH + 1));
      defaultStart = `${String(nextH).padStart(2, '0')}:00`;
      defaultEnd = `${String(nextH + 1).padStart(2, '0')}:00`;
    }
    setForm({ date: iso, start: selection?.start || defaultStart, end: selection?.end || defaultEnd, purpose: '' });
    setSheet(true);
  };

  // ── sheet (design 10) ──
  const sheetItems = form.date ? reservationsFor(reservations, { type, resourceId: resource.id, date: form.date }) : [];
  const invalidRange = form.start && form.end && timeToMin(form.end) <= timeToMin(form.start);
  const conflicts = form.start && form.end && !invalidRange ? findConflicts(sheetItems, form.start, form.end) : [];
  const freeSlots = conflicts.length ? nearbyFreeSlots(sheetItems, form.start, form.end) : [];
  const overlapMin = conflicts.reduce((m, r) => Math.max(m, Math.min(timeToMin(r.timeEnd), timeToMin(form.end)) - Math.max(timeToMin(r.timeStart), timeToMin(form.start))), 0);
  const canSend = form.date && form.date >= todayISO() && !invalidRange && conflicts.length === 0 && !!form.purpose?.trim();

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    const res = await createReservation({
      type,
      [type === 'room' ? 'room_id' : 'vehicle_id']: resource.id,
      date: form.date,
      time_start: form.start,
      time_end: form.end,
      purpose: form.purpose?.trim() || (type === 'room' ? 'Reserva de sala' : 'Uso de vehículo'),
      status: 'pending',
      resourceName: title,
    });
    setSending(false);
    if (res?.error) {
      toast.error(toUserMessage(res.error));
      return;
    }
    setSheet(false);
    setSelection(null);
    toast.success('Reserva enviada', 'Quedará pendiente hasta que un administrador la apruebe.');
  };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = iso === todayISO() && nowMin >= DAY_START && nowMin <= DAY_END;
  const top = (t) => 8 + ((timeToMin(t) - DAY_START) / 60) * HOUR_H;

  const footer = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        {selection ? (
          <>
            <T size={15} weight="semibold" numberOfLines={1}>{fmtDayShort(iso)} · {selection.start}–{selection.end}</T>
            <T size={13} color={selConflicts.length ? colors.dangerFg : colors.successFg} numberOfLines={1}>
              {selConflicts.length ? 'Se solapa con otra reserva' : 'Sin conflictos'}
            </T>
          </>
        ) : (
          <T size={14} color={colors.text3} numberOfLines={1}>{isPast ? 'No se puede reservar en días pasados.' : `Reservar ${type === 'room' ? 'esta sala' : 'este vehículo'}`}</T>
        )}
      </View>
      <GlassButton title={selection ? 'Continuar' : 'Reservar'} icon={selection ? undefined : Plus} onPress={openSheet} disabled={isPast} size="md" />
    </View>
  );

  return (
    <Screen glow={false} footer={footer}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <Segmented value={view} onChange={setView} style={{ width: 180 }} height={42}
          options={[{ value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' }]} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon={type === 'room' ? Building2 : Car} tone={type === 'room' ? 'accent' : 'teal'} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={24} weight="semibold" numberOfLines={1}>{title}</T>
          <T size={13.5} color={colors.text3} numberOfLines={1}>{meta}</T>
        </View>
      </View>

      {view === 'week' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
            <Pressable
              onPress={() => { setSelDate(addDays(selDate, -7)); setSelection(null); }}
              hitSlop={12}
              accessibilityLabel="Semana anterior"
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.glass,
                borderWidth: 1,
                borderColor: colors.glassBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={20} color={colors.text} />
            </Pressable>

            <View style={{ alignItems: 'center', gap: 2 }}>
              <T size={15.5} weight="bold" style={{ textTransform: 'capitalize' }}>{fmtMonthYear(selDate)}</T>
              <T size={12} color={colors.text3}>
                {`Semana ${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTHS_SHORT[weekDays[6].getMonth()]}`}
              </T>
            </View>

            <Pressable
              onPress={() => { setSelDate(addDays(selDate, 7)); setSelection(null); }}
              hitSlop={12}
              accessibilityLabel="Semana siguiente"
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.glass,
                borderWidth: 1,
                borderColor: colors.glassBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronRight size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingVertical: 2 }}
          >
            {weekDays.map((d) => {
              const dIso = toISODate(d);
              const on = dIso === iso;
              const isToday = dIso === todayISO();
              const past = dIso < todayISO();
              const dayName = DAYS_SHORT[d.getDay()];
              const load = loadFor(d);

              return (
                <PressScale
                  key={dIso}
                  onPress={() => { setSelDate(d); setSelection(null); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={fmtDayShort(d)}
                  style={{
                    width: 56,
                    height: 74,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    backgroundColor: on ? colors.chipOnBg : colors.glass,
                    borderWidth: on ? 1.5 : 1,
                    borderColor: on ? colors.accentBorder : isToday ? colors.accent : colors.glassBorder,
                    opacity: past && !on ? 0.55 : 1,
                    ...(on ? {
                      shadowColor: colors.accent,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35,
                      shadowRadius: 8,
                      elevation: 4,
                    } : null),
                  }}
                >
                  <T
                    size={11.5}
                    weight={on ? 'bold' : 'semibold'}
                    color={on ? colors.chipOnText : isToday ? colors.accent : colors.text2}
                  >
                    {dayName}
                  </T>
                  <T
                    mono
                    weight="bold"
                    size={19}
                    color={on ? colors.chipOnText : colors.text}
                  >
                    {d.getDate()}
                  </T>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: on ? colors.chipOnText : loadColor(colors, load),
                      opacity: on ? 0.85 : 1,
                    }}
                  />
                </PressScale>
              );
            })}
          </ScrollView>

          <GlassCard padding={12} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={15.5} weight="semibold">{fmtDayLong(selDate)}</T>
              <T size={12.5} color={colors.text3}>
                {isPast
                  ? 'Día pasado · No disponible para nuevas reservas'
                  : dayItems.length === 0
                    ? 'Sin reservas · Todo el horario disponible'
                    : `${dayItems.length} reserva${dayItems.length > 1 ? 's' : ''} programada${dayItems.length > 1 ? 's' : ''}`}
              </T>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 10,
                backgroundColor: colors.glassStrong,
                borderWidth: 1,
                borderColor: colors.glassBorder,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: loadColor(colors, loadFor(selDate)) }} />
              <T size={12} weight="semibold" color={colors.text2}>
                {loadFor(selDate) === 'full' ? 'Completo' : loadFor(selDate) === 'busy' ? 'Casi lleno' : 'Libre'}
              </T>
            </View>
          </GlassCard>

          <View style={{ height: HOURS.length * HOUR_H - HOUR_H + 24, borderRadius: 22, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, overflow: 'hidden' }}>
            {HOURS.map((h, i) => (
              <Pressable
                key={h}
                onPress={() => i < HOURS.length - 1 && pickSlot(h)}
                disabled={i === HOURS.length - 1}
                accessibilityLabel={`${minToTime(h * 60)}`}
                style={{ position: 'absolute', left: 0, right: 0, top: 8 + i * HOUR_H - 7, height: HOUR_H, flexDirection: 'row' }}
              >
                <T mono size={11} color={colors.text3} style={{ width: 52, paddingLeft: 12 }}>{minToTime(h * 60)}</T>
                <View style={{ flex: 1, height: 1, marginTop: 7, backgroundColor: colors.divider }} />
              </Pressable>
            ))}

            {dayItems.map((r) => {
              const mine = r.employeeId === user?.id;
              const tone = r.status === 'confirmed' ? (mine ? 'accent' : 'green') : 'amber';
              const bg = tone === 'accent' ? colors.accentSoft : tone === 'green' ? colors.successSoft : colors.warningSoft;
              const fg = tone === 'accent' ? colors.accentFg : tone === 'green' ? colors.successFg : colors.warningFg;
              const h = Math.max(28, top(r.timeEnd) - top(r.timeStart) - 2);
              return (
                <Pressable
                  key={r.id}
                  onPress={() => navigation.navigate('MyReservations', { scope: mine ? 'mine' : 'all', date: iso })}
                  style={{ position: 'absolute', left: 60, right: 10, top: top(r.timeStart) + 1, height: h, borderRadius: 12, backgroundColor: bg, borderWidth: 1, borderColor: fg, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' }}
                >
                  <T size={13} weight="semibold" numberOfLines={1}>{r.purpose || 'Reserva'}{mine ? ' · Tú' : r.employeeName ? ` · ${r.employeeName.split(' ')[0]}` : ''}</T>
                  {h > 40 ? <T size={12} color={fg}>{r.timeStart}–{r.timeEnd} · {reservationStatusLabel(r.status)}</T> : null}
                </Pressable>
              );
            })}

            {selection ? (
              <Pressable onPress={openSheet} style={{
                position: 'absolute', left: 60, right: 10, top: top(selection.start) + 1, height: Math.max(28, top(selection.end) - top(selection.start) - 2),
                borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: selConflicts.length ? colors.dangerFg : colors.text,
                backgroundColor: colors.glassStrong, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
              >
                <T size={13} weight="semibold">Tu selección · {selection.start}–{selection.end}</T>
                <CheckCircle2 size={18} color={selConflicts.length ? colors.dangerFg : colors.text} />
              </Pressable>
            ) : null}

            {showNow ? (
              <View pointerEvents="none" style={{ position: 'absolute', left: 52, right: 0, top: top(minToTime(nowMin)), height: 2, backgroundColor: colors.danger }}>
                <View style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger }} />
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <View style={{ borderRadius: 22, padding: 14, gap: 8, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} hitSlop={10} accessibilityLabel="Mes anterior" style={{ padding: 6 }}>
              <ChevronLeft size={22} color={colors.text} />
            </Pressable>
            <T size={15} weight="semibold">{fmtMonthYear(monthCursor)}</T>
            <Pressable onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} hitSlop={10} accessibilityLabel="Mes siguiente" style={{ padding: 6 }}>
              <ChevronRight size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((l) => (
              <T key={l} size={11} weight="semibold" color={colors.text3} style={{ flex: 1, textAlign: 'center' }}>{l}</T>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {(() => {
              const first = startOfWeek(monthCursor);
              const cells = [];
              for (let i = 0; i < 42; i += 1) {
                const d = addDays(first, i);
                if (i >= 35 && d.getMonth() !== monthCursor.getMonth()) break;
                const inMonth = d.getMonth() === monthCursor.getMonth();
                const dIso = toISODate(d);
                const isToday = dIso === todayISO();
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                const load = loadFor(d);
                cells.push(
                  <View key={dIso} style={{ width: `${100 / 7}%`, padding: 2 }}>
                    <Pressable
                      disabled={!inMonth}
                      onPress={() => { setSelDate(d); setSelection(null); setView('week'); }}
                      accessibilityLabel={fmtDayShort(d)}
                      style={{
                        height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4,
                        backgroundColor: isToday ? colors.chipOnBg : inMonth && !weekend ? colors.glass : 'transparent',
                      }}
                    >
                      <T mono weight="semibold" size={14} color={isToday ? colors.chipOnText : !inMonth ? 'transparent' : weekend ? colors.muted : colors.text}>{d.getDate()}</T>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: inMonth && !weekend ? loadColor(colors, load) : 'transparent' }} />
                    </Pressable>
                  </View>,
                );
              }
              return cells;
            })()}
          </View>
          <View style={{ flexDirection: 'row', gap: 14, paddingTop: 6, flexWrap: 'wrap' }}>
            {[['free', 'Hay huecos'], ['busy', 'Casi lleno'], ['full', 'Completo']].map(([k, l]) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: loadColor(colors, k) }} />
                <T size={12} color={colors.text2}>{l}</T>
              </View>
            ))}
          </View>
        </View>
      )}

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Nueva reserva"
        footer={(
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warningFg }} />
              <T size={13} color={colors.text2} style={{ flex: 1 }}>Quedará pendiente hasta que un administrador la apruebe.</T>
            </View>
            <GlassButton
              size="lg"
              loading={sending}
              disabled={!canSend}
              onPress={submit}
              title={conflicts.length ? 'Elige un hueco libre para enviar' : !form.purpose.trim() ? 'Indica el motivo' : 'Enviar reserva'}
            />
          </>
        )}
      >
        <View style={{ borderRadius: 20, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <IconTile icon={type === 'room' ? Building2 : Car} tone={type === 'room' ? 'accent' : 'teal'} size={38} radius={12} />
            <View style={{ flex: 1 }}>
              <T size={15} weight="semibold">{title}</T>
              <T size={13} color={colors.text3}>{meta}</T>
            </View>
          </View>
          <View style={{ padding: 14, gap: 12 }}>
            <DateField label="Fecha" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} minimumDate={new Date()} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TimeField label="Desde" value={form.start} onChange={(v) => setForm((f) => ({ ...f, start: v }))} style={{ flex: 1 }} />
              <TimeField label="Hasta" value={form.end} onChange={(v) => setForm((f) => ({ ...f, end: v }))} style={{ flex: 1 }} />
            </View>
          </View>
        </View>

        {invalidRange ? (
          <View style={{ padding: 14, borderRadius: 18, backgroundColor: colors.dangerSoft }}>
            <T size={14} color={colors.dangerFg}>La hora de fin debe ser posterior a la de inicio.</T>
          </View>
        ) : null}

        {conflicts.length ? (
          <View accessibilityRole="alert" style={{ padding: 14, borderRadius: 20, gap: 12, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AlertTriangle size={18} color={colors.dangerFg} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, gap: 3 }}>
                <T size={15} weight="semibold">Se solapa {overlapMin >= 60 ? `${Math.floor(overlapMin / 60)} h${overlapMin % 60 ? ` ${overlapMin % 60} min` : ''}` : `${overlapMin} min`}</T>
                <T size={13} color={colors.text2}>
                  {conflicts.map((c) => `«${c.purpose || 'Reserva'}» de ${c.timeStart} a ${c.timeEnd}`).join(' · ')}
                </T>
              </View>
            </View>
            {freeSlots.length ? (
              <View style={{ gap: 8 }}>
                <T size={12} weight="semibold" color={colors.text2} upper>Huecos libres cercanos</T>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {freeSlots.map((s) => (
                    <PressScale key={s.start} onPress={() => setForm((f) => ({ ...f, start: s.start, end: s.end }))} accessibilityRole="button"
                      style={{ height: 40, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorderStrong }}>
                      <T mono weight="semibold" size={14}>{s.start}–{s.end}</T>
                    </PressScale>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <GlassInput label="Motivo" value={form.purpose} onChangeText={(v) => setForm((f) => ({ ...f, purpose: v }))} required
          placeholder="Ej.: reunión con cliente, visita a obra…" />
      </Sheet>
    </Screen>
  );
}
