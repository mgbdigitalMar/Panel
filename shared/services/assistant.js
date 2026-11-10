export const ASSISTANT_ACTIONS = [
  'create_request', 'create_personal_day', 'create_reservation',
  'delete_request', 'delete_personal_day', 'delete_reservation',
  'approve_request', 'reject_request', 'approve_personal_day', 'reject_personal_day',
  'confirm_reservation', 'cancel_reservation',
];

const nullableText = { type: ['string', 'null'] };
const nullableDate = { type: ['string', 'null'], description: 'Fecha ISO exacta YYYY-MM-DD, por ejemplo 2027-01-18; nunca texto natural ni DD/MM/YYYY.' };
const nullableTime = { type: ['string', 'null'], description: 'Hora de 24 horas HH:mm, por ejemplo 10:00.' };
export const ASSISTANT_RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['message', 'action'],
  properties: {
    message: { type: 'string' },
    action: { anyOf: [{ type: 'null' }, {
      type: 'object', additionalProperties: false,
      required: ['kind', 'id', 'type', 'resource_id', 'date', 'start_date', 'end_date', 'time_start', 'time_end', 'reason', 'item', 'amount'],
      properties: {
        kind: { type: 'string', enum: ASSISTANT_ACTIONS }, id: nullableText,
        type: { type: ['string', 'null'], enum: ['remoto', 'external', 'purchase', 'room', 'vehicle', null] },
        resource_id: nullableText, date: nullableDate, start_date: nullableDate,
        end_date: { ...nullableDate, description: 'Fecha final ISO YYYY-MM-DD. En una solicitud de un solo día debe ser igual a start_date, no null.' },
        time_start: nullableTime, time_end: nullableTime, reason: nullableText, item: nullableText,
        amount: { type: ['number', 'null'] },
      },
    }] },
  },
};

function text(value, label, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Revisa ${label}.`);
  return value.trim();
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error('La fecha no es válida.');
  }
  return value;
}

const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const REQUEST_NAMES = { remoto: 'Trabajo en remoto', external: 'Trabajo externo', purchase: 'Compra' };

/** Treat every model proposal as untrusted. Resolve ownership and labels from current app data. */
export function prepareAssistantAction(action, context, now = new Date()) {
  const { user, requests = [], personalDays = [], reservations = [], rooms = [], vehicles = [] } = context;
  if (!user?.id || !action || !ASSISTANT_ACTIONS.includes(action.kind)) throw new Error('La acción no está disponible.');
  const admin = user.role === 'admin';
  const kind = action.kind;
  if (kind === 'create_request') {
    if (!Object.hasOwn(REQUEST_NAMES, action.type)) throw new Error('Tipo de solicitud no válido.');
    const payload = { type: action.type, reason: text(action.reason, 'el motivo') };
    if (action.type === 'purchase') {
      payload.item = text(action.item, 'el artículo', 200);
      if (typeof action.amount !== 'number' || !Number.isFinite(action.amount) || action.amount <= 0) throw new Error('Indica un importe mayor que cero.');
      payload.amount = action.amount;
      return { kind, title: 'Enviar solicitud de compra', details: [payload.item, `${payload.amount.toLocaleString('es-ES')} €`, payload.reason], payload };
    }
    payload.start_date = date(action.start_date);
    payload.end_date = date(action.end_date);
    if (payload.end_date < payload.start_date) throw new Error('La fecha final debe ser posterior o igual a la inicial.');
    return { kind, title: `Solicitar ${REQUEST_NAMES[action.type].toLowerCase()}`, details: [`${payload.start_date} a ${payload.end_date}`, payload.reason], payload };
  }
  if (kind === 'create_personal_day') {
    const payload = { date: date(action.date), reason: text(action.reason, 'el motivo') };
    return { kind, title: 'Solicitar un día de asuntos propios', details: [payload.date, payload.reason], payload };
  }
  if (kind === 'create_reservation') {
    if (!['room', 'vehicle'].includes(action.type)) throw new Error('Recurso no válido.');
    const resource = (action.type === 'room' ? rooms : vehicles).find((r) => sameId(r.id, action.resource_id));
    if (!resource || resource.isActive === false) throw new Error('El recurso ya no está disponible.');
    const day = date(action.date);
    if (![action.time_start, action.time_end].every((v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v))
      || action.time_end <= action.time_start) throw new Error('Revisa el horario de la reserva.');
    if (new Date(`${day}T${action.time_start}`) < now) throw new Error('No se puede reservar en el pasado.');
    const column = action.type === 'room' ? 'roomId' : 'vehicleId';
    if (reservations.some((r) => sameId(r[column], resource.id) && r.date === day && r.status !== 'cancelled'
      && r.timeStart < action.time_end && r.timeEnd > action.time_start)) throw new Error('El recurso ya está ocupado en ese horario.');
    const payload = { type: action.type, [action.type === 'room' ? 'room_id' : 'vehicle_id']: resource.id,
      date: day, time_start: action.time_start, time_end: action.time_end, purpose: text(action.reason, 'el propósito'), status: 'pending' };
    return { kind, title: 'Crear reserva', details: [resource.name || resource.model, `${day}, ${action.time_start}–${action.time_end}`, payload.purpose], payload };
  }

  const isDay = kind.endsWith('_personal_day');
  const isReservation = kind.endsWith('_reservation');
  const row = (isDay ? personalDays : isReservation ? reservations : requests).find((r) => sameId(r.id, action.id));
  if (!row) throw new Error('El registro ya no está disponible. Actualiza la página y vuelve a consultarlo.');
  const deleting = kind.startsWith('delete_');
  if (!admin && (!deleting || !sameId(row.employeeId, user.id) || row.status !== 'pending')) {
    throw new Error('No tienes permiso para realizar esa acción. Solo puedes eliminar tus propios trámites pendientes.');
  }
  if (!deleting && row.status !== 'pending' && kind !== 'cancel_reservation') throw new Error('El trámite ya se ha revisado.');
  if (kind === 'cancel_reservation' && row.status === 'cancelled') throw new Error('La reserva ya está cancelada.');
  const status = kind.startsWith('approve_') ? 'approved' : kind.startsWith('reject_') ? 'rejected'
    : kind === 'confirm_reservation' ? 'confirmed' : 'cancelled';
  const verb = deleting ? 'Eliminar' : status === 'approved' ? 'Aprobar' : status === 'rejected' ? 'Rechazar'
    : status === 'confirmed' ? 'Confirmar' : 'Cancelar';
  const label = isReservation ? row.resourceName || 'Reserva' : isDay ? 'Asuntos propios' : REQUEST_NAMES[row.type] || 'Solicitud';
  return { kind, title: `${verb}: ${label}`, danger: deleting || ['rejected', 'cancelled'].includes(status),
    details: [row.employeeName || user.name, row.date || row.startDate || row.item || '',
      isReservation ? `${row.timeStart}–${row.timeEnd}` : '', `Referencia: ${row.id}`].filter(Boolean),
    id: row.id, employeeId: row.employeeId, status, requestType: isDay ? 'asuntos_propios' : row.type };
}

/** Use the same context actions as the existing forms, after validating again at confirmation. */
export async function executeAssistantAction(action, context, now) {
  const prepared = prepareAssistantAction(action, context, now);
  const { kind, payload, id, status, employeeId, requestType } = prepared;
  const actor = context.user.id;
  let result;
  if (kind === 'create_request') result = await context.createRequest(actor, payload);
  else if (kind === 'create_personal_day') result = await context.createPersonalDay({ employeeId: actor, ...payload, fileUrl: null });
  else if (kind === 'create_reservation') result = await context.createReservation(actor, payload);
  else if (kind === 'delete_reservation') result = await context.deleteReservation(id);
  else if (kind.startsWith('delete_')) result = await context.deleteRequest(id, requestType);
  else if (kind.endsWith('_personal_day')) result = await context.updatePersonalDayStatus(id, status, actor);
  else if (kind.endsWith('_reservation')) result = await context.updateReservationStatus(id, status, actor);
  else result = await context.updateRequestStatus(id, status, actor, employeeId);
  if (!result || result.error) throw new Error(typeof result?.error === 'string' ? result.error : 'No se ha podido completar la acción. Comprueba su estado antes de repetirla.');
  return prepared;
}
