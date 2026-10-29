import fs from 'fs';
import path from 'path';
import { updateReservationStatus, deleteResource } from '../shared/services/reservations.js';

export async function runEnterpriseQualityTests() {
  console.log('\n🔵 [SUITE 13: Calidad empresarial (fiabilidad, accesibilidad y coherencia web + app)]');
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

  const read = (p) => fs.readFileSync(path.resolve(p), 'utf-8');

  // Fake Supabase that records every write; `fail` makes the matching table's writes fail
  const recorder = (fail = {}) => {
    const calls = [];
    return {
      calls,
      from: (table) => {
        const q = {};
        let op = null;
        let payload = null;
        const done = () => ({ error: fail[`${table}.${op}`] || null });
        q.update = (p) => { op = 'update'; payload = p; return q; };
        q.delete = () => { op = 'delete'; return q; };
        q.insert = (p) => { op = 'insert'; payload = p; calls.push({ table, op, payload }); return Promise.resolve(done()); };
        q.eq = (col, val) => { calls.push({ table, op, payload, where: [col, val] }); return Promise.resolve(done()); };
        return q;
      },
    };
  };
  const { error: logErr, warn: logWarn } = console;
  console.error = () => {};
  console.warn = () => {};

  // 1. Reservas: el empleado recibe aviso (y push) de la decisión, como en solicitudes y horas
  const reservation = { id: 7, employeeId: 'emp', resourceName: 'Sala Azul', date: '2026-11-03', timeStart: '09:00', timeEnd: '10:00' };
  let sb = recorder();
  await updateReservationStatus(sb, 7, 'confirmed', 'admin', reservation);
  const notif = sb.calls.find((c) => c.table === 'notifications');
  assert('Reserva confirmada: se crea un aviso para su dueño', notif && notif.payload[0].user_id === 'emp' && notif.payload[0].entity_type === 'reservation');
  assert('El aviso dice qué, cuándo y el resultado', /Sala Azul/.test(notif?.payload[0].body) && /03\/11\/2026/.test(notif?.payload[0].body) && /confirmada/.test(notif?.payload[0].title));

  sb = recorder();
  await updateReservationStatus(sb, 7, 'cancelled', 'admin', reservation);
  assert('Reserva cancelada por un admin: aviso de cancelación', /cancelada/.test(sb.calls.find((c) => c.table === 'notifications')?.payload[0].title || ''));

  sb = recorder();
  await updateReservationStatus(sb, 7, 'confirmed', 'emp', reservation);
  assert('Quien revisa su propia reserva no se avisa a sí mismo', !sb.calls.some((c) => c.table === 'notifications'));

  sb = recorder({ 'reservations.update': { message: 'denied', code: '42501' } });
  const denied = await updateReservationStatus(sb, 7, 'confirmed', 'admin', reservation);
  assert('Si el cambio falla no se envía aviso y se devuelve el error', denied.error && !sb.calls.some((c) => c.table === 'notifications'));

  sb = recorder();
  await updateReservationStatus(sb, 7, 'confirmed', 'admin');
  assert('Sin la reserva (llamada antigua) sigue funcionando, sin aviso', !sb.calls.some((c) => c.table === 'notifications'));

  // 2. Borrar sala / vehículo: si no se pueden borrar sus reservas, la sala no se toca
  sb = recorder({ 'reservations.delete': { message: 'Failed to fetch' } });
  const stopped = await deleteResource(sb, 'room', 3);
  assert('Fallo al borrar las reservas: no se borra la sala', stopped.error && !sb.calls.some((c) => c.table === 'rooms'));
  sb = recorder();
  const okDel = await deleteResource(sb, 'vehicle', 5);
  const order = sb.calls.map((c) => `${c.table}.${c.op}:${c.where?.join('=')}`);
  assert('Borrado de vehículo: primero sus reservas, después el vehículo', !okDel.error && order[0] === 'reservations.delete:vehicle_id=5' && order[1] === 'vehicles.delete:id=5');

  console.error = logErr;
  console.warn = logWarn;

  // 3. La web y la app usan esas reglas
  const ctx = read('src/context/index.jsx');
  const mobileData = read('mobile/src/context/DataContext.js');
  const admin = read('src/pages/AdminPage.jsx');
  assert('Web: el cambio de estado de una reserva usa el servicio compartido (con aviso)', /updateReservationStatusSvc\(supabase, id, status, reviewedBy, reservation\)/.test(ctx));
  assert('App: el cambio de estado de una reserva pasa la reserva para avisar', /svc\.updateReservationStatus\(supabase, id, status, uid\(\), reservation\)/.test(mobileData));
  assert('Web y app: borrar sala o vehículo con el servicio compartido', /deleteResourceSvc\(supabase, type, id\)/.test(ctx) && /svc\.deleteResource\(supabase, 'room', id\)/.test(mobileData)
    && /svc\.deleteResource\(supabase, 'vehicle', id\)/.test(mobileData) && !/from\('reservations'\)\.delete\(\)\.eq\('room_id'/.test(admin));
  assert('Admin web: el aviso de borrado dice cuántas reservas se van con el recurso', /linked === 1 \? 'reserva' : 'reservas'/.test(admin));

  // 4. Salas y vehículos ocultos: la web respeta is_active como la app, y el servidor también
  const resPage = read('src/pages/ReservationsPage.jsx');
  assert('Web: lee rooms/vehicles con el servicio compartido (incluye isActive)', /fetchRoomsSvc\(supabase\)/.test(ctx) && /fetchVehiclesSvc\(supabase\)/.test(ctx));
  assert('Web: un recurso no disponible no se ofrece a los empleados', /allRooms\.filter\(r => r\.isActive !== false \|\| isAdmin\)/.test(resPage) && /allVehicles\.filter\(v => v\.isActive !== false \|\| isAdmin\)/.test(resPage));
  assert('Admin web: «Disponible para reservas» al editar sala o vehículo', /Disponible para reservas/.test(admin) && /payload\.is_active = active/.test(admin));
  const mig = read('supabase/migrations/20261029120000_resource_availability.sql');
  assert('Servidor: un empleado no puede reservar un recurso oculto (los admins sí)', /check_reservation_resource_active/.test(mig) && /public\.is_admin\(\)/.test(mig) && /to_jsonb\(r\)->>'is_active'/.test(mig));

  // 5. Disponibilidad "Libre ahora / En uso" por recurso, no por nombre (dos coches del mismo modelo)
  const resTouch = read('src/pages/ReservationsTouch.jsx');
  const resDesk = read('src/pages/ReservationsDesk.jsx');
  assert('Disponibilidad calculada por id del recurso', /sameResource\(r, type, id, name\)/.test(resPage) && /busyUntil\('vehicle', v\.id, v\.model\)/.test(resDesk) && /busyUntil\('vehicle', v\.id, v\.model\)/.test(resTouch));

  // 6. Formularios: el motivo real del rechazo llega a la persona y no se pierde lo escrito
  assert('Web: crear solicitud, asuntos propios u horas devuelve el motivo del error', (ctx.match(/return \{ error: toUserMessage\(error\) \}/g) || []).length >= 3);
  const reqPage = read('src/pages/RequestsPage.jsx');
  const horas = read('src/pages/HorasPage.jsx');
  assert('Los formularios muestran ese motivo (no «revisa tu conexión» para todo)', /setFormError\(created\?\.error/.test(reqPage) && /setSaveError\(result\?\.error/.test(horas));
  assert('Admin web: guardar sala o vehículo valida y muestra el error sin cerrar el formulario', /handleSaveResource/.test(admin) && /setResError\(toUserMessage\(error\)\)/.test(admin));
  assert('Admin web: crear o editar empleado no se envía dos veces', /if \(savingEmp\) return;/.test(admin) && /loading=\{savingEmp\}/.test(admin));

  // 7. Revisar: sin doble envío y rechazar pide confirmación (como la app)
  assert('Solicitudes: rechazar pide confirmación y avisa del resultado', /title="Rechazar solicitud"/.test(reqPage) && /inFlight\.current\.has\(key\)/.test(reqPage) && /Solicitud aprobada/.test(reqPage));
  assert('Reservas: rechazar pide confirmación y no admite doble clic', /title="Rechazar reserva"/.test(resPage) && /inFlight\.current\.has\(r\.id\)/.test(resPage));
  assert('Bolsa de horas: rechazar pide confirmación', /title: 'Rechazar horas'/.test(admin) && /reviewHours\(h, 'approved'\)/.test(admin));
  assert('App: rechazar una reserva desde la lista también pide confirmación', /confirmReject\(r\)/.test(read('mobile/src/screens/MyReservationsScreen.jsx')));
  assert('Las solicitudes muestran quién las revisó y cuándo', /reviewLine/.test(reqPage) && /reviewLine\?\.\(r\)/.test(read('src/pages/RequestsTouch.jsx')) && /fetchRequestsSvc\(supabase/.test(ctx));

  // 8. Avisos sin duplicar: el evento llega una vez (la fila de notifications)
  assert('Web: sin toasts repetidos de las tablas cuando ya hay notificación', !/Una solicitud ha sido aprobada/.test(ctx) && !/Tu reserva ha sido confirmada/.test(ctx) && !/Asuntos propios aprobados'\)/.test(ctx));
  assert('Web: un documento general (sin destinatario) se sigue anunciando', /!payload\.new\.recipient_id/.test(ctx) && /Nuevo documento disponible/.test(ctx));

  // 9. Cierre por inactividad: mismo minuto, pero con aviso y sin re-renderizar en cada movimiento
  const layout = read('src/components/Layout.jsx');
  const idle = read('src/components/IdleWarning.jsx');
  assert('El tiempo de inactividad no cambia (1 min)', /const IDLE_TIMEOUT = 60 \* 1000/.test(ctx));
  assert('Aviso 15 s antes del cierre, con «Seguir conectado»', /const IDLE_WARNING = 15 \* 1000/.test(ctx) && /Seguir conectado/.test(idle) && /<IdleWarning \/>/.test(layout));
  assert('La actividad se guarda en una ref (no un estado por cada movimiento del ratón)', /const lastActivityRef = useRef\(Date\.now\(\)\)/.test(ctx) && !/useState\(Date\.now\(\)\)/.test(ctx));
  assert('El aviso tiene su propio contexto (la cuenta atrás no re-renderiza la app)', /<IdleCtx\.Provider value=\{idleValue\}>/.test(ctx));
  assert('El aviso no roba el foco del campo que se está escribiendo', !/autoFocus/.test(idle) && /role="alert"/.test(idle));
  assert('El reloj de la cabecera se actualiza por minuto', /60000 - \(now\.getSeconds\(\) \* 1000/.test(layout) && !/setInterval\(\(\) => setTime\(new Date\(\)\), 1000\)/.test(layout));

  // 10. Accesibilidad de formularios y diálogos
  const input = read('src/components/ui/Input/Input.jsx');
  const textarea = read('src/components/ui/Textarea/Textarea.jsx');
  const select = read('src/components/ui/Select/Select.jsx');
  assert('Input, Textarea y Select asocian su etiqueta aunque no reciban id', [input, textarea, select].every((s) => /useId\(\)/.test(s) && /htmlFor=\{id\}/.test(s)));
  assert('Textarea y Select reciben el id que nombra la etiqueta', /<textarea\s+id=\{id\}/.test(textarea) && /<select\s+id=\{id\}/.test(select));
  assert('Campos obligatorios anunciados (aria-required)', [input, textarea, select].every((s) => /aria-required=\{required \|\| undefined\}/.test(s)));
  const modal = read('src/components/ui/Modal/Modal.jsx');
  assert('Modal: el foco entra al abrir y vuelve a quien lo abrió al cerrar', /panel\.focus\(\{ preventScroll: true \}\)/.test(modal) && /opener\.focus\(\{ preventScroll: true \}\)/.test(modal));
  assert('Modal: Escape cierra solo el diálogo de arriba', /openStack\[openStack\.length - 1\] !== tokenRef\.current/.test(modal));
  assert('Modal: sin encabezado vacío y con nombre accesible', /ariaLabel \|\|/.test(modal) && /title \? <h2/.test(modal));
  const confirm = read('src/components/ui/ConfirmModal/ConfirmModal.jsx');
  assert('Confirmación: espera a que termine la acción, sin doble pulsación, con nombre accesible', /await onConfirm\?\.\(\)/.test(confirm) && /if \(busy\) return;/.test(confirm) && /ariaLabel=\{title\}/.test(confirm));

  return { passed, failed };
}
