/* ═══════════════════════════════════════════════════════════════════
   Margube — notification service worker
   Registered by src/services/webPush.js with scope /push/ so it never
   competes with the PWA service worker for page/caching control.

   Shows notifications:
   • pushed by the server (Web Push), even with every tab closed
   • shown by an open page through this registration while the tab is
     hidden (src/services/webPush.js → showSystemNotification)
   Both use the tag `margube-<id>`, so the same notification never
   appears twice.
═══════════════════════════════════════════════════════════════════ */

const params = new URL(self.location.href).searchParams;
const SUPABASE_URL = params.get('u');
const SUPABASE_KEY = params.get('k');

const ICON = '/pwa-192x192.png';
const BADGE = '/pwa-192x192.png';
const GENERIC = { title: 'Margube Intranet', body: 'Tienes una nueva notificación.' };

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/* Where a notification should take the person (mirrors notificationWebPath in shared/config/constants.js) */
function routeFor(entityType, entityId, type) {
  if (type === 'message' && entityId && (entityType === 'request' || entityType === 'personal_day')) {
    return `/requests?chat=${entityType}-${encodeURIComponent(entityId)}`;
  }
  switch (entityType) {
    case 'request': return '/requests';
    case 'personal_day': return '/requests';
    case 'document': return '/profile';
    case 'hour_compensation': return '/horas';
    case 'reservation': return '/reservations';
    default: return '/dashboard';
  }
}

/* Fallback for id-only payloads: read the content over HTTPS, like the page does */
async function loadNotification(id) {
  if (!id || !SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?id=eq.${encodeURIComponent(id)}&select=id,title,body,type,entity_type,entity_id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

function show({ id, title, body, entityType, entityId, type, unread }) {
  return self.registration.showNotification(title || GENERIC.title, {
    body: body || GENERIC.body,
    icon: ICON,
    badge: BADGE,
    tag: id ? `margube-${id}` : 'margube',
    renotify: false,
    timestamp: Date.now(),
    data: { url: routeFor(entityType, entityId, type), id },
  }).then(() => {
    if (typeof unread === 'number' && self.navigator?.setAppBadge) {
      return unread > 0 ? self.navigator.setAppBadge(unread) : self.navigator.clearAppBadge();
    }
  }).catch(() => {});
}

/* ── Server push (tab closed or open) ─────────────────────────────── */
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* generic */ }

  event.waitUntil((async () => {
    // send-push includes the content; older payloads carry only the id
    const row = payload.title ? null : await loadNotification(payload.notificationId);
    await show({
      id: payload.notificationId,
      title: payload.title || row?.title,
      body: payload.body || row?.body,
      entityType: payload.entityType || row?.entity_type,
      entityId: payload.entityId || row?.entity_id,
      type: payload.type || row?.type,
      unread: payload.unread,
    });
  })());
});

/* ── Click: focus an open intranet tab or open a new one ─────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = windows.find((c) => new URL(c.url).origin === self.location.origin);
    if (tab) {
      await tab.focus();
      tab.postMessage({ type: 'margube:navigate', url, id: event.notification.data?.id });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
