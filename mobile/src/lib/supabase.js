import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.warn('Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY (mobile/.env o eas.json).');
}

// The Supabase Auth session lives in the keychain. It is larger than the
// 2 KB SecureStore recommends per value, so it is split into chunks.
const CHUNK = 1800;
const keyOf = (key) => key.replace(/[^A-Za-z0-9._-]/g, '_');

const secureSessionStorage = {
  async getItem(key) {
    const k = keyOf(key);
    const count = Number(await SecureStore.getItemAsync(`${k}_n`));
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${k}_${i}`)));
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key, value) {
    const k = keyOf(key);
    await this.removeItem(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${k}_${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${k}_n`, String(count));
  },
  async removeItem(key) {
    const k = keyOf(key);
    const count = Number(await SecureStore.getItemAsync(`${k}_n`)) || 0;
    await Promise.all([
      SecureStore.deleteItemAsync(`${k}_n`),
      ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${k}_${i}`)),
    ]);
  },
};

// Same login as the web: Supabase Auth checks the password on the server.
export const supabase = createClient(supabaseUrl || 'https://invalid.supabase.co', supabaseKey || 'missing', {
  auth: {
    storage: secureSessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 20 },
    heartbeatIntervalMs: 15000,
    timeout: 10000,
  },
});
