/**
 * Calendar export (.ics) — opens in Google Calendar, Outlook and Apple Calendar.
 * Times are written as floating local time (no TZ suffix): a 10:00 booking
 * stays 10:00 in the person's own calendar.
 */

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' + 'HH:MM' → 'YYYYMMDDTHHMM00' */
function icsDateTime(date, time = '00:00') {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

/** RFC 5545 text escaping */
function esc(text = '') {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function stamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/**
 * @param {{ uid: string, title: string, date: string, timeStart?: string, timeEnd?: string,
 *           description?: string, location?: string }} event
 */
export function buildIcs(event) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Margube//Intranet//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@margube-intranet`,
    `DTSTAMP:${stamp()}`,
    `DTSTART:${icsDateTime(event.date, event.timeStart)}`,
    `DTEND:${icsDateTime(event.date, event.timeEnd || event.timeStart)}`,
    `SUMMARY:${esc(event.title)}`,
    event.description ? `DESCRIPTION:${esc(event.description)}` : null,
    event.location ? `LOCATION:${esc(event.location)}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

/** Builds the .ics for a reservation and triggers the download. */
export function downloadReservationIcs(r) {
  const kind = r.type === 'vehicle' ? 'Vehículo' : 'Sala';
  const ics = buildIcs({
    uid: `reservation-${r.id}`,
    title: `${kind}: ${r.resourceName || 'Reserva'}`,
    date: r.date,
    timeStart: r.timeStart,
    timeEnd: r.timeEnd,
    description: r.purpose ? `Propósito: ${r.purpose}` : 'Reserva hecha desde la intranet de Margube',
    location: r.resourceName,
  });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reserva-${(r.resourceName || 'margube').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${r.date}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Local calendar date as 'YYYY-MM-DD' (toISOString would shift to UTC). */
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
