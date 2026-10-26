
export async function fetchNotifications(supabase, userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('fetchNotifications:', error.message);
    // null (not []) on failure: the caller keeps what it already shows
    return null;
  }
  return data || [];
}

export async function markNotifRead(supabase, id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) console.warn('markNotifRead:', error.message);
}

export async function markAllNotifsRead(supabase, userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) console.warn('markAllNotifsRead:', error.message);
}

export async function createNotification(supabase, { userId, title, body, type = 'info', entityType, entityId }) {
  const { error } = await supabase.from('notifications').insert([{
    user_id: userId,
    title,
    body: body || null,
    type,
    entity_type: entityType || null,
    entity_id: entityId || null,
    read: false,
  }]);
  if (error) {
    console.warn('createNotification:', error.message);
  }
}

export async function notifyAdmins(supabase, employees, { title, body, type = 'info', entityType, entityId }) {
  const adminIds = employees
    .filter(e => e.role === 'admin')
    .map(e => e.id);
  if (adminIds.length === 0) return;

  const notifs = adminIds.map(adminId => ({
    user_id: adminId,
    title,
    body: body || null,
    type,
    entity_type: entityType || null,
    entity_id: entityId || null,
    read: false,
  }));

  const { error } = await supabase.from('notifications').insert(notifs);
  if (error) {
    console.warn('notifyAdmins:', error.message);
  }
}
