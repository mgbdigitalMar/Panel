/**
 * Reservations service — platform-agnostic.
 * CRUD for `reservations`, `rooms`, `vehicles` tables.
 */
import { notifyAdmins } from './notifications.js';

/**
 * Fetch all reservations.
 * Reads the base table with joins instead of the `reservations_full` view:
 * the view only exposes names, and clients need employee_id / room_id /
 * vehicle_id to know who owns a reservation and to detect overlaps.
 */
export async function fetchReservations(supabase) {
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id, type, room_id, vehicle_id, employee_id, date, time_start, time_end,
      purpose, status, reviewed_by, reviewed_at, created_at,
      employee:profiles!reservations_employee_id_fkey(name),
      reviewer:profiles!reservations_reviewed_by_fkey(name),
      room:rooms(name),
      vehicle:vehicles(model, plate)
    `)
    .order('date', { ascending: false });
  if (error) {
    console.error('fetchReservations:', error);
    return [];
  }
  return data.map(r => ({
    id: r.id,
    type: r.type,
    resourceName: r.type === 'vehicle'
      ? (r.vehicle?.model || 'Vehículo')
      : (r.room?.name || 'Sala'),
    roomId: r.room_id ?? null,
    vehicleId: r.vehicle_id ?? null,
    employeeId: r.employee_id,
    employeeName: r.employee?.name || null,
    date: r.date,
    timeStart: r.time_start?.slice(0, 5),
    timeEnd: r.time_end?.slice(0, 5),
    purpose: r.purpose,
    status: r.status,
    reviewerId: r.reviewed_by,
    reviewerName: r.reviewer?.name || null,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  }));
}

/** Fetch all rooms */
export async function fetchRooms(supabase) {
  const { data, error } = await supabase.from('rooms').select('*').order('id');
  if (error) { console.error('fetchRooms:', error); return []; }
  return data.map(r => ({
    id: r.id, name: r.name, capacity: r.capacity, floor: r.floor, equipment: r.equipment,
    isActive: r.is_active !== false,
  }));
}

/** Fetch all vehicles */
export async function fetchVehicles(supabase) {
  const { data, error } = await supabase.from('vehicles').select('*').order('id');
  if (error) { console.error('fetchVehicles:', error); return []; }
  return data.map(v => ({
    id: v.id, plate: v.plate, model: v.model, year: v.year, type: v.type,
    isActive: v.is_active !== false,
  }));
}

/** Create a reservation */
export async function createReservation(supabase, employees, rooms, vehicles, employeeId, payload) {
  let rName = payload.resourceName;
  if (!rName) {
    if (payload.type === 'room') {
      rName = rooms.find(r => String(r.id) === String(payload.room_id))?.name || 'Sala';
    } else {
      rName = vehicles.find(v => String(v.id) === String(payload.vehicle_id))?.model || 'Vehículo';
    }
  }

  const roomId = payload.type === 'room' && payload.room_id ? parseInt(payload.room_id, 10) : null;
  const vehicleId = payload.type === 'vehicle' && payload.vehicle_id ? parseInt(payload.vehicle_id, 10) : null;
  const purpose = payload.purpose?.trim() || (payload.type === 'room' ? 'Reserva de sala' : 'Uso de vehículo');

  const { data, error } = await supabase.from('reservations').insert([{
    employee_id: employeeId,
    type: payload.type,
    room_id: roomId,
    vehicle_id: vehicleId,
    date: payload.date,
    time_start: payload.time_start,
    time_end: payload.time_end,
    purpose,
    status: payload.status || 'pending',
  }]).select().single();

  if (error) {
    console.error('createReservation:', error);
    return { error };
  }

  const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado';
  await notifyAdmins(supabase, employees, {
    title: `📅 Nueva reserva: ${rName}`,
    body: `${empName} ha realizado una reserva de ${payload.type === 'room' ? 'sala' : 'vehículo'}.`,
    type: 'info',
    entityType: 'reservation',
    entityId: data?.id ? String(data.id) : null,
  });

  return { data };
}

/** Update reservation status */
export async function updateReservationStatus(supabase, id, status, reviewedBy) {
  const { error } = await supabase.from('reservations').update({
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) console.error('updateReservationStatus:', error);
  return { error };
}

/** Delete a reservation */
export async function deleteReservation(supabase, id) {
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) console.error('deleteReservation:', error);
  return { error };
}
