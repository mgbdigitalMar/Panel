/**
 * Hours compensation service — platform-agnostic.
 * CRUD for the `hour_compensations` table.
 */
import { createNotification, notifyAdmins } from './notifications.js';

/** Fetch all hour compensations */
export async function fetchHourCompensations(supabase) {
  const { data, error } = await supabase
    .from('hour_compensations')
    .select(`
      id, date, reason, hours, type, status, created_at, reviewed_at,
      employee_id, reviewed_by,
      employee:profiles!hour_compensations_employee_id_fkey(name),
      reviewer:profiles!hour_compensations_reviewed_by_fkey(name)
    `)
    .order('created_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('fetchHourCompensations:', error);
    return [];
  }
  return data.map(h => ({
    id: h.id,
    employeeId: h.employee_id,
    employeeName: h.employee?.name || null,
    reviewerId: h.reviewed_by,
    reviewerName: h.reviewer?.name || null,
    date: h.date,
    reason: h.reason,
    hours: parseFloat(h.hours),
    type: h.type,
    status: h.status,
    reviewedAt: h.reviewed_at,
    createdAt: h.created_at,
  }));
}

/** Create a new hour compensation entry */
export async function createHourCompensation(supabase, employees, { employeeId, date, reason, hours, type }) {
  const status = type === 'bolsa' ? 'pending' : 'approved';
  const { data, error } = await supabase.from('hour_compensations').insert([{
    employee_id: employeeId,
    date,
    reason,
    hours: parseFloat(hours),
    type,
    status,
    reviewed_at: type === 'ya' ? new Date().toISOString() : null,
  }]).select().single();
  if (error) {
    console.error('createHourCompensation:', error);
    return { error };
  }

  if (type === 'bolsa') {
    const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado';
    await notifyAdmins(supabase, employees, {
      title: `⌛ Nueva bolsa de horas`,
      body: `${empName} solicita compensar ${hours}h en su bolsa.`,
      type: 'info',
      entityType: 'hour_compensation',
      entityId: data?.id,
    });
  }

  return { data };
}

/** Update hour compensation status */
export async function updateHourCompensationStatus(supabase, id, status, reviewedBy, employeeId) {
  const { error } = await supabase.from('hour_compensations').update({
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) {
    console.error('updateHourCompensationStatus:', error);
    return { error };
  }

  if (employeeId) {
    await createNotification(supabase, {
      userId: employeeId,
      title: status === 'approved' ? '✅ Horas aprobadas' : '❌ Horas rechazadas',
      body: status === 'approved'
        ? 'Tu solicitud de bolsa de horas ha sido aprobada.'
        : 'Tu solicitud ha sido rechazada.',
      type: status === 'approved' ? 'success' : 'error',
      entityType: 'hour_compensation',
      entityId: id,
    });
  }
  return { error: null };
}

/** Delete hour compensation entry */
export async function deleteHourCompensation(supabase, id) {
  const { error } = await supabase.from('hour_compensations').delete().eq('id', id);
  if (error) console.error('deleteHourCompensation:', error);
  return { error };
}
