/**
 * Where each person works on each day of a week (Equipo → Semana on the web, Equipo on the app).
 *
 * Today comes from `profiles.work_mode`, which is live. Other days are a forecast: an approved
 * personal day, then an approved remote / external request, then the weekly telework schedule,
 * otherwise the office. Employees only receive their own requests and personal days (RLS), so
 * for colleagues the forecast is the telework schedule; admins see everything.
 */
import { REQUEST_WORK_MODE, OFFICE_MODE, isoWeekday, isTeleworkDay, localISODate } from './workMode.js';

export const AVAILABILITY = {
  office:          { label: 'Oficina',         short: 'Ofi' },
  remoto:          { label: 'Remoto',          short: 'Rem' },
  externo:         { label: 'Externo',         short: 'Ext' },
  asuntos_propios: { label: 'Asuntos propios', short: 'AP' },
};

const MODE_STATUS = { [OFFICE_MODE]: 'office', remoto: 'remoto', externo: 'externo' };

function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return localISODate(new Date(y, m - 1, d + n));
}

/** Monday to Friday of the week `offset` weeks away from the one containing `today`. */
export function weekDates(offset = 0, today = localISODate()) {
  const monday = addDays(today, 1 - isoWeekday(today) + offset * 7);
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

/**
 * @returns {{ status: keyof AVAILABILITY, source: 'live'|'personal_day'|'request'|'schedule' }}
 */
export function dayAvailability(employee, date, { requests = [], personalDays = [], today = localISODate() } = {}) {
  const dayOff = personalDays.some((p) => p.employeeId === employee.id && p.status === 'approved' && p.date === date);
  if (dayOff) return { status: 'asuntos_propios', source: 'personal_day' };

  if (date === today) {
    return { status: MODE_STATUS[employee.workMode] || 'office', source: 'live' };
  }

  // A request the person came back early from (returned_at) no longer applies
  const req = requests.find((r) => r.employeeId === employee.id
    && r.status === 'approved'
    && REQUEST_WORK_MODE[r.type]
    && !r.returnedAt
    && r.startDate && r.endDate
    && date >= r.startDate && date <= r.endDate);
  if (req) return { status: REQUEST_WORK_MODE[req.type], source: 'request' };

  return { status: isTeleworkDay(employee, date) ? 'remoto' : 'office', source: 'schedule' };
}

/** One row per employee with its availability for each of `dates`. */
export function teamWeek(employees, dates, data = {}) {
  return (employees || []).map((employee) => ({
    employee,
    days: dates.map((date) => ({ date, ...dayAvailability(employee, date, data) })),
  }));
}

/** How many people are in each status on `date`. */
export function dayCounts(rows, date) {
  const counts = { office: 0, remoto: 0, externo: 0, asuntos_propios: 0 };
  rows.forEach((row) => {
    const day = row.days.find((d) => d.date === date);
    if (day) counts[day.status]++;
  });
  return counts;
}
