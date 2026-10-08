// Business helpers shared by several screens. The rules mirror the web pages
// (RequestsPage, HorasPage, ReservationsPage) so both clients compute the same numbers.
import { PERSONAL_DAYS_PER_YEAR, REQUEST_TYPES } from '@shared/config/constants.js';
import { daysBetween, fmtDate, fmtDayShort, fmtMoney, timeToMin, minToTime } from './format';

// ── Requests ─────────────────────────────────────────────────────────
export const REQUEST_TONE = {
  asuntos_propios: 'accent',
  remoto: 'teal',
  external: 'purple',
  purchase: 'amber',
};

export function requestTypeLabel(type) {
  if (type === 'external') return 'Trabajo externo';
  if (type === 'remoto') return 'Trabajo remoto';
  if (type === 'purchase') return 'Compra';
  return REQUEST_TYPES[type] || 'Asuntos propios';
}

/** Same merge as the web RequestsPage: requests + personal_days as one list. */
export function buildRequestItems(requests = [], personalDays = [], employees = []) {
  return [
    ...requests,
    ...personalDays.map((p) => ({
      ...p,
      type: 'asuntos_propios',
      employeeName: p.employeeName || employees.find((e) => e.id === p.employeeId)?.name,
      startDate: p.date,
      endDate: p.date,
      days: 1,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function requestTitle(r) {
  if (r.type === 'purchase') return r.item ? `Compra · ${r.item}` : 'Compra';
  return requestTypeLabel(r.type);
}

export function requestDetail(r) {
  if (r.type === 'asuntos_propios') return `${fmtDayShort(r.date)} · 1 día`;
  if (r.type === 'purchase') return fmtMoney(r.amount);
  const days = r.days || daysBetween(r.startDate, r.endDate);
  if (r.startDate === r.endDate) return `${fmtDayShort(r.startDate)} · 1 día`;
  return `${fmtDate(r.startDate, { year: false })} → ${fmtDate(r.endDate, { year: false })} · ${days} días`;
}

/** Personal days used this year (pending + approved), as the dashboard counts them. */
export function personalDaysSummary(personalDays = [], userId, year = new Date().getFullYear()) {
  const used = personalDays.filter(
    (p) => String(p.employeeId) === String(userId)
      && p.status !== 'rejected'
      && String(p.date || '').startsWith(String(year)),
  ).length;
  return { used, total: PERSONAL_DAYS_PER_YEAR, left: Math.max(0, PERSONAL_DAYS_PER_YEAR - used) };
}

// ── Hours (Tiempo a compensar) ──────────────────────────────────────
/** Same formulas as the web HorasPage. */
export function hourStats(entries = []) {
  const sum = (list) => list.reduce((s, h) => s + (Number(h.hours) || 0), 0);
  const bolsa = sum(entries.filter((h) => h.type === 'bolsa' && h.status === 'approved'));
  const pending = sum(entries.filter((h) => h.type === 'bolsa' && h.status === 'pending'));
  const ya = sum(entries.filter((h) => h.type === 'ya'));
  const debe = sum(entries.filter((h) => h.type === 'debe'));
  const credit = sum(entries.filter((h) => (h.type === 'bolsa' || h.type === 'ya') && h.status === 'approved'));
  return { bolsa, pending, ya, debe, credit, balance: credit - debe };
}

export const HOUR_TONE = { ya: 'green', bolsa: 'accent', debe: 'rose' };
export const HOUR_LABEL = { ya: 'Ya', bolsa: 'Bolsa', debe: 'Debo' };

// ── Reservations ────────────────────────────────────────────────────
export const DAY_START = 8 * 60;
export const DAY_END = 20 * 60;

export function resourceKey(r) {
  return r.type === 'vehicle' ? `vehicle:${r.vehicleId}` : `room:${r.roomId}`;
}

/** Active (non-cancelled) reservations for a resource on a date. */
export function reservationsFor(reservations, { type, resourceId, date }) {
  return reservations
    .filter((r) => r.type === type
      && String(type === 'vehicle' ? r.vehicleId : r.roomId) === String(resourceId)
      && r.date === date
      && r.status !== 'cancelled')
    .sort((a, b) => timeToMin(a.timeStart) - timeToMin(b.timeStart));
}

export function findConflicts(sameDay, start, end, excludeId) {
  const s = timeToMin(start);
  const e = timeToMin(end);
  return sameDay.filter((r) => r.id !== excludeId && timeToMin(r.timeStart) < e && timeToMin(r.timeEnd) > s);
}

/** Up to `limit` free slots of the same length, closest to the requested start. */
export function nearbyFreeSlots(sameDay, start, end, limit = 2) {
  const len = Math.max(15, timeToMin(end) - timeToMin(start));
  const wanted = timeToMin(start);
  const candidates = [];
  for (let t = DAY_START; t + len <= DAY_END; t += 15) {
    if (findConflicts(sameDay, minToTime(t), minToTime(t + len)).length === 0) candidates.push(t);
  }
  return candidates
    .sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))
    .slice(0, limit)
    .sort((a, b) => a - b)
    .map((t) => ({ start: minToTime(t), end: minToTime(t + len) }));
}

/** Occupancy of a day between 08:00 and 20:00, as 'free' | 'busy' | 'full'. */
export function dayLoad(sameDay) {
  const booked = sameDay.reduce((s, r) => s + Math.max(0, Math.min(DAY_END, timeToMin(r.timeEnd)) - Math.max(DAY_START, timeToMin(r.timeStart))), 0);
  const ratio = booked / (DAY_END - DAY_START);
  if (ratio >= 0.85) return 'full';
  if (ratio >= 0.4) return 'busy';
  return 'free';
}

/** Availability label for "right now" on the resource list. */
export function availabilityNow(reservations, type, resourceId, now = new Date()) {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const mins = now.getHours() * 60 + now.getMinutes();
  const current = reservationsFor(reservations, { type, resourceId, date })
    .find((r) => timeToMin(r.timeStart) <= mins && timeToMin(r.timeEnd) > mins);
  return current ? { free: false, label: `Hasta ${current.timeEnd}` } : { free: true, label: 'Libre' };
}

export function reservationStatusLabel(status) {
  if (status === 'confirmed') return 'Aprobada';
  if (status === 'cancelled') return 'Cancelada';
  return 'Pendiente';
}
export function reservationTone(status) {
  if (status === 'confirmed') return 'approved';
  if (status === 'cancelled') return 'neutral';
  return 'pending';
}
