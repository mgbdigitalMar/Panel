// Same rules as the web (src/utils/workday.js).

/**
 * Margube working hours: 08:00–17:00 Monday to Thursday, 08:00–14:30 on Friday.
 * Returns 0–100 for how far through today's workday we are (0 at weekends).
 */
export function workdayProgress(now = new Date()) {
  const day = now.getDay(); // 0 Sun … 6 Sat
  if (day === 0 || day === 6) return 0;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = 8 * 60;
  const end = day === 5 ? 14 * 60 + 30 : 17 * 60;
  if (minutes <= start) return 0;
  if (minutes >= end) return 100;
  return ((minutes - start) / (end - start)) * 100;
}

export const isWeekend = (now = new Date()) => now.getDay() === 0 || now.getDay() === 6;

/** One short line under the greeting, rotating by day like the web. */
export function motivationFor(now = new Date()) {
  const h = now.getHours();
  const lines = h < 13
    ? ['¡Buena jornada por delante!', 'Empieza el día con energía', 'El equipo te espera']
    : h < 17
      ? ['Sigue así, ¡casi lo tienes!', 'La tarde avanza bien', '¡Gran trabajo hoy!']
      : ['El día fue productivo', '¡Buen trabajo hoy!', 'Descansa y recarga'];
  return lines[now.getDate() % lines.length];
}
