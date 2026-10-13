/**
 * Web notifications for the intranet.
 *
 * Two layers, both delivered by public/push-sw.js:
 *  1. Tab open (even hidden/minimised): the page shows a system notification
 *     through the service worker registration — works on desktop and Android,
 *     and a click brings the intranet back to the right page.
 *  2. Tab closed: Web Push. The browser subscription is stored in Supabase
 *     (web_push_subscriptions) and the `send-push` Edge Function delivers it.
 *
 * Preferences live in localStorage, shared with the Ajustes page.
 */
import { supabase } from '../utils/supabase';

const SW_URL = '/push-sw.js';
const SW_SCOPE = '/push/';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const PREF_NOTIFS = 'margube-browser-notifs';
export const PREF_SOUNDS = 'margube-sounds';

export function readPref(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

export const pushSupported = () =>
  notificationsSupported() && 'PushManager' in window && Boolean(VAPID_PUBLIC_KEY);

let registrationPromise = null;

/** Registers (once) the notification service worker. */
export function getRegistration() {
  if (!notificationsSupported()) return Promise.resolve(null);
  if (!registrationPromise) {
    const qs = new URLSearchParams({
      u: import.meta.env.VITE_SUPABASE_URL || '',
      k: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    });
    registrationPromise = navigator.serviceWorker
      .register(`${SW_URL}?${qs}`, { scope: SW_SCOPE })
      .then(async (reg) => {
        // Wait until it can actually show notifications
        if (!reg.active) {
          await new Promise((resolve) => {
            const sw = reg.installing || reg.waiting;
            if (!sw) return resolve();
            sw.addEventListener('statechange', () => sw.state === 'activated' && resolve());
          });
        }
        return reg;
      })
      .catch((err) => {
        console.warn('No se pudo registrar el service worker de notificaciones:', err);
        registrationPromise = null;
        return null;
      });
  }
  return registrationPromise;
}

/** True when the person wants notifications and the browser allows them. */
export function notificationsEnabled() {
  return notificationsSupported() && Notification.permission === 'granted' && readPref(PREF_NOTIFS, false);
}

/**
 * Shows a system notification for a row of `notifications` (or any alert).
 * Same tag as the Web Push path, so it never shows twice.
 */
export async function showSystemNotification({ id, title, body, entityType }) {
  if (!notificationsEnabled()) return;
  const routes = { request: '/requests', document: '/profile', hour_compensation: '/horas', reservation: '/reservations' };
  const options = {
    body: body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: id ? `margube-${id}` : `margube-${Date.now()}`,
    renotify: false,
    data: { url: routes[entityType] || '/dashboard', id },
  };
  const reg = await getRegistration();
  if (reg) {
    await reg.showNotification(title || 'Margube Intranet', options).catch(() => {});
    return;
  }
  // Very old browsers without service workers
  try {
    const n = new Notification(title || 'Margube Intranet', options);
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* Android Chrome forbids the constructor */ }
}

/** Notification click → the SW asks this tab to open the right page. */
export function listenForNotificationClicks(navigate) {
  if (!notificationsSupported()) return () => {};
  const onMessage = (event) => {
    if (event.data?.type === 'margube:navigate' && event.data.url) navigate(event.data.url);
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  navigator.serviceWorker.startMessages?.();
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Subscribes this browser to Web Push and links it to `userId`.
 * Returns 'push' when closed-tab delivery is active, 'local' when only the
 * open-tab layer works (no VAPID key or server not set up yet).
 */
export async function enablePush(userId) {
  if (!userId || !pushSupported()) return 'local';
  const reg = await getRegistration();
  if (!reg) return 'local';
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const { endpoint, keys } = sub.toJSON();
    const { error } = await supabase.rpc('register_web_push', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_p256dh: keys.p256dh,
      p_auth: keys.auth,
      p_user_agent: navigator.userAgent.slice(0, 200),
    });
    if (error) {
      console.warn('Web Push: el servidor aún no está configurado (ejecuta la migración web_push).', error.message);
      return 'local';
    }
    return 'push';
  } catch (err) {
    console.warn('Web Push: no se pudo suscribir este navegador.', err);
    return 'local';
  }
}

/**
 * Stops Web Push for this browser. `keepBrowserSubscription` is used on
 * logout: the server row goes away (no pushes for the old user) but the
 * browser keeps permission for the next person who signs in.
 */
export async function disablePush({ keepBrowserSubscription = false } = {}) {
  const reg = await getRegistration();
  const sub = await reg?.pushManager?.getSubscription().catch(() => null);
  if (!sub) return;
  try {
    // Supabase reports failures in { error } rather than throwing
    await supabase.rpc('unregister_web_push', { p_endpoint: sub.endpoint });
  } catch { /* offline — the Edge Function prunes dead endpoints anyway */ }
  if (!keepBrowserSubscription) await sub.unsubscribe().catch(() => {});
}

/** Short notification blip, honouring the Sonidos preference. */
export function playNotificationSound() {
  if (!readPref(PREF_SOUNDS, true)) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch { /* audio blocked until the first interaction */ }
}
