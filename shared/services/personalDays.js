/**
 * Personal days service — platform-agnostic.
 * CRUD for the `personal_days` table.
 */
import { createNotification, notifyAdmins } from './notifications.js';
import { removeStorageFile } from './documents.js';

/** Fetch all personal days */
export async function fetchPersonalDays(supabase) {
  const { data, error } = await supabase
    .from('personal_days')
    .select(`
      id, date, reason, file_url, status, created_at, reviewed_at,
      employee_id, reviewed_by,
      employee:profiles!personal_days_employee_id_fkey(name),
      reviewer:profiles!personal_days_reviewed_by_fkey(name)
    `)
    .order('created_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('fetchPersonalDays:', error);
    return [];
  }
  return data.map(p => ({
    id: p.id,
    employeeId: p.employee_id,
    employeeName: p.employee?.name || null,
    reviewerId: p.reviewed_by,
    reviewerName: p.reviewer?.name || null,
    date: p.date,
    reason: p.reason,
    fileUrl: p.file_url,
    status: p.status,
    reviewedAt: p.reviewed_at,
    createdAt: p.created_at,
  }));
}

/** Create a personal day request */
export async function createPersonalDay(supabase, employees, { employeeId, date, reason, fileUrl }) {
  const { data, error } = await supabase.from('personal_days').insert([{
    employee_id: employeeId,
    date,
    reason,
    file_url: fileUrl || null,
    status: 'pending',
  }]).select().single();
  if (error) {
    console.error('createPersonalDay:', error);
    return { error };
  }

  const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado';
  await notifyAdmins(supabase, employees, {
    title: `📝 Día de asuntos propios`,
    body: `${empName} ha solicitado un día de asuntos propios.`,
    type: 'info',
    entityType: 'personal_day',
    entityId: data?.id,
  });

  return { data };
}

/** Update personal day status */
export async function updatePersonalDayStatus(supabase, id, status, reviewedBy, employeeId) {
  const { error } = await supabase.from('personal_days').update({
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) {
    console.error('updatePersonalDayStatus:', error);
    return { error };
  }

  if (employeeId) {
    await createNotification(supabase, {
      userId: employeeId,
      title: status === 'approved' ? '✅ Asuntos propios aprobados' : '❌ Asuntos propios rechazados',
      body: status === 'approved'
        ? 'Tu solicitud de día de asuntos propios ha sido aprobada.'
        : 'Tu solicitud ha sido rechazada.',
      type: status === 'approved' ? 'success' : 'error',
      entityType: 'personal_day',
      entityId: id,
    });
  }
  return { error: null };
}

/** Delete a personal day request and its attached file (same as web). */
export async function deletePersonalDay(supabase, id, fileUrl) {
  await removeStorageFile(supabase, fileUrl);
  const { error } = await supabase.from('personal_days').delete().eq('id', id);
  if (error) console.error('deletePersonalDay:', error);
  return { error };
}
