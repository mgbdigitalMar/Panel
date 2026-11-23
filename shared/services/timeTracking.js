// Registro de jornada (fichaje): supabase/migrations/20261124120000_time_tracking.sql.
// Shared by the web and the app: no DOM or React Native imports.
//
// The database stores each clock event with the server's time; everything here only reads them
// and works out the day: time worked, breaks, whether it was left open, and the difference with
// the person's schedule. Days are Spain's calendar days (Europe/Madrid), whatever the device's zone.

export const CLOCK_KINDS = {
  in: { label: 'Entrada', action: 'Fichar entrada', past: 'Entrada fichada' },
  break_start: { label: 'Inicio de descanso', action: 'Iniciar descanso', past: 'Descanso iniciado' },
  break_end: { label: 'Fin de descanso', action: 'Volver del descanso', past: 'Descanso terminado' },
  out: { label: 'Salida', action: 'Fichar salida', past: 'Salida fichada' },
};

export const CORRECTION_KINDS = {
  in: 'Añadir entrada',
  break_start: 'Añadir inicio de descanso',
  break_end: 'Añadir fin de descanso',
  out: 'Añadir salida',
  void: 'Este fichaje sobra',
};

export const CORRECTION_STATUS = {
  pending: { tone: 'warning', text: 'Pendiente' },
  approved: { tone: 'success', text: 'Aprobada' },
  rejected: { tone: 'danger', text: 'Rechazada' },
  cancelled: { tone: 'neutral', text: 'Cancelada' },
};

export const CLOCK_STATES = {
  off: { label: 'Sin fichar', tone: 'neutral' },
  working: { label: 'Trabajando', tone: 'success' },
  break: { label: 'En descanso', tone: 'warning' },
  done: { label: 'Jornada terminada', tone: 'accent' },
};

export const WEEKDAYS = [
  { day: 1, short: 'L', label: 'Lunes' },
  { day: 2, short: 'M', label: 'Martes' },
  { day: 3, short: 'X', label: 'Miércoles' },
  { day: 4, short: 'J', label: 'Jueves' },
  { day: 5, short: 'V', label: 'Viernes' },
  { day: 6, short: 'S', label: 'Sábado' },
  { day: 7, short: 'D', label: 'Domingo' },
];

// The schedule the intranet always assumed (src/utils/workday.js), used until RR. HH. sets one
export const FALLBACK_SCHEDULE = {
  id: null,
  name: 'Jornada general',
  toleranceMinutes: 10,
  isDefault: true,
  days: {
    1: { start: '08:00', end: '17:00', break: 60 },
    2: { start: '08:00', end: '17:00', break: 60 },
    3: { start: '08:00', end: '17:00', break: 60 },
    4: { start: '08:00', end: '17:00', break: 60 },
    5: { start: '08:00', end: '14:30', break: 0 },
  },
};

const TZ = 'Europe/Madrid';
const MISSING_TABLE = new Set(['42P01', 'PGRST205', 'PGRST202']);
const MINUTE = 60 * 1000;

// ── Dates (Spain's calendar) ─────────────────────────────────────────────────────────────────

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

/** YYYY-MM-DD of an instant in Spain. */
export function madridDayKey(at = new Date()) {
  return dayFormat.format(at instanceof Date ? at : new Date(at));
}

/** HH:MM of an instant in Spain. */
export function madridTime(at) {
  return timeFormat.format(at instanceof Date ? at : new Date(at));
}

/** ISO weekday (1 Monday … 7 Sunday) of a YYYY-MM-DD key. */
export function weekdayOf(dayKey) {
  const d = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** The YYYY-MM-DD key `n` days after `dayKey` (negative goes back). */
export function addDays(dayKey, n) {
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Every day key from `from` to `to`, both included. */
export function dayRange(from, to) {
  const out = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Monday of the week of `dayKey`. */
export const weekStart = (dayKey) => addDays(dayKey, 1 - weekdayOf(dayKey));
export const monthStart = (dayKey) => `${dayKey.slice(0, 7)}-01`;
export function monthEnd(dayKey) {
  const [y, m] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * The instant a Spain wall-clock time (YYYY-MM-DD + HH:MM) refers to, as an ISO string: what a
 * correction sends, whatever the zone of the device it is typed on.
 */
export function madridInstant(dayKey, hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const guess = Date.UTC(...dayKey.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0)), h, m);
  // Offset of Spain at that moment (+1 or +2): read the wall clock of the UTC guess there
  const wall = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(guess)).reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
  const asUtc = Date.UTC(Number(wall.year), Number(wall.month) - 1, Number(wall.day), Number(wall.hour) % 24, Number(wall.minute));
  return new Date(guess - (asUtc - guess)).toISOString();
}

// ── Formatting ─────────────────────────────────────────────────────────────────────────────

/** 465 → «7 h 45 min»; 0 → «0 min»; negatives keep the sign. */
export function formatMinutes(total, { signed = false } = {}) {
  const value = Math.round(Number(total) || 0);
  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  const abs = Math.abs(value);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (!h) return `${sign}${m} min`;
  return `${sign}${h} h${m ? ` ${m} min` : ''}`;
}

/** 465 → «7:45» (tables and CSV). */
export function formatClock(total) {
  const value = Math.round(Number(total) || 0);
  const abs = Math.abs(value);
  return `${value < 0 ? '-' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

// ── Schedules ──────────────────────────────────────────────────────────────────────────────

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

export function mapSchedule(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    days: row.days || {},
    toleranceMinutes: row.tolerance_minutes ?? 10,
    isDefault: row.is_default === true,
  };
}

/** The person's schedule: theirs, else the default one, else the intranet's usual hours. */
export function resolveSchedule(schedules, profile) {
  const list = Array.isArray(schedules) ? schedules : [];
  const own = profile?.workScheduleId && list.find((s) => s.id === profile.workScheduleId);
  return own || list.find((s) => s.isDefault) || list[0] || FALLBACK_SCHEDULE;
}

/** Minutes to work on a day by the schedule (0 on a day off). */
export function expectedMinutes(schedule, dayKey) {
  const slot = schedule?.days?.[weekdayOf(dayKey)] || schedule?.days?.[String(weekdayOf(dayKey))];
  if (!slot) return 0;
  const start = toMinutes(slot.start);
  const end = toMinutes(slot.end);
  if (start == null || end == null || end <= start) return 0;
  return Math.max(0, end - start - (Number(slot.break) || 0));
}

/** Weekly hours of a schedule, in minutes. */
export const weeklyMinutes = (schedule) => WEEKDAYS.reduce((s, w) => s + expectedMinutes(schedule, addDays('2026-01-05', w.day - 1)), 0);

/** Same rules as public.valid_work_schedule_days(). Returns null when valid, or the reason. */
export function scheduleError(days) {
  for (const [key, slot] of Object.entries(days || {})) {
    const label = WEEKDAYS.find((w) => String(w.day) === String(key))?.label || key;
    const start = toMinutes(slot?.start);
    const end = toMinutes(slot?.end);
    const brk = Number(slot?.break) || 0;
    if (start == null || end == null) return `${label}: indica la hora de inicio y de fin.`;
    if (end <= start) return `${label}: la hora de fin debe ser posterior a la de inicio.`;
    if (brk < 0 || brk >= end - start) return `${label}: la pausa debe ser menor que la jornada.`;
  }
  return null;
}

// ── A day of clock events ───────────────────────────────────────────────────────────────────

export function mapEntry(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    kind: row.kind,
    at: row.occurred_at,
    source: row.source,
    note: row.note || '',
    correctionId: row.correction_id || null,
    voided: !!row.voided_at,
    voidedAt: row.voided_at || null,
  };
}

const byTime = (a, b) => new Date(a.at) - new Date(b.at);

/**
 * Where a person stands now, from their valid events (any order, any days).
 * state: off (nothing open today), working, break, done (clocked out today).
 * A session left open on an earlier day does not count as open today (clock_event() does the same).
 */
export function clockState(entries, now = new Date()) {
  const today = madridDayKey(now);
  const valid = (entries || []).filter((e) => !e.voided).sort(byTime);
  const last = valid[valid.length - 1];
  const todays = valid.filter((e) => madridDayKey(e.at) === today);
  const firstIn = todays.find((e) => e.kind === 'in') || null;
  if (!last || madridDayKey(last.at) !== today) return { state: 'off', last: null, since: null, firstIn, allowed: ['in'] };
  if (last.kind === 'out') return { state: 'done', last, since: last.at, firstIn, allowed: ['in'] };
  if (last.kind === 'break_start') return { state: 'break', last, since: last.at, firstIn, allowed: ['break_end', 'out'] };
  return { state: 'working', last, since: last.at, firstIn, allowed: ['break_start', 'out'] };
}

/**
 * One day's figures from its valid events: minutes worked and on break, first entry and last exit,
 * `open` (still running: today, counted up to `now`) and `incomplete` (left open on a past day, or
 * events out of order). Events in the wrong order are skipped and flagged, never guessed.
 */
export function summarizeDay(entries, { now = new Date(), dayKey } = {}) {
  const events = (entries || []).filter((e) => !e.voided).sort(byTime);
  const key = dayKey || (events[0] ? madridDayKey(events[0].at) : madridDayKey(now));
  const isToday = key === madridDayKey(now);
  let state = 'off';
  let worked = 0;
  let breaks = 0;
  let mark = null;
  let anomalies = 0;
  for (const e of events) {
    const t = new Date(e.at).getTime();
    if (e.kind === 'in' && state === 'off') { state = 'working'; mark = t; }
    else if (e.kind === 'break_start' && state === 'working') { worked += t - mark; state = 'break'; mark = t; }
    else if (e.kind === 'break_end' && state === 'break') { breaks += t - mark; state = 'working'; mark = t; }
    else if (e.kind === 'out' && state === 'working') { worked += t - mark; state = 'off'; mark = null; }
    else if (e.kind === 'out' && state === 'break') { breaks += t - mark; state = 'off'; mark = null; }
    else anomalies += 1;
  }
  let open = false;
  let incomplete = anomalies > 0;
  if (state !== 'off') {
    if (isToday) {
      open = true;
      const elapsed = Math.max(0, now.getTime() - mark);
      if (state === 'working') worked += elapsed; else breaks += elapsed;
    } else {
      incomplete = true;
    }
  }
  const ins = events.filter((e) => e.kind === 'in');
  const outs = events.filter((e) => e.kind === 'out');
  return {
    dayKey: key,
    workedMinutes: Math.floor(worked / MINUTE),
    breakMinutes: Math.floor(breaks / MINUTE),
    firstIn: ins[0]?.at || null,
    lastOut: outs.length ? outs[outs.length - 1].at : null,
    open,
    incomplete,
    state: open ? state : events.length ? 'done' : 'off',
    events,
  };
}

/** Valid events grouped by Spain's day: { 'YYYY-MM-DD': [events] }. */
export function groupByDay(entries) {
  const out = {};
  for (const e of entries || []) {
    if (e.voided) continue;
    const key = madridDayKey(e.at);
    (out[key] ||= []).push(e);
  }
  return out;
}

/**
 * Days from `from` to `to` (both included) against the schedule, and their totals.
 * `daysOff`: day keys with nothing to work (approved personal days, holidays), and future days
 * expect nothing yet. A difference within the schedule's tolerance counts as on time.
 * Returns { days: [...], totals: { worked, expected, balance, overtime, missing, incompleteDays, workedDays } }.
 */
export function summarizeRange(entries, { from, to, schedule = FALLBACK_SCHEDULE, now = new Date(), daysOff = [] } = {}) {
  const groups = groupByDay(entries);
  const off = new Set(daysOff);
  const today = madridDayKey(now);
  const tolerance = Number(schedule?.toleranceMinutes) || 0;
  const days = dayRange(from, to).map((key) => {
    const summary = summarizeDay(groups[key] || [], { now, dayKey: key });
    const future = key > today;
    const expected = future || off.has(key) ? 0 : expectedMinutes(schedule, key);
    // Today only counts against the schedule once the person has clocked out: before that (not
    // clocked in yet, or still working) the day is in progress, not short
    const counts = !future && (key !== today || (summary.events.length > 0 && !summary.open));
    const raw = counts ? summary.workedMinutes - expected : 0;
    const diff = Math.abs(raw) <= tolerance ? 0 : raw;
    return {
      ...summary,
      expectedMinutes: expected,
      diffMinutes: diff,
      counts,
      dayOff: off.has(key),
      future,
      // A working day in the past with no clock event at all
      missing: counts && key !== today && expected > 0 && summary.events.length === 0 && !off.has(key),
    };
  });
  const totals = days.reduce((t, d) => {
    t.worked += d.workedMinutes;
    if (d.counts) t.expected += d.expectedMinutes;
    t.balance += d.diffMinutes;
    if (d.diffMinutes > 0) t.overtime += d.diffMinutes;
    if (d.incomplete) t.incompleteDays += 1;
    if (d.missing) t.missingDays += 1;
    if (d.workedMinutes > 0) t.workedDays += 1;
    return t;
  }, { worked: 0, expected: 0, balance: 0, overtime: 0, incompleteDays: 0, missingDays: 0, workedDays: 0 });
  return { days, totals };
}

/** Rows of a time report (CSV): one per person and day with clock events or work expected. */
export function timeReportRows(days, personName) {
  return days
    .filter((d) => d.events.length || d.expectedMinutes)
    .map((d) => [
      personName,
      d.dayKey.split('-').reverse().join('/'),
      d.firstIn ? madridTime(d.firstIn) : '',
      d.lastOut ? madridTime(d.lastOut) : '',
      formatClock(d.breakMinutes),
      formatClock(d.workedMinutes),
      formatClock(d.expectedMinutes),
      formatClock(d.diffMinutes),
      d.incomplete ? 'Incompleto' : d.open ? 'En curso' : d.missing ? 'Sin fichar' : d.dayOff ? 'Día libre' : '',
    ]);
}

export const TIME_REPORT_HEADERS = ['Persona', 'Fecha', 'Entrada', 'Salida', 'Descansos', 'Trabajado', 'Previsto', 'Diferencia', 'Estado'];

// ── Database ──────────────────────────────────────────────────────────────────────────────

/**
 * Clock events between two day keys (Spain), oldest first. Without `employeeId` an admin gets
 * everyone's (RLS gives an employee only their own). Includes voided events (`voided: true`):
 * the screens show them struck out, the figures ignore them.
 * Resolves to { rows } or { error } (`missing: true` before the migration).
 */
export const TIME_ENTRIES_PAGE = 1000; // Supabase's default maximum rows per request

export async function fetchTimeEntries(supabase, { employeeId, from, to } = {}) {
  const rows = [];
  // Page by page: a month of the whole team can exceed one response
  for (let page = 0; page < 50; page += 1) {
    // A day before and after in UTC covers Spain's day boundaries; the grouping trims the rest
    let query = supabase
      .from('time_entries')
      .select('id, employee_id, kind, occurred_at, source, note, correction_id, voided_at')
      .gte('occurred_at', `${addDays(from, -1)}T00:00:00Z`)
      .lte('occurred_at', `${addDays(to, 1)}T23:59:59Z`)
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
      .range(page * TIME_ENTRIES_PAGE, (page + 1) * TIME_ENTRIES_PAGE - 1);
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;
    if (error) {
      console.error('fetchTimeEntries:', error);
      return { error, missing: MISSING_TABLE.has(error.code) };
    }
    rows.push(...data);
    if (data.length < TIME_ENTRIES_PAGE) break;
  }
  return { rows: rows.map(mapEntry).filter((e) => { const k = madridDayKey(e.at); return k >= from && k <= to; }) };
}

/** Clocks the signed-in person in or out (the server sets the time). Resolves to { entry } or { error }. */
export async function clockEvent(supabase, kind, { source = 'web', note } = {}) {
  const { data, error } = await supabase.rpc('clock_event', { p_kind: kind, p_source: source, p_note: note || null });
  if (error) {
    console.error('clockEvent:', error);
    return { error };
  }
  return { entry: mapEntry(Array.isArray(data) ? data[0] : data) };
}

export function mapCorrection(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    targetEntryId: row.target_entry_id || null,
    kind: row.kind,
    at: row.proposed_at || null,
    reason: row.reason,
    status: row.status,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    reviewNote: row.review_note || '',
    createdAt: row.created_at,
  };
}

/** Corrections, newest first: the person's own, or everyone's for an admin (`status` filters). */
export async function fetchTimeCorrections(supabase, { employeeId, status, limit = 200 } = {}) {
  let query = supabase
    .from('time_corrections')
    .select('id, employee_id, target_entry_id, kind, proposed_at, reason, status, requested_by, reviewed_by, reviewed_at, review_note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    console.error('fetchTimeCorrections:', error);
    return { error, missing: MISSING_TABLE.has(error.code) };
  }
  return { rows: data.map(mapCorrection) };
}

/**
 * Asks for a correction (an admin's is applied at once). `at` is an ISO instant (madridInstant),
 * not needed for 'void'. Resolves to { id } or { error }.
 */
export async function requestTimeCorrection(supabase, { kind, at, reason, targetEntryId, employeeId }) {
  const { data, error } = await supabase.rpc('request_time_correction', {
    p_kind: kind,
    p_at: kind === 'void' ? null : at,
    p_reason: reason,
    p_target_entry: targetEntryId || null,
    p_employee_id: employeeId || null,
  });
  if (error) {
    console.error('requestTimeCorrection:', error);
    return { error };
  }
  return { id: data };
}

export async function reviewTimeCorrection(supabase, id, approve, note) {
  const { error } = await supabase.rpc('review_time_correction', { p_id: id, p_approve: approve, p_note: note || null });
  if (error) console.error('reviewTimeCorrection:', error);
  return { error: error || null };
}

export async function cancelTimeCorrection(supabase, id) {
  const { error } = await supabase.rpc('cancel_time_correction', { p_id: id });
  if (error) console.error('cancelTimeCorrection:', error);
  return { error: error || null };
}

/** Schedules by name, or [FALLBACK_SCHEDULE] before the migration. null when the request fails. */
export async function fetchWorkSchedules(supabase) {
  const { data, error } = await supabase.from('work_schedules').select('id, name, days, tolerance_minutes, is_default').order('name');
  if (error) {
    if (MISSING_TABLE.has(error.code)) return [FALLBACK_SCHEDULE];
    console.error('fetchWorkSchedules:', error);
    return null;
  }
  return data.map(mapSchedule);
}

/** Creates or updates a schedule (admins). Making one the default unsets the previous one first. */
export async function saveWorkSchedule(supabase, { id, name, days, toleranceMinutes, isDefault }) {
  const payload = { name: String(name || '').trim(), days, tolerance_minutes: Number(toleranceMinutes) || 0 };
  if (isDefault) {
    const { error } = await supabase.from('work_schedules').update({ is_default: false }).eq('is_default', true).neq('id', id || '00000000-0000-0000-0000-000000000000');
    if (error) { console.error('saveWorkSchedule:', error); return { error }; }
    payload.is_default = true;
  }
  const { data, error } = id
    ? await supabase.from('work_schedules').update(payload).eq('id', id).select().single()
    : await supabase.from('work_schedules').insert([payload]).select().single();
  if (error) {
    console.error('saveWorkSchedule:', error);
    return { error };
  }
  return { data: mapSchedule(data) };
}

/** Assigns a schedule to a person (null = the default one). Admins only (guard_profile_update). */
export async function assignWorkSchedule(supabase, employeeId, scheduleId) {
  const { error } = await supabase.from('profiles').update({ work_schedule_id: scheduleId || null }).eq('id', employeeId);
  if (error) console.error('assignWorkSchedule:', error);
  return { error: error || null };
}
