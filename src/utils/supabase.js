import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Missing env must not crash the bundle: main.jsx shows a setup screen instead
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = createClient(supabaseUrl || 'https://not-configured.supabase.co', supabaseKey || 'not-configured', {
  // Supabase Auth session, shared by the tabs of this browser (AuthProvider
  // still logs it out after a minute without activity)
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    // Heartbeats run in a Web Worker: browsers throttle timers in hidden tabs,
    // which used to drop the socket after a few minutes in the background.
    worker: true,
    params: {
      eventsPerSecond: 20,
    },
    heartbeatIntervalMs: 15000,
    timeout: 10000,
  },
});
