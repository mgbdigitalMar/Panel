/**
 * Work mode service — platform-agnostic.
 *
 * `profiles.work_mode` follows the approved remote / external requests:
 *   • the admin approves a request that covers today → the mode changes at once;
 *   • a request starting later → the employee's own session applies it that day;
 *   • the request ends → back to the office;
 *   • the employee goes back to the office early → `requests.returned_at` is set,
 *     so the request is not applied again, and the admins are notified.
 *
 * Weekly telework schedule (`profiles.telework_days`, set by an admin): at the
 * start of each day the employee goes to remote on those weekdays and to the
 * office on the rest. It is applied once a day (`profiles.telework_applied_on`)
 * by a database job and, as a fallback, by the employee's own session, so a
 * manual change later that day sticks. An approved request covering the day
 * takes priority. See supabase/migrations/20261021130000_telework_schedule.sql.
 *
 * `returned_at` comes from supabase/migrations/20261020120000_work_mode_return.sql.
 * Until it exists, rows carry `returnedAt: undefined` and only the approval
 * applies the mode (an automatic re-apply would undo the early return).
 */
import { notifyAdmins } from './notifications.js';

export const OFFICE_MODE = 'Office';

/** Request type → work mode it grants */
export const REQUEST_WORK_MODE = { remoto: 'remoto', external: 'externo' };

export const WORK_MODE_LABELS = { Office: 'Oficina', remoto: 'Remoto', externo: 'Externo' };

const isRemoteMode = (mode) => mode === 'remoto' || mode === 'externo';

/** Local calendar date (YYYY-MM-DD). toISOString() would give yesterday's date after midnight in Spain. */
export function localISODate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Weekdays an admin can mark as telework days (ISO: 1 = lunes … 5 = viernes) */
export const TELEWORK_WEEKDAYS = [
  { day: 1, short: 'L', label: 'lunes' },
  { day: 2, short: 'M', label: 'martes' },
  { day: 3, short: 'X', label: 'miércoles' },
  { day: 4, short: 'J', label: 'jueves' },
  { day: 5, short: 'V', label: 'viernes' },
];

/** ISO weekday (1 = lunes … 7 = domingo) of a YYYY-MM-DD date */
export function isoWeekday(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() || 7;
}

/** Whether `today` is one of the employee's scheduled telework days */
export function isTeleworkDay(employee, today = localISODate()) {
  return (employee?.teleworkDays || []).includes(isoWeekday(today));
}

/** "lunes y miércoles" — readable list of telework days */
export function formatTeleworkDays(days) {
  const labels = TELEWORK_WEEKDAYS.filter((w) => (days || []).includes(w.day)).map((w) => w.label);
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}` : (labels[0] || '');
}

/** Approved remote / external requests of `employeeId` that cover `today`. */
export function activeWorkModeRequests(requests, employeeId, today = localISODate()) {
  return (requests || []).filter((r) => r.employeeId === employeeId
    && REQUEST_WORK_MODE[r.type]
    && r.status === 'approved'
    && r.startDate && r.endDate
    && today >= r.startDate && today <= r.endDate);
}

/**
 * Modes the employee may pick from their profile: the office, plus whatever an
 * approved request or their telework schedule (pass `employee`) allows today.
 */
export function allowedWorkModes(requests, employeeId, today = localISODate(), employee = null) {
  const modes = new Set([OFFICE_MODE]);
  activeWorkModeRequests(requests, employeeId, today).forEach((r) => modes.add(REQUEST_WORK_MODE[r.type]));
  if (isTeleworkDay(employee, today)) modes.add(REQUEST_WORK_MODE.remoto);
  return modes;
}

/**
 * Today's telework schedule as a `profiles` update, or null when there is
 * nothing to do (no schedule, or already applied today). With an approved
 * request covering today the request decides the mode; the day is only marked.
 * Mirrors public.apply_telework_schedules() in the database.
 */
export function teleworkScheduleUpdate(requests, employee, today = localISODate()) {
  if (!employee?.id || !employee.teleworkDays?.length || employee.teleworkAppliedOn === today) return null;
  const update = { telework_applied_on: today };
  if (activeWorkModeRequests(requests, employee.id, today).some((r) => !r.returnedAt)) return update;
  const target = isTeleworkDay(employee, today) ? REQUEST_WORK_MODE.remoto : OFFICE_MODE;
  if ((employee.workMode || OFFICE_MODE) !== target) update.work_mode = target;
  return update;
}

/**
 * The `profiles` update the employee's own session should write now
 * (telework schedule first, then requests), or null.
 */
export function workModeSyncUpdate(requests, user, today = localISODate()) {
  const schedule = teleworkScheduleUpdate(requests, user, today);
  if (schedule) return schedule;
  const target = workModeFromRequests(requests, user, today);
  return target ? { work_mode: target } : null;
}

/**
 * The mode `user` should be in according to their requests, or null to leave it as it is.
 * Called by the employee's own session whenever requests or the profile change.
 */
export function workModeFromRequests(requests, user, today = localISODate()) {
  if (!user?.id) return null;
  const current = user.workMode || OFFICE_MODE;
  const active = activeWorkModeRequests(requests, user.id, today);

  // Starting day of an approved request the employee hasn't come back from
  const pending = active.find((r) => r.returnedAt === null);
  if (pending) {
    const target = REQUEST_WORK_MODE[pending.type];
    return current === target ? null : target;
  }

  // Still covered by a request of the current mode → keep it
  if (!isRemoteMode(current) || active.some((r) => REQUEST_WORK_MODE[r.type] === current)) return null;

  // A scheduled telework day → keep it (the schedule itself goes back to the office)
  if (current === REQUEST_WORK_MODE.remoto && isTeleworkDay(user, today)) return null;

  // The request that granted this mode is over. A mode an admin set by hand,
  // without any request behind it, is left alone.
  const granted = (requests || []).some((r) => r.employeeId === user.id
    && r.status === 'approved'
    && REQUEST_WORK_MODE[r.type] === current
    && r.endDate && r.endDate < today);
  return granted ? OFFICE_MODE : null;
}

/**
 * Changes the work mode of `employee` (themselves or, for an admin, anyone).
 * Going back to the office during a request ends it early and, when the
 * employee does it themselves, notifies the admins.
 * @returns {Promise<{ error: object|null }>}
 */
export async function changeWorkMode(supabase, employees, { employee, mode, requests, actorId }) {
  const previous = employee.workMode || OFFICE_MODE;
  const { error } = await supabase.from('profiles').update({ work_mode: mode }).eq('id', employee.id);
  if (error) {
    console.error('changeWorkMode:', error);
    return { error };
  }

  const active = activeWorkModeRequests(requests, employee.id);
  if (mode === OFFICE_MODE) {
    const ids = active.filter((r) => !r.returnedAt).map((r) => r.id);
    if (ids.length) {
      const { error: endErr } = await supabase.from('requests')
        .update({ returned_at: new Date().toISOString() })
        .in('id', ids);
      if (endErr) console.warn('changeWorkMode (returned_at):', endErr.message);
    }
  } else {
    // Picking the remote mode again resumes the request
    const ids = active.filter((r) => REQUEST_WORK_MODE[r.type] === mode && r.returnedAt).map((r) => r.id);
    if (ids.length) {
      const { error: resumeErr } = await supabase.from('requests').update({ returned_at: null }).in('id', ids);
      if (resumeErr) console.warn('changeWorkMode (returned_at):', resumeErr.message);
    }
  }

  if (mode === OFFICE_MODE && isRemoteMode(previous) && actorId === employee.id) {
    const req = active.find((r) => REQUEST_WORK_MODE[r.type] === previous);
    const [y, m, d] = (req?.endDate || '').split('-');
    const until = req ? ` Su periodo de trabajo ${previous === 'remoto' ? 'remoto' : 'externo'} terminaba el ${d}/${m}/${y}.` : '';
    await notifyAdmins(supabase, employees.filter((e) => e.id !== employee.id), {
      title: '🏢 Vuelta a la oficina',
      body: `${employee.name || 'Un empleado'} ha vuelto a la oficina (antes: ${WORK_MODE_LABELS[previous]}).${until}`,
      type: 'info',
      entityType: req ? 'request' : null,
      entityId: req?.id ?? null,
    });
  }

  return { error: null };
}
