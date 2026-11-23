import fs from 'fs';
import path from 'path';
import {
  madridDayKey, madridTime, madridInstant, addDays, weekStart, monthEnd, dayRange,
  clockState, summarizeDay, summarizeRange, expectedMinutes, weeklyMinutes, scheduleError, resolveSchedule,
  formatMinutes, formatClock, timeReportRows, fetchTimeEntries, clockEvent, requestTimeCorrection,
  FALLBACK_SCHEDULE, TIME_ENTRIES_PAGE,
} from '../shared/services/timeTracking.js';
import * as barrel from '../shared/services/index.js';

export async function runTimeTrackingTests() {
  console.log('\n🔵 [SUITE 25: Registro de jornada (fichaje)]');
  let passed = 0;
  let failed = 0;
  const assert = (desc, condition) => {
    // stdout directly: console.error is silenced below while the services log their own errors
    if (condition) { console.log(`  ✅ ${desc}`); passed++; } else { process.stdout.write(`  ❌ FAIL: ${desc}\n`); failed++; }
  };
  const { warn, error: logError } = console;
  console.warn = () => {};
  console.error = () => {};

  // 1. Días y horas de España, con independencia de la zona del dispositivo
  assert('Las 23:30 UTC de noviembre ya son el día siguiente en España', madridDayKey('2026-11-23T23:30:00Z') === '2026-11-24');
  assert('Las 22:30 UTC de julio ya son el día siguiente en España (horario de verano)', madridDayKey('2026-07-01T22:30:00Z') === '2026-07-02');
  assert('Hora de España en invierno (UTC+1)', madridTime('2026-11-23T07:05:00Z') === '08:05');
  assert('Hora de España en verano (UTC+2)', madridTime('2026-07-01T06:05:00Z') === '08:05');
  assert('Una corrección a las 08:00 de noviembre es las 07:00 UTC', madridInstant('2026-11-23', '08:00') === '2026-11-23T07:00:00.000Z');
  assert('Una corrección a las 08:00 de julio es las 06:00 UTC', madridInstant('2026-07-01', '08:00') === '2026-07-01T06:00:00.000Z');
  assert('Días, semanas y meses', addDays('2026-02-28', 1) === '2026-03-01' && weekStart('2026-11-26') === '2026-11-23' && monthEnd('2024-02-10') === '2024-02-29' && dayRange('2026-11-23', '2026-11-25').length === 3);

  // 2. Horario
  const s = FALLBACK_SCHEDULE;
  assert('Horario de siempre: 8 h de lunes a jueves', expectedMinutes(s, '2026-11-23') === 480 && expectedMinutes(s, '2026-11-26') === 480);
  assert('Horario de siempre: 6 h 30 min el viernes', expectedMinutes(s, '2026-11-27') === 390);
  assert('Fin de semana sin horas', expectedMinutes(s, '2026-11-28') === 0 && expectedMinutes(s, '2026-11-29') === 0);
  assert('38 h 30 min a la semana', weeklyMinutes(s) === 2310);
  assert('Horario inválido: fin antes del inicio', !!scheduleError({ 1: { start: '17:00', end: '08:00', break: 0 } }));
  assert('Horario inválido: pausa igual a la jornada', !!scheduleError({ 1: { start: '08:00', end: '09:00', break: 60 } }));
  assert('Horario válido', scheduleError({ 1: { start: '08:00', end: '15:00', break: 30 } }) === null);
  const custom = { id: 'b', name: 'Tarde', isDefault: false, days: {}, toleranceMinutes: 0 };
  const def = { id: 'a', name: 'General', isDefault: true, days: {}, toleranceMinutes: 0 };
  assert('Cada persona usa su horario, o el predeterminado', resolveSchedule([def, custom], { workScheduleId: 'b' }) === custom && resolveSchedule([def, custom], {}) === def && resolveSchedule(null, {}) === FALLBACK_SCHEDULE);

  // 3. Estado y cálculo del día
  const at = (day, hhmm) => madridInstant(day, hhmm);
  const e = (kind, day, hhmm, extra = {}) => ({ id: `${kind}${hhmm}`, kind, at: at(day, hhmm), voided: false, ...extra });
  const D = '2026-11-23';
  const full = [e('in', D, '08:00'), e('break_start', D, '13:00'), e('break_end', D, '14:00'), e('out', D, '17:00')];
  const day = summarizeDay(full, { now: new Date(at('2026-11-24', '10:00')), dayKey: D });
  assert('Jornada completa: 8 h trabajadas y 1 h de descanso', day.workedMinutes === 480 && day.breakMinutes === 60 && !day.incomplete && !day.open);
  assert('Primera entrada y última salida', madridTime(day.firstIn) === '08:00' && madridTime(day.lastOut) === '17:00');
  const live = summarizeDay([e('in', D, '08:00')], { now: new Date(at(D, '10:30')), dayKey: D });
  assert('Hoy, sin salida, cuenta hasta ahora (en curso)', live.open && live.workedMinutes === 150 && !live.incomplete);
  const forgotten = summarizeDay([e('in', D, '08:00')], { now: new Date(at('2026-11-24', '09:00')), dayKey: D });
  assert('Otro día sin salida: incompleto y sin inventar horas', forgotten.incomplete && forgotten.workedMinutes === 0);
  const disordered = summarizeDay([e('out', D, '08:00'), e('in', D, '09:00'), e('out', D, '10:00')], { now: new Date(at('2026-11-24', '09:00')), dayKey: D });
  assert('Fichajes fuera de orden: se marcan, no se adivinan', disordered.incomplete && disordered.workedMinutes === 60);
  const corrected = summarizeDay([e('in', D, '08:00'), e('out', D, '09:00', { voided: true }), e('out', D, '17:00')], { now: new Date(at('2026-11-24', '09:00')), dayKey: D });
  assert('Un fichaje anulado por una corrección no cuenta', corrected.workedMinutes === 540);
  const split = summarizeDay([e('in', D, '08:00'), e('out', D, '12:00'), e('in', D, '15:00'), e('out', D, '19:00')], { now: new Date(at('2026-11-24', '09:00')), dayKey: D });
  assert('Jornada partida: dos tramos', split.workedMinutes === 480 && !split.incomplete);

  const now = new Date(at(D, '10:00'));
  assert('Sin fichajes hoy: solo se puede fichar la entrada', JSON.stringify(clockState([], now).allowed) === '["in"]' && clockState([], now).state === 'off');
  assert('Trabajando: descanso o salida', JSON.stringify(clockState([e('in', D, '08:00')], now).allowed) === '["break_start","out"]');
  assert('En descanso: volver o salir', clockState([e('in', D, '08:00'), e('break_start', D, '09:30')], now).state === 'break');
  assert('Tras la salida: jornada terminada, se puede volver a entrar', clockState([e('in', D, '08:00'), e('out', D, '09:00')], now).state === 'done');
  assert('Una jornada abierta ayer no cuenta como abierta hoy', clockState([e('in', '2026-11-22', '08:00')], now).state === 'off');

  // 4. Periodo frente al horario
  const week = [
    ...full,
    e('in', '2026-11-24', '08:00'), e('out', '2026-11-24', '16:00'),            // 8 h - 1 h pausa no fichada → 8 h
    e('in', '2026-11-25', '08:00'), e('out', '2026-11-25', '18:05'),            // 10 h 5 min
  ];
  const r = summarizeRange(week, { from: '2026-11-23', to: '2026-11-29', schedule: { ...s, toleranceMinutes: 10 }, now: new Date(at('2026-11-28', '12:00')), daysOff: ['2026-11-27'] });
  const byKey = Object.fromEntries(r.days.map((d) => [d.dayKey, d]));
  assert('Dentro de la tolerancia no hay diferencia', byKey['2026-11-23'].diffMinutes === 0);
  assert('Horas extra frente al horario', byKey['2026-11-25'].diffMinutes === 125 && r.totals.overtime === 125);
  assert('Un día laborable sin fichajes se marca «Sin fichar» y resta', byKey['2026-11-26'].missing && byKey['2026-11-26'].diffMinutes === -480);
  assert('Un asunto propio aprobado no espera horas', byKey['2026-11-27'].dayOff && byKey['2026-11-27'].expectedMinutes === 0 && !byKey['2026-11-27'].missing);
  assert('Totales del periodo', r.totals.worked === 480 + 480 + 605 && r.totals.balance === 125 - 480 && r.totals.missingDays === 1);
  const future = summarizeRange([], { from: '2026-11-23', to: '2026-11-30', now: new Date(at('2026-11-23', '12:00')) });
  assert('Los días futuros no cuentan', future.days.filter((d) => d.future).every((d) => d.expectedMinutes === 0) && future.totals.expected === 0);

  assert('Formato de horas', formatMinutes(465) === '7 h 45 min' && formatMinutes(-30) === '−30 min' && formatMinutes(60, { signed: true }) === '+1 h' && formatClock(-75) === '-1:15');
  const rows = timeReportRows(r.days.filter((d) => !d.future), 'Ana');
  assert('Informe: una fila por día con entrada, salida y estado', rows[0][0] === 'Ana' && rows[0][1] === '23/11/2026' && rows[0][2] === '08:00' && rows.some((x) => x[8] === 'Sin fichar'));

  // 5. Base de datos (cliente simulado)
  function fake({ pages = [], rpc = { data: null, error: null } } = {}, calls = []) {
    let page = 0;
    const q = {};
    for (const m of ['select', 'gte', 'lte', 'order', 'eq', 'range', 'limit']) q[m] = (...a) => { calls.push([m, ...a]); return q; };
    q.then = (res) => res(pages[page++] || { data: [], error: null });
    return { from: (t) => { calls.push(['from', t]); return q; }, rpc: async (fn, args) => { calls.push(['rpc', fn, args]); return rpc; } };
  }
  const mk = (n, base) => Array.from({ length: n }, (_, i) => ({ id: `${base}${i}`, employee_id: 'u', kind: 'in', occurred_at: '2026-11-23T08:00:00Z', source: 'web' }));
  const pageCalls = [];
  const res = await fetchTimeEntries(fake({ pages: [{ data: mk(TIME_ENTRIES_PAGE, 'a'), error: null }, { data: mk(5, 'b'), error: null }] }, pageCalls), { employeeId: 'u', from: '2026-11-01', to: '2026-11-30' });
  assert('Lee por páginas: un mes del equipo no se corta en 1000 filas', res.rows.length === TIME_ENTRIES_PAGE + 5 && pageCalls.filter((c) => c[0] === 'range').length === 2);
  const edge = await fetchTimeEntries(fake({ pages: [{ data: [
    { id: 'x', employee_id: 'u', kind: 'in', occurred_at: '2026-10-31T23:30:00Z' },
    { id: 'y', employee_id: 'u', kind: 'in', occurred_at: '2026-11-30T23:30:00Z' },
  ], error: null }] }), { from: '2026-11-01', to: '2026-11-30' });
  assert('Recorta por el día de España (medianoche)', edge.rows.length === 1 && edge.rows[0].id === 'x');
  const missing = await fetchTimeEntries(fake({ pages: [{ data: null, error: { code: 'PGRST205', message: 'missing' } }] }), { from: '2026-11-01', to: '2026-11-01' });
  assert('Antes de la migración avisa de que falta (no de un error de red)', missing.missing === true);
  const rpcCalls = [];
  await clockEvent(fake({ rpc: { data: { id: '1', kind: 'in', occurred_at: '2026-11-23T08:00:00Z' }, error: null } }, rpcCalls), 'in', { source: 'app' });
  assert('Fichar llama a clock_event (sin enviar la hora)', rpcCalls[0][1] === 'clock_event' && rpcCalls[0][2].p_kind === 'in' && rpcCalls[0][2].p_source === 'app' && !('p_at' in rpcCalls[0][2]));
  const corrCalls = [];
  await requestTimeCorrection(fake({ rpc: { data: 'c1', error: null } }, corrCalls), { kind: 'void', at: '2026-11-23T08:00:00Z', reason: 'Entrada repetida', targetEntryId: 'e1' });
  assert('Quitar un fichaje no envía hora', corrCalls[0][1] === 'request_time_correction' && corrCalls[0][2].p_at === null && corrCalls[0][2].p_target_entry === 'e1');
  assert('El barril de servicios exporta el fichaje sin nombres ambiguos', typeof barrel.clockEvent === 'function' && typeof barrel.isoWeekday === 'function' && typeof barrel.summarizeRange === 'function');

  console.warn = warn;
  console.error = logError;

  // 6. Migración
  const root = process.cwd();
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
  const sql = read('supabase', 'migrations', '20261124120000_time_tracking.sql');
  assert('Fichajes y correcciones: solo lectura desde la API', sql.includes('revoke all on public.time_entries, public.time_corrections from anon, authenticated;') && sql.includes('grant select on public.time_entries, public.time_corrections to authenticated;'));
  assert('Cada persona ve lo suyo y RR. HH. todo', (sql.match(/using \(employee_id = auth\.uid\(\) or public\.is_admin\(\)\)/g) || []).length === 2);
  assert('La hora la pone el servidor', /insert into public\.time_entries \(employee_id, kind, source, note\)/.test(sql) && sql.includes('occurred_at          timestamptz not null default now()'));
  assert('El orden de los fichajes se comprueba en el servidor', sql.includes("(v_state = 'off' and p_kind = 'in')") && sql.includes("(v_state = 'working' and p_kind in ('break_start', 'out'))"));
  assert('Dos pulsaciones a la vez no crean dos fichajes', sql.includes("pg_advisory_xact_lock(hashtextextended('clock:' || v_uid::text, 0))"));
  assert('Una corrección anula, nunca borra', sql.includes('set voided_at = now(), voided_by_correction = c.id') && !/delete\s+from\s+public\.time_entries/i.test(sql));
  assert('Solo RR. HH. corrige a otra persona o revisa', sql.includes("Solo RR. HH. puede corregir los fichajes de otra persona") && sql.includes('Solo RR. HH. puede revisar correcciones de fichajes'));
  assert('Una sola corrección pendiente por fichaje', sql.includes('time_corrections_one_pending'));
  assert('Sin correcciones futuras ni de hace más de dos meses (empleados)', sql.includes("p_at > now() + interval '1 minute'") && sql.includes("p_at < now() - interval '62 days'"));
  assert('Una ficha con fichajes no se puede eliminar (cuatro años)', sql.includes('profiles_keep_time_records') && sql.includes('obliga a conservar cuatro años'));
  assert('Los horarios se validan en el servidor', sql.includes('check (public.valid_work_schedule_days(days))'));
  assert('Avisos de correcciones (RR. HH. y la persona)', sql.includes("'time_correction', v_id::text") && sql.includes("when 'time_correction' then '/fichaje'"));
  assert('Horarios y correcciones en el historial de RR. HH.', sql.includes('work_schedules_hr_audit') && sql.includes('time_corrections_hr_audit'));
  assert('Migración transaccional y sin borrar tablas', sql.includes('begin;') && sql.includes('commit;') && !/\bdrop\s+table\b|\btruncate\b/i.test(sql));

  // 7. Interfaz
  assert('Web: ruta, menú, atajo y paleta', read('src', 'App.tsx').includes('path="/fichaje"') && read('src', 'pageLoaders.js').includes("fichaje:") && read('src', 'components', 'Layout.jsx').includes("{ id: 'fichaje'") && read('src', 'components', 'Layout.jsx').includes("f: 'fichaje'") && read('src', 'components', 'CommandPalette.jsx').includes("id: 'fichaje'"));
  assert('Web móvil: fichaje a un toque desde Inicio y en «Más»', read('src', 'pages', 'DashboardTouch.jsx').includes("navigate('/fichaje')") && read('src', 'pages', 'MorePage.jsx').includes("navigate('/fichaje')"));
  const page = read('src', 'pages', 'FichajePage.jsx');
  assert('Web: equipo y horarios solo para RR. HH.', page.includes("view === 'team' && isAdmin") && page.includes("view === 'schedules' && isAdmin"));
  const card = read('src', 'pages', 'fichaje', 'ClockCard.jsx');
  assert('Web: la confirmación muestra la hora del servidor', card.includes('madridTime(done.at)'));
  assert('Web: carga, error y vacío en el registro mensual', ['Cargando registro', 'No se ha podido cargar el registro', 'Sin fichajes este mes'].every((t) => read('src', 'pages', 'fichaje', 'MonthHistory.jsx').includes(t)));
  assert('Avisos: una corrección lleva a Fichaje (web y app)', read('shared', 'config', 'constants.js').includes("time_correction: 'fichaje'") && read('mobile', 'src', 'navigation', 'notificationTarget.js').includes("navigation.navigate('Fichaje')"));
  assert('App: pantalla registrada y acceso desde Inicio', read('mobile', 'src', 'navigation', 'RootNavigator.jsx').includes('name="Fichaje"') && read('mobile', 'src', 'screens', 'DashboardScreen.jsx').includes("navigation.navigate('Fichaje')"));
  assert('App: ficha con origen «app»', read('mobile', 'src', 'screens', 'FichajeScreen.jsx').includes("source: 'app'"));

  return { passed, failed };
}
