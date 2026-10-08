// Push notifications. The backend (supabase/migrations/…_push_notifications.sql +
// functions/send-push) sends a generic push whenever a row lands in `notifications`;
// this module registers the device token and turns taps into navigation.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { supabase } from '../lib/supabase';
import { getItem, setItem, removeItem, KEYS } from './storage';

// Must match channelId in supabase/functions/send-push.
export const ANDROID_CHANNEL_ID = 'default';

export const isExpoGo = isRunningInExpoGo();
export const isAndroidExpoGo = Platform.OS === 'android' && isExpoGo;

// Expo SDK 53+ removed remote push notifications from Expo Go on Android.
// Trying to load expo-notifications in Expo Go on Android throws a fatal error
// at module evaluation time. We guard the require so Expo Go doesn't crash,
// while development builds and standalone builds keep full push functionality.
let NativeNotifications = null;
if (!isAndroidExpoGo) {
  try {
    NativeNotifications = require('expo-notifications');
  } catch (err) {
    if (__DEV__) {
      console.warn('[pushNotifications] Failed to load expo-notifications:', err?.message);
    }
  }
}

// Fallback stub for Expo Go on Android or when native module is unavailable
const mockNotifications = {
  AndroidImportance: {
    UNKNOWN: 0,
    UNSPECIFIED: 0,
    NONE: 1,
    MIN: 2,
    LOW: 3,
    DEFAULT: 4,
    HIGH: 5,
    MAX: 5,
  },
  AndroidNotificationVisibility: {
    UNKNOWN: 0,
    PUBLIC: 1,
    PRIVATE: 0,
    SECRET: -1,
  },
  setNotificationHandler: () => {},
  setNotificationChannelAsync: async () => null,
  getPermissionsAsync: async () => ({
    status: 'undetermined',
    granted: false,
    canAskAgain: false,
    expires: 'never',
  }),
  requestPermissionsAsync: async () => ({
    status: 'denied',
    granted: false,
    canAskAgain: false,
    expires: 'never',
  }),
  getExpoPushTokenAsync: async () => {
    throw new Error('Push notifications require a development build in SDK 53+ (unsupported in Expo Go on Android).');
  },
  setBadgeCountAsync: async () => false,
  getLastNotificationResponse: () => null,
  getLastNotificationResponseAsync: async () => null,
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  addNotificationReceivedListener: () => ({ remove: () => {} }),
  removeNotificationSubscription: () => {},
  dismissNotificationAsync: async () => {},
  dismissAllNotificationsAsync: async () => {},
};

const fallbackNotifications = new Proxy(mockNotifications, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    return () => {};
  },
});

export const Notifications = NativeNotifications || fallbackNotifications;

// While the app is open, realtime + in-app toasts already show the event,
// so the OS banner is suppressed to avoid duplicates (see ARQUITECTURA §10).
if (NativeNotifications) {
  NativeNotifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android' || !NativeNotifications) return;
  await NativeNotifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Avisos de la intranet',
    importance: NativeNotifications.AndroidImportance.HIGH,
    lockscreenVisibility: NativeNotifications.AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#2954FB',
  });
}

/**
 * Ask for permission, get the Expo push token and store it in Supabase.
 * Never throws: push is optional and the rest of the app must keep working
 * (no EAS project id yet, migration not deployed, emulator, permission denied…).
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function registerForPushNotificationsAsync(userId) {
  try {
    if (isAndroidExpoGo || !NativeNotifications) {
      if (__DEV__) {
        console.log('[pushNotifications] Android push notifications are disabled in Expo Go (SDK 53+). Use a development build to test push.');
      }
      return { ok: false, reason: 'expo-go' };
    }

    await ensureChannel();
    if (!Device.isDevice) return { ok: false, reason: 'emulator' };

    let { status } = await NativeNotifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await NativeNotifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return { ok: false, reason: 'no-project-id' };

    const { data: token } = await NativeNotifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', {
      p_user_id: userId,
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) {
      console.warn('register_push_token:', error.message);
      return { ok: false, reason: 'backend' };
    }
    await setItem(KEYS.pushToken, token);
    return { ok: true };
  } catch (e) {
    console.warn('registerForPushNotificationsAsync:', e?.message);
    return { ok: false, reason: 'error' };
  }
}

/** Called on logout so this device stops receiving the user's pushes. */
export async function unregisterPushNotificationsAsync() {
  const token = await getItem(KEYS.pushToken);
  if (!token) return;
  try {
    await supabase.rpc('unregister_push_token', { p_token: token });
  } catch {
    // offline: the backend drops stale tokens on its own
  }
  await removeItem(KEYS.pushToken);
}

export async function setBadgeCount(n) {
  if (!NativeNotifications) return;
  try {
    await NativeNotifications.setBadgeCountAsync(Math.max(0, n || 0));
  } catch {
    // launcher without badge support
  }
}

/** Extracts the notification id from a tapped push (data.notificationId or margube:// url). */
export function notificationIdFromResponse(response) {
  const data = response?.notification?.request?.content?.data || {};
  const id = data.notificationId ?? data.notification_id;
  if (id) return String(id);
  const url = data.url || '';
  const m = String(url).match(/notificaciones\/([^/?#]+)/);
  return m ? m[1] : null;
}
