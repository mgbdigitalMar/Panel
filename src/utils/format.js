/**
 * Display formatting shared by every page (es-ES).
 * Accepts Date objects, ISO timestamps from Supabase ("2026-10-14T09:00:00+00:00")
 * and plain date columns ("2026-10-14"). Plain dates are read as local days so
 * they never shift by a day across time zones.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

const sameYear = (d) => d.getFullYear() === new Date().getFullYear();

/** "14 oct" this year, "14 oct 2025" otherwise. */
export function fmtDate(value, { year } = {}) {
  const d = toDate(value);
  if (!d) return '—';
  const showYear = year ?? !sameYear(d);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(showYear && { year: 'numeric' }) })
    .replace('.', '');
}

/** "mar, 14 oct" — weekday helps when scanning upcoming bookings. */
export function fmtDayShort(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', ...(!sameYear(d) && { year: 'numeric' }) })
    .replace(/\./g, '');
}

/** "14 oct, 09:00" */
export function fmtDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${fmtDate(d)}, ${time}`;
}

/** "14 oct" for one day, "14 – 16 oct" or "30 oct – 2 nov" for a span. */
export function fmtRange(start, end) {
  const a = toDate(start);
  const b = toDate(end);
  if (!a) return '—';
  if (!b || a.getTime() === b.getTime()) return fmtDate(a);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${fmtDate(b)}`;
  }
  return `${fmtDate(a, { year: a.getFullYear() !== b.getFullYear() ? true : undefined })} – ${fmtDate(b)}`;
}

/** "1 día" / "3 días" */
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "289,90 €" */
export function fmtMoney(amount) {
  const n = Number(amount);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

/** Local YYYY-MM-DD key (toISOString() would give the UTC day). */
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
