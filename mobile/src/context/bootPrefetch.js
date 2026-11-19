// Opening the app or signing in, the lists are asked for together with the person's profile
// (AuthContext) instead of after the first screen has been drawn (DataContext): the dashboard
// waits one round trip to Supabase less. DataContext takes each list once; anything later (pull to
// refresh, back from background, realtime) asks the database again. Same idea as the web
// (src/context/index.jsx, startBootPrefetch).
import * as svc from '@shared/services/index.js';
import { supabase } from '../lib/supabase';

// A prefetch older than this is not used: the person may have sat on the lock screen
const TTL = 20 * 1000;

const scopeFor = (user) => (user.role === 'admin' ? {} : { employeeId: user.id });

const LISTS = {
  requests: (user) => svc.fetchRequests(supabase, scopeFor(user)),
  reservations: () => svc.fetchReservations(supabase),
  rooms: () => svc.fetchRooms(supabase),
  vehicles: () => svc.fetchVehicles(supabase),
  documents: () => svc.fetchDocuments(supabase),
  hours: () => svc.fetchHourCompensations(supabase),
  personalDays: (user) => svc.fetchPersonalDays(supabase, scopeFor(user)),
  news: () => svc.fetchNews(supabase),
  notifications: (user) => Promise.all([svc.fetchNotifications(supabase, user.id), svc.fetchUnreadCount(supabase, user.id)]),
};
// What these return depends on the person's role
const ROLE_BOUND = new Set(['requests', 'personalDays']);

let boot = null; // { userId, at, lists: { name: Promise<{ data, role? } | null> } }

/** `role` may be a promise (it arrives with the profile) */
export function prefetchLists(userId, role) {
  const roleReady = Promise.resolve(role).catch(() => null);
  const lists = {};
  for (const [name, load] of Object.entries(LISTS)) {
    const pending = ROLE_BOUND.has(name)
      ? roleReady.then((r) => (r ? load({ id: userId, role: r }).then((data) => ({ data, role: r })) : null))
      : load({ id: userId }).then((data) => ({ data }));
    // A prefetch that throws is simply asked for again by DataContext
    lists[name] = pending.catch(() => null);
  }
  boot = { userId, at: Date.now(), lists };
}

/** The prefetched result of `name` for `user`, once; null when there is nothing to take */
export function takePrefetched(name, user) {
  if (!boot || !user?.id || boot.userId !== user.id || Date.now() - boot.at > TTL) return null;
  const pending = boot.lists[name];
  if (!pending) return null;
  delete boot.lists[name];
  // undefined = ask again (the prefetch threw, or the role turned out different)
  return pending.then((res) => (res && (!res.role || res.role === user.role) ? res.data : undefined));
}

export function clearPrefetch() {
  boot = null;
}
