import { removeStorageFile } from './documents.js';
import { safeFileUrl } from '../utils/urls.js';

/** Pass `employeeId` for an employee: they only get their own (admins get all). */
export async function fetchPersonalDays(supabase, { employeeId } = {}) {
  let query = supabase
    .from('personal_days')
    .select(`
      id, date, reason, file_url, status, created_at, reviewed_at,
      employee_id, reviewed_by,
      employee:profiles!personal_days_employee_id_fkey(name),
      reviewer:profiles!personal_days_reviewed_by_fkey(name)
    `)
    .order('created_at', { ascending: false });
  if (employeeId) query = query.eq('employee_id', employeeId);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error('fetchPersonalDays:', error);
    // null (not []) on failure: the caller keeps what it already shows
    return error ? null : [];
  }
  return data.map(p => ({
    id: p.id,
    employeeId: p.employee_id,
    employeeName: p.employee?.name || null,
    reviewerId: p.reviewed_by,
    reviewerName: p.reviewer?.name || null,
    date: p.date,
    reason: p.reason,
    fileUrl: safeFileUrl(p.file_url),
    status: p.status,
    reviewedAt: p.reviewed_at,
    createdAt: p.created_at,
  }));
}

export async function createPersonalDay(supabase, { employeeId, date, reason, fileUrl }) {
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

  return { data };
}

export async function updatePersonalDayStatus(supabase, id, status, reviewedBy) {
  const { error } = await supabase.from('personal_days').update({
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) {
    console.error('updatePersonalDayStatus:', error);
    return { error };
  }
  return { error: null };
}

/** Also removes the attached file. */
export async function deletePersonalDay(supabase, id, fileUrl) {
  await removeStorageFile(supabase, fileUrl);
  const { error } = await supabase.from('personal_days').delete().eq('id', id);
  if (error) console.error('deletePersonalDay:', error);
  return { error };
}
