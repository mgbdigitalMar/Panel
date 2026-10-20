/**
 * Requests service — platform-agnostic.
 * CRUD operations for the `requests` table.
 */
import { createNotification, notifyAdmins } from './notifications.js';
import { REQUEST_WORK_MODE, localISODate } from './workMode.js';

/** Fetch all requests with employee join */
export async function fetchRequests(supabase) {
  const { data, error } = await supabase
    .from('requests')
    // `*` instead of a column list so the query keeps working before the
    // returned_at migration has been run
    .select(`
      *,
      employee:profiles!requests_employee_id_fkey(id, name, department, avatar_initials),
      reviewer:profiles!requests_reviewed_by_fkey(name)
    `)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchRequests:', error);
    return [];
  }
  return data.map(r => ({
    id: r.id,
    type: r.type,
    status: r.status,
    reason: r.reason,
    createdAt: r.created_at,
    employeeId: r.employee?.id,
    employeeName: r.employee?.name,
    startDate: r.start_date,
    endDate: r.end_date,
    days: r.days,
    item: r.item,
    amount: r.amount,
    reviewerId: r.reviewed_by,
    reviewerName: r.reviewer?.name || null,
    reviewedAt: r.reviewed_at,
    // undefined = column not created yet (see workMode.js)
    returnedAt: 'returned_at' in r ? r.returned_at : undefined,
  }));
}

/** Create a new request */
export async function createRequest(supabase, employees, employeeId, payload) {
  const { data, error } = await supabase
    .from('requests')
    .insert([{ employee_id: employeeId, ...payload }])
    .select()
    .single();
  if (error) {
    console.error('createRequest:', error);
    return { error };
  }

  const typeLabel = payload.type === 'remoto' ? 'Remoto'
    : payload.type === 'external' ? 'Trabajo Externo'
    : 'Compra';
  const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado';
  await notifyAdmins(supabase, employees, {
    title: `📋 Nueva solicitud: ${typeLabel}`,
    body: `${empName} ha enviado una solicitud de ${typeLabel.toLowerCase()} que requiere revisión.`,
    type: 'info',
    entityType: 'request',
    entityId: data?.id,
  });

  return { data };
}

/** Update request status (approve/reject) */
export async function updateRequestStatus(supabase, employees, id, status, reviewedBy, employeeId) {
  const { data: reqData } = await supabase
    .from('requests')
    .select('type, start_date, end_date')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('requests')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('updateRequestStatus:', error);
    return { error };
  }

  // Approving a remote / external request that covers today changes the work mode at once
  if (status === 'approved' && REQUEST_WORK_MODE[reqData?.type] && employeeId) {
    const today = localISODate();
    if (today >= reqData.start_date && today <= reqData.end_date) {
      await supabase.from('profiles').update({ work_mode: REQUEST_WORK_MODE[reqData.type] }).eq('id', employeeId);
    }
  }

  if (employeeId) {
    const typeLabel = reqData?.type === 'external' ? 'trabajo externo'
      : reqData?.type === 'remoto' ? 'remoto'
      : 'compra';
    await createNotification(supabase, {
      userId: employeeId,
      title: status === 'approved' ? '✅ Solicitud aprobada' : '❌ Solicitud rechazada',
      body: status === 'approved'
        ? `Tu solicitud de ${typeLabel} ha sido aprobada.`
        : `Tu solicitud de ${typeLabel} ha sido rechazada.`,
      type: status === 'approved' ? 'success' : 'error',
      entityType: 'request',
      entityId: id,
    });
  }
  return { error: null };
}

/** Delete a request */
export async function deleteRequest(supabase, id) {
  const { error } = await supabase.from('requests').delete().eq('id', id);
  if (error) console.error('deleteRequest:', error);
  return { error };
}
