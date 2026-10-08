/**
 * Notifications service — platform-agnostic.
 * Manages in-app notifications stored in the `notifications` table.
 */

/** Fetch notifications for a user */
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
    return [];
  }
  return data || [];
}

/** Mark a single notification as read */
export async function markNotifRead(supabase, id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) console.warn('markNotifRead:', error.message);
}

/** Mark all notifications for a user as read */
export async function markAllNotifsRead(supabase, userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) console.warn('markAllNotifsRead:', error.message);
}

/** Create a notification for a specific user */
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

/** Notify all admin users */
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
