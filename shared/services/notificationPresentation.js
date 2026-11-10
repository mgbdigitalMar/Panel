export const NOTIFICATION_SELECT = '*, actor:profiles!notifications_actor_id_fkey(name), recipient:profiles!notifications_user_id_fkey(name)';

const nameOf = (profile) => String((Array.isArray(profile) ? profile[0] : profile)?.name || '').trim();

export function notificationPresentation(row, recipientName = '') {
  const actor = nameOf(row.actor) || (row.actor_id === null ? 'Margube' : 'Origen no disponible');
  const recipient = nameOf(row.recipient) || recipientName.trim() || 'Destinatario no disponible';
  return {
    title: row.title || 'Margube',
    body: `De: ${actor} · Para: ${recipient}${row.body ? `\n${row.body}` : ''}`,
  };
}
