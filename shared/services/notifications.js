// La base de datos crea los avisos (triggers de supabase/migrations/*_notification_system.sql),
// así que la web y la app no pueden aplicar reglas distintas. Aquí solo se leen y se marcan.

export const NOTIFICATIONS_PAGE_SIZE = 50;

// Lo que cada persona puede silenciar. Un aviso desactivado sigue llegando a la bandeja.
export const NOTIFICATION_CATEGORIES = [
  { id: 'requests', label: 'Solicitudes', desc: 'Remoto, externo, compras y asuntos propios' },
  { id: 'reservations', label: 'Reservas', desc: 'Salas y vehículos' },
  { id: 'hours', label: 'Bolsa de horas', desc: 'Solicitudes y revisiones de horas' },
  { id: 'documents', label: 'Documentos', desc: 'Documentos que te envían' },
  { id: 'news', label: 'Noticias y eventos', desc: 'Nuevas publicaciones' },
];

/** `before` (created_at) pide la página siguiente del historial. */
export async function fetchNotifications(supabase, userId, { before, limit = NOTIFICATIONS_PAGE_SIZE } = {}) {
  if (!userId) return [];
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('fetchNotifications:', error.message);
    // null (not []) on failure: the caller keeps what it already shows
    return null;
  }
  return data || [];
}

/** Todos los sin leer, no solo los de la página cargada; null si no se pudo leer. */
export async function fetchUnreadCount(supabase, userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) {
    console.warn('fetchUnreadCount:', error.message);
    return null;
  }
  return count || 0;
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

/** Una fila nueva o actualizada sobre la lista, sin repetirla y de la más nueva a la más antigua. */
export function mergeNotification(list, row) {
  const rest = list.filter((n) => n.id !== row.id);
  return [row, ...rest].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Canal privado de esta persona. Broadcast solo avisa: la base de datos es la fuente de verdad, y
 * `onSync` (al entrar y al recuperar la conexión) vuelve a leerla para cubrir lo que se perdiera.
 * Devuelve la función que cierra el canal.
 */
export function subscribeToNotifications(supabase, userId, { onCreated, onUpdated, onSync }) {
  let channel = null;
  let closed = false;

  (async () => {
    // El token debe estar en el socket antes de entrar: la autorización del canal se evalúa al unirse
    await supabase.realtime.setAuth();
    if (closed) return;
    channel = supabase
      .channel(`user:${userId}:notifications`, { config: { private: true } })
      .on('broadcast', { event: 'notification_created' }, ({ payload }) => {
        if (payload?.notification) onCreated?.(payload.notification, payload.unread);
      })
      .on('broadcast', { event: 'notification_updated' }, ({ payload }) => onUpdated?.(payload))
      .on('broadcast', { event: 'notifications_sync' }, () => onSync?.())
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') onSync?.();
        else if (status === 'CHANNEL_ERROR') console.warn('notifications channel:', err?.message);
      });
  })().catch((err) => console.warn('notifications channel:', err?.message));

  return () => {
    closed = true;
    if (channel) supabase.removeChannel(channel);
  };
}

/** { requests: false, ... } con solo lo desactivado; null si no se pudo leer. */
export async function fetchNotificationPreferences(supabase, userId) {
  if (!userId) return {};
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('category, push_enabled')
    .eq('user_id', userId);
  if (error) {
    console.warn('fetchNotificationPreferences:', error.message);
    return null;
  }
  return Object.fromEntries(data.map((p) => [p.category, p.push_enabled]));
}

export async function setNotificationPreference(supabase, userId, category, pushEnabled) {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, category, push_enabled: pushEnabled, updated_at: new Date().toISOString() });
  if (error) console.warn('setNotificationPreference:', error.message);
  return { error };
}

export function allNotificationsEnabled(preferences) {
  return preferences != null && NOTIFICATION_CATEGORIES.every(({ id }) => preferences[id] !== false);
}

export async function setAllNotificationPreferences(supabase, userId, enabled) {
  if (!userId) return { error: new Error('No hay una sesión activa.') };
  const updated_at = new Date().toISOString();
  try {
    return await supabase.from('notification_preferences').upsert(
      NOTIFICATION_CATEGORIES.map(({ id }) => ({
        user_id: userId, category: id, push_enabled: enabled, updated_at,
      })),
      { onConflict: 'user_id,category' },
    );
  } catch (error) {
    return { error };
  }
}

/** Estado del sistema de avisos; solo responde a administradores. */
export async function fetchNotificationHealth(supabase) {
  const { data, error } = await supabase.rpc('notification_system_health');
  if (error) {
    console.warn('fetchNotificationHealth:', error.message);
    return null;
  }
  return data;
}

/** Marca de "esto llegó al dispositivo". Es informativa: si falla no cambia nada. */
export async function acknowledgeDelivery(supabase, deliveryId) {
  if (!deliveryId) return;
  const { error } = await supabase.rpc('notif_ack_delivery', { p_delivery_id: deliveryId });
  if (error) console.warn('acknowledgeDelivery:', error.message);
}
