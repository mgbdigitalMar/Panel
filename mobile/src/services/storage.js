// Small key/value store on top of the device keychain (expo-secure-store).
// Used for the session marker and user preferences; values are JSON.
import * as SecureStore from 'expo-secure-store';

export const KEYS = {
  session: 'margube_session',        // { id, lastActivity }
  themeMode: 'app_theme_mode',       // 'dark' | 'light' | 'system' (same values as web)
  biometric: 'margube_biometric',    // { enabled, userId, email }
  lastEmail: 'margube_last_email',
  pushToken: 'margube_push_token',
};

export async function getItem(key, fallback = null) {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function setItem(key, value) {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch (e) {
    console.warn('storage.setItem', key, e?.message);
  }
}

export async function removeItem(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // already gone
  }
}
