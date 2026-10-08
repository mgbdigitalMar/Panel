// Formatting helpers. Spanish names are spelled out instead of relying on Intl
// so output is identical on every Android version.

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const pad = (n) => String(n).padStart(2, '0');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayISO = () => toISODate(new Date());

/** Parse YYYY-MM-DD (or a full ISO timestamp) into a local Date. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7;
  return addDays(d, -dow);
}

/** "6 oct 2026" */
export function fmtDate(value, { year = true } = {}) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ''}`;
}

/** "Mar 6 oct" */
export function fmtDayShort(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Martes, 6 de octubre" */
export function fmtDayLong(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${cap(DAYS[d.getDay()])}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** "Octubre 2026" */
export function fmtMonthYear(d) {
  return `${cap(MONTHS[d.getMonth()])} ${d.getFullYear()}`;
}

export function fmtTime(value) {
  const d = parseDate(value);
  if (!d) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "09:12" today, "Ayer", or "3 oct". */
export function fmtRelative(value) {
  const d = parseDate(value);
  if (!d) return '';
  const today = toISODate(new Date());
  const day = toISODate(d);
  if (day === today) return fmtTime(d);
  if (day === toISODate(addDays(new Date(), -1))) return 'Ayer';
  return fmtDate(d, { year: d.getFullYear() !== new Date().getFullYear() });
}

/** Group key for notification lists. */
export function dayBucket(value) {
  const d = parseDate(value);
  if (!d) return 'Antes';
  const day = toISODate(d);
  if (day === todayISO()) return 'Hoy';
  if (day === toISODate(addDays(new Date(), -1))) return 'Ayer';
  return 'Anteriores';
}

/** 6.5 → "6:30" (absolute value). */
export function fmtHM(hours) {
  const totalMin = Math.round(Math.abs(Number(hours) || 0) * 60);
  return `${Math.floor(totalMin / 60)}:${pad(totalMin % 60)}`;
}

/** Signed: 6.5 → "+6:30", -2.5 → "−2:30", 0 → "0:00". */
export function fmtHMSigned(hours) {
  const n = Number(hours) || 0;
  if (Math.round(n * 60) === 0) return '0:00';
  return `${n < 0 ? '−' : '+'}${fmtHM(n)}`;
}

export function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function firstName(name) {
  return (name || '').split(/\s+/)[0] || '';
}

const AVATAR_COLORS = ['#F5B544', '#7AA2FF', '#5EE0D5', '#C4A5FF', '#FD93A4', '#5EE0B0', '#F7C46A', '#A9BEFF'];
export function avatarColor(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export function fmtMoney(amount) {
  const n = Number(amount) || 0;
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`;
}

export function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Inclusive day count between two YYYY-MM-DD dates. */
export function daysBetween(start, end) {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

// ── time-of-day helpers (HH:MM strings) ────────────────────────────
export function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function minToTime(min) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
