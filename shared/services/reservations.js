/** The base table, not the `reservations_full` view: clients need employee_id, room_id and
 * vehicle_id to know who owns a reservation and to detect overlaps. */
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
    // null (not []) on failure: the caller keeps what it already shows
    return null;
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

export async function fetchRooms(supabase) {
  const { data, error } = await supabase.from('rooms').select('*').order('id');
  if (error) { console.error('fetchRooms:', error); return null; }
  return data.map(r => ({
    id: r.id, name: r.name, capacity: r.capacity, floor: r.floor, equipment: r.equipment,
    isActive: r.is_active !== false,
  }));
}

export async function fetchVehicles(supabase) {
  const { data, error } = await supabase.from('vehicles').select('*').order('id');
  if (error) { console.error('fetchVehicles:', error); return null; }
  return data.map(v => ({
    id: v.id, plate: v.plate, model: v.model, year: v.year, type: v.type,
    isActive: v.is_active !== false,
  }));
}

export async function createReservation(supabase, employeeId, payload) {
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

  return { data };
}

export async function updateReservationStatus(supabase, id, status, reviewedBy) {
  const { error } = await supabase.from('reservations').update({
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) {
    console.error('updateReservationStatus:', error);
    return { error };
  }
  return { error: null };
}

export async function deleteReservation(supabase, id) {
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) console.error('deleteReservation:', error);
  return { error };
}

/**
 * Removes a room or vehicle and its reservations (they reference it). The resource is only
 * deleted once its reservations are gone: if that step fails nothing else is touched.
 */
export async function deleteResource(supabase, type, id) {
  const column = type === 'vehicle' ? 'vehicle_id' : 'room_id';
  const { error: resErr } = await supabase.from('reservations').delete().eq(column, id);
  if (resErr) {
    console.error('deleteResource (reservations):', resErr);
    return { error: resErr };
  }
  const { error } = await supabase.from(type === 'vehicle' ? 'vehicles' : 'rooms').delete().eq('id', id);
  if (error) console.error('deleteResource:', error);
  return { error };
}
