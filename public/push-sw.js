/* Notification service worker. Registered by src/services/webPush.js with scope /push/ so it
   never competes with the PWA worker. Server pushes and notifications shown by an open page share
   the tag `margube-<id>`, so none appears twice.

   Everything shown here can end up on a locked screen, so the text is always the same generic one:
   the detail is read inside the intranet, with a session. */

const params = new URL(self.location.href).searchParams;
const SUPABASE_URL = params.get('u');
const SUPABASE_KEY = params.get('k');

const ICON = '/pwa-192x192.png';
const BADGE = '/pwa-192x192.png';
const GENERIC = { title: 'Margube', body: 'Tienes una nueva notificación.' };

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/* Public RPCs authorized by the secret value they receive: there is no session in a worker */
function callRpc(name, body) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return Promise.resolve();
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

function withNotifId(url, id) {
  if (!id) return url;
  return `${url}${url.includes('?') ? '&' : '?'}notif=${encodeURIComponent(id)}`;
}

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* generic */ }

  event.waitUntil((async () => {
    const id = payload.notificationId;
    await self.registration.showNotification(GENERIC.title, {
      body: GENERIC.body,
      icon: ICON,
      badge: BADGE,
      tag: id ? `margube-${id}` : 'margube',
      renotify: false,
      timestamp: Date.now(),
      data: { url: payload.url || '/dashboard', id },
    });
    if (typeof payload.unread === 'number' && self.navigator?.setAppBadge) {
      await (payload.unread > 0 ? self.navigator.setAppBadge(payload.unread) : self.navigator.clearAppBadge()).catch(() => {});
    }
    // Reached this device: the only delivery the system can really verify
    if (payload.deliveryId) await callRpc('notif_ack_delivery', { p_delivery_id: payload.deliveryId });
  })());
});

/* Click: focus an open intranet tab or open a new one, on the right module */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url = '/dashboard', id } = event.notification.data || {};
  const target = withNotifId(url, id);

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = windows.find((c) => new URL(c.url).origin === self.location.origin);
    if (tab) {
      await tab.focus();
      tab.postMessage({ type: 'margube:navigate', url: target, id });
      return;
    }
    await self.clients.openWindow(target);
  })());
});

/* The browser renewed the subscription while no page was open */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const old = event.oldSubscription;
    const key = old?.options?.applicationServerKey;
    if (!old?.endpoint || !key) return; // the page re-registers it next time it opens
    const sub = event.newSubscription
      || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const { endpoint, keys } = sub.toJSON();
    await callRpc('notif_rotate_web_push', {
      p_old_endpoint: old.endpoint, p_new_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth,
    });
  })());
});
