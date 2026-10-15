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

/** "Buenos días" / "Buenas tardes" / "Buenas noches" */
export function greetingFor(now = new Date()) {
  const h = now.getHours();
  return h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}
