import fs from 'fs';
import path from 'path';
import { weekDates, dayAvailability, teamWeek, dayCounts } from '../shared/services/availability.js';

export async function runTeamAvailabilityTests() {
  console.log('\n🔵 [SUITE 8: Disponibilidad del equipo (Equipo → Semana)]');
  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✅ ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Semana: de lunes a viernes, también desde un domingo y cruzando de mes
  const wed = '2026-10-28'; // miércoles
  assert('Semana actual va de lunes a viernes', JSON.stringify(weekDates(0, wed)) === JSON.stringify(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']));
  assert('Desde un domingo se toma su semana (lunes anterior)', weekDates(0, '2026-11-01')[0] === '2026-10-26');
  assert('Semana siguiente cruza de mes', weekDates(1, wed)[0] === '2026-11-02');
  assert('Semana anterior', weekDates(-1, wed)[4] === '2026-10-23');

  // 2. Prioridades de cada día
  const ana = { id: 'a', name: 'Ana', workMode: 'remoto', teleworkDays: [1] };
  const data = {
    today: wed,
    requests: [
      { employeeId: 'a', type: 'external', status: 'approved', startDate: '2026-10-29', endDate: '2026-10-29', returnedAt: null },
      { employeeId: 'a', type: 'remoto', status: 'pending', startDate: '2026-10-30', endDate: '2026-10-30' },
      { employeeId: 'a', type: 'purchase', status: 'approved', startDate: '2026-10-27', endDate: '2026-10-27' },
    ],
    personalDays: [
      { employeeId: 'a', status: 'approved', date: '2026-11-02' },
      { employeeId: 'a', status: 'rejected', date: '2026-10-27' },
    ],
  };
  const at = (date) => dayAvailability(ana, date, data);
  assert('Hoy manda el modo de trabajo actual (en vivo)', at(wed).status === 'remoto' && at(wed).source === 'live');
  assert('Solicitud aprobada de trabajo externo', at('2026-10-29').status === 'externo' && at('2026-10-29').source === 'request');
  assert('Solicitud pendiente no cuenta', at('2026-10-30').status === 'office');
  assert('Una compra no cambia dónde trabaja', at('2026-10-27').status === 'office');
  assert('Asuntos propios rechazados no cuentan', at('2026-10-27').source === 'schedule');
  assert('Día de teletrabajo fijo (lunes)', at('2026-10-26').status === 'remoto' && at('2026-10-26').source === 'schedule');
  assert('Asuntos propios aprobados ganan al horario', at('2026-11-02').status === 'asuntos_propios');
  assert('Asuntos propios hoy ganan al modo en vivo',
    dayAvailability(ana, wed, { ...data, personalDays: [{ employeeId: 'a', status: 'approved', date: wed }] }).status === 'asuntos_propios');
  assert('Vuelta anticipada (returned_at): la solicitud deja de aplicar',
    dayAvailability(ana, '2026-10-29', { ...data, requests: [{ ...data.requests[0], returnedAt: '2026-10-28T09:00:00Z' }] }).status === 'office');
  assert('Sin modo de trabajo → oficina', dayAvailability({ id: 'b' }, wed, data).status === 'office');
  assert('Las solicitudes de otra persona no cuentan', dayAvailability({ id: 'b' }, '2026-10-29', data).status === 'office');

  // 3. Tabla y recuento por día
  const rows = teamWeek([ana, { id: 'b', workMode: 'Office' }], weekDates(0, wed), data);
  assert('Una fila por persona y cinco días', rows.length === 2 && rows.every(r => r.days.length === 5));
  const c = dayCounts(rows, wed);
  assert('Recuento de hoy: 1 en remoto y 1 en oficina', c.remoto === 1 && c.office === 1 && c.externo === 0);
  assert('Sin empleados no falla', teamWeek(undefined, weekDates(0, wed)).length === 0);

  // 4. Las dos apps usan el mismo cálculo y mantienen sus vistas anteriores
  const root = process.cwd();
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
  // Phones and tablets: EmployeesTouch; computers: EmployeesDesk (the page picks one)
  const web = read('src', 'pages', 'EmployeesPage.jsx') + read('src', 'pages', 'EmployeesDesk.jsx');
  assert('Web: Equipo muestra la vista Semana', web.includes("view === 'week'") && web.includes('<TeamWeek'));
  assert('Web: la vista Semana usa el cálculo compartido', read('src', 'components', 'TeamWeek.jsx').includes('shared/services/availability.js'));
  assert('Web: siguen las vistas cuadrícula y tabla', web.includes("value: 'grid'") && web.includes("view === 'list'"));
  const app = read('mobile', 'src', 'screens', 'EmployeesScreen.jsx');
  assert('App: Equipo muestra la vista Semana', app.includes("view === 'week'") && app.includes('<TeamWeek'));
  assert('App: la vista Semana usa el cálculo compartido', read('mobile', 'src', 'components', 'TeamWeek.jsx').includes('@shared/services/availability.js'));
  assert('App: sigue la lista del directorio', app.includes("navigation.navigate('EmployeeDetail'"));

  return { passed, failed };
}
