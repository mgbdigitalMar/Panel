// Authentication, session and idle lock for the app.
// Login uses the same model as the web AuthProvider: Supabase Auth checks the
// email and password on the server and the session is kept in the keychain
// (lib/supabase.js). Differences, on purpose:
//   * inactivity pauses the session (IDLE_TIMEOUT_MOBILE, 30 min) instead of
//     logging out, and it can be resumed with biometrics or the password;
//   * with biometrics on, logging out keeps the Supabase session on the device
//     so the fingerprint / face can open it again without the password.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { mapProfile } from '@shared/services/profiles.js';
import { signIn, changeOwnPassword, FIRST_ACCESS_PASSWORD } from '@shared/services/auth.js';
import { IDLE_TIMEOUT_MOBILE } from '@shared/config/constants.js';
import { toUserMessage, logError } from '@shared/utils/errors.js';
import { supabase } from '../lib/supabase';
import { getItem, setItem, removeItem, KEYS } from '../services/storage';
import { authenticate } from '../services/biometrics';
import { registerForPushNotificationsAsync, unregisterPushNotificationsAsync, setBadgeCount } from '../services/pushNotifications';

const AuthCtx = createContext(null);

export const PROFILE_COLUMNS = 'id,name,email,role,department,phone,position,avatar_initials,avatar_url,birthdate,join_date,work_mode,first_login,policy_accepted,telework_days,telework_applied_on';

/** Temporary password valid for any account until its first password change. */
export { FIRST_ACCESS_PASSWORD };

const isFirstLogin = (u) => u?.firstLogin === true || u?.firstLogin === 'true';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometric, setBiometric] = useState({ enabled: false });
  const [lastEmail, setLastEmail] = useState('');

  const lastActivity = useRef(0);
  const lastPersisted = useRef(0);
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // ── helpers ─────────────────────────────────────────────────────
  const persistSession = useCallback(async (id, force = false) => {
    const now = Date.now();
    if (!force && now - lastPersisted.current < 30000) return;
    lastPersisted.current = now;
    await setItem(KEYS.session, { id, lastActivity: lastActivity.current });
  }, []);

  const touch = useCallback(() => {
    lastActivity.current = Date.now();
    if (userRef.current) persistSession(userRef.current.id);
  }, [persistSession]);

  const loadEmployees = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).order('name');
    if (error) {
      logError('loadEmployees', error);
      return null;
    }
    const list = data.map(mapProfile);
    setEmployees(list);
    return list;
  }, []);

  const fetchProfile = useCallback(async (id) => {
    const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapProfile(data) : null;
  }, []);

  const startSession = useCallback(async (profile) => {
    lastActivity.current = Date.now();
    setUser(profile);
    setLocked(false);
    await persistSession(profile.id, true);
    await setItem(KEYS.lastEmail, profile.email);
    setLastEmail(profile.email);
    loadEmployees();
    registerForPushNotificationsAsync(profile.id);
  }, [loadEmployees, persistSession]);

  const clearSession = useCallback(async () => {
    await removeItem(KEYS.session);
    setUser(null);
    setEmployees([]);
    setLocked(false);
  }, []);

  // ── restore on launch ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [session, bio, email] = await Promise.all([
          getItem(KEYS.session),
          getItem(KEYS.biometric, { enabled: false }),
          getItem(KEYS.lastEmail, ''),
        ]);
        setBiometric(bio || { enabled: false });
        setLastEmail(email || '');
        const { data: { session: auth } } = await supabase.auth.getSession();
        if (session?.id && auth?.user?.id === session.id) {
          const profile = await fetchProfile(session.id);
          if (profile) {
            lastActivity.current = session.lastActivity || Date.now();
            setUser(profile);
            setLocked(Date.now() - lastActivity.current > IDLE_TIMEOUT_MOBILE);
            loadEmployees();
            registerForPushNotificationsAsync(profile.id);
          } else {
            await removeItem(KEYS.session);
          }
        }
      } catch (e) {
        // Offline at launch: keep the stored session and let the user retry from the login screen.
        logError('restoreSession', e);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [fetchProfile, loadEmployees]);

  // ── idle lock ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user || locked) return undefined;
    const interval = setInterval(() => {
      if (AppState.currentState === 'active' && Date.now() - lastActivity.current > IDLE_TIMEOUT_MOBILE) {
        setLocked(true);
      }
    }, 15000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
      if (state === 'active') {
        if (Date.now() - lastActivity.current > IDLE_TIMEOUT_MOBILE) setLocked(true);
        // Permission may have been granted from system settings meanwhile,
        // or the token rotated: re-registering is idempotent on the backend.
        if (userRef.current) registerForPushNotificationsAsync(userRef.current.id);
      } else if (userRef.current) {
        persistSession(userRef.current.id, true);
      }
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [user, locked, persistSession]);

  // ── profiles realtime (same channel as the web) ────────────────
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel('realtime-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        loadEmployees();
        const me = userRef.current;
        if (!me) return;
        if (payload.eventType === 'DELETE' && payload.old?.id === me.id) {
          supabase.auth.signOut({ scope: 'local' });
          clearSession();
        } else if (payload.new?.id === me.id) {
          setUser((prev) => (prev ? { ...prev, ...mapProfile(payload.new) } : prev));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadEmployees, clearSession]);

  // ── actions ────────────────────────────────────────────────────
  const login = useCallback(async (emailInput, pass) => {
    const email = String(emailInput || '').trim();
    if (!email || !pass) return { ok: false, msg: 'Introduce tu correo y tu contraseña.' };
    try {
      // First access with the temporary password: the navigator then forces
      // the user to set a personal one (first_login).
      const res = await signIn(supabase, email, pass);
      if (!res.ok) return res;
      const profile = await fetchProfile(res.userId);
      if (!profile) {
        await supabase.auth.signOut({ scope: 'local' });
        return { ok: false, msg: 'Tu cuenta no tiene ficha de empleado. Contacta con RRHH.' };
      }
      await startSession(profile);
      return { ok: true };
    } catch (e) {
      logError('login', e);
      return { ok: false, msg: toUserMessage(e) };
    }
  }, [fetchProfile, startSession]);

  const loginWithBiometrics = useCallback(async () => {
    if (!biometric.enabled || !biometric.userId) return { ok: false };
    const ok = await authenticate('Entrar en Margube');
    if (!ok) return { ok: false };
    try {
      // Reopens the session kept on the device at logout
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id !== biometric.userId) {
        return { ok: false, msg: 'Tu sesión ha caducado. Entra con tu contraseña.' };
      }
      const profile = await fetchProfile(biometric.userId);
      if (!profile) return { ok: false, msg: 'Tu cuenta ya no está disponible. Entra con tu contraseña.' };
      await startSession(profile);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: toUserMessage(e) };
    }
  }, [biometric, fetchProfile, startSession]);

  const unlockWithBiometrics = useCallback(async () => {
    const ok = await authenticate('Desbloquear Margube');
    if (ok) {
      lastActivity.current = Date.now();
      setLocked(false);
      if (userRef.current) persistSession(userRef.current.id, true);
    }
    return ok;
  }, [persistSession]);

  const unlockWithPassword = useCallback(async (pass) => {
    const me = userRef.current;
    if (!me) return { ok: false };
    try {
      const res = await signIn(supabase, me.email, pass);
      if (!res.ok) return { ok: false, msg: res.msg === 'Email o contraseña incorrectos.' ? 'Contraseña incorrecta.' : res.msg };
      lastActivity.current = Date.now();
      setLocked(false);
      persistSession(me.id, true);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: toUserMessage(e) };
    }
  }, [persistSession]);

  const logout = useCallback(async () => {
    await unregisterPushNotificationsAsync();
    await setBadgeCount(0);
    // Biometrics on: keep the session so the fingerprint / face can reopen it
    if (!biometric.enabled) await supabase.auth.signOut({ scope: 'local' });
    await clearSession();
  }, [clearSession, biometric.enabled]);

  /** Same contract as the web setCurrentUser: persists firstLogin / workMode / policyAccepted. */
  const setCurrentUser = useCallback(async (updates) => {
    const me = userRef.current;
    if (!me) return { error: null };
    const db = {};
    if (updates.firstLogin === false) db.first_login = false;
    if (updates.workMode) db.work_mode = updates.workMode;
    if (updates.policyAccepted === true) db.policy_accepted = true;
    if (Object.keys(db).length) {
      const { error } = await supabase.from('profiles').update(db).eq('id', me.id);
      if (error) return { error };
    }
    setUser((prev) => (prev ? { ...prev, ...updates, id: prev.id } : prev));
    loadEmployees();
    return { error: null };
  }, [loadEmployees]);

  /** First-access flow (ChangePasswordPage on the web). */
  const setNewPassword = useCallback(async (newPass) => {
    const me = userRef.current;
    const { error: passErr } = await changeOwnPassword(supabase, { newPassword: newPass });
    if (passErr) return { error: { userFacing: true, message: passErr } };
    const { error } = await supabase.from('profiles').update({ first_login: false }).eq('id', me.id);
    if (error) return { error };
    const { data: check } = await supabase.from('profiles').select('first_login').eq('id', me.id).single();
    if (!check || check.first_login !== false) {
      return { error: new Error('La actualización no se ha guardado. Inténtalo de nuevo.') };
    }
    setUser((prev) => ({ ...prev, firstLogin: false }));
    loadEmployees();
    return { error: null };
  }, [loadEmployees]);

  /** Profile flow: verify the current password, then store the new hash. */
  const changePassword = useCallback(async (current, next) => {
    const me = userRef.current;
    const { error } = await changeOwnPassword(supabase, { email: me.email, currentPassword: current, newPassword: next });
    return { error: error ? { userFacing: true, message: error } : null };
  }, []);

  const setBiometricEnabled = useCallback(async (enabled) => {
    const me = userRef.current;
    const next = enabled && me ? { enabled: true, userId: me.id, email: me.email, name: me.name } : { enabled: false };
    await setItem(KEYS.biometric, next);
    setBiometric(next);
  }, []);

  const value = useMemo(() => ({
    user,
    employees,
    authLoading,
    locked,
    biometric,
    lastEmail,
    needsPasswordChange: isFirstLogin(user),
    needsPolicy: !!user && !isFirstLogin(user) && user.policyAccepted !== true,
    login,
    loginWithBiometrics,
    unlockWithBiometrics,
    unlockWithPassword,
    logout,
    touch,
    setCurrentUser,
    setNewPassword,
    changePassword,
    setBiometricEnabled,
    refreshEmployees: loadEmployees,
    setEmployees,
    setUser,
  }), [user, employees, authLoading, locked, biometric, lastEmail, login, loginWithBiometrics, unlockWithBiometrics,
    unlockWithPassword, logout, touch, setCurrentUser, setNewPassword, changePassword, setBiometricEnabled, loadEmployees]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
