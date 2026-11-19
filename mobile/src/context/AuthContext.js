// Same login as the web (Supabase Auth, session in the keychain). Unlike the web, inactivity
// locks the session instead of logging out, and with biometrics on, logout keeps the session
// so the fingerprint or face can reopen it.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { mapProfile, fetchDnis, withDni } from '@shared/services/profiles.js';
import { signIn, changeOwnPassword, FIRST_ACCESS_PASSWORD } from '@shared/services/auth.js';
import { IDLE_TIMEOUT_MOBILE } from '@shared/config/constants.js';
import { toUserMessage, logError } from '@shared/utils/errors.js';
import { supabase } from '../lib/supabase';
import { getItem, setItem, removeItem, KEYS } from '../services/storage';
import { authenticate } from '../services/biometrics';
import { registerForPushNotificationsAsync, unregisterPushNotificationsAsync, setBadgeCount } from '../services/pushNotifications';
import { prefetchLists, clearPrefetch } from './bootPrefetch';

const AuthCtx = createContext(null);

export const PROFILE_COLUMNS = 'id,name,email,role,department,phone,position,avatar_initials,avatar_url,birthdate,join_date,work_mode,first_login,policy_accepted,telework_days,telework_applied_on';

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
  // Saved with the session so the next launch can ask for its lists before the profile arrives
  const roleRef = useRef(null);
  const lastPersisted = useRef(0);
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const persistSession = useCallback(async (id, force = false) => {
    const now = Date.now();
    if (!force && now - lastPersisted.current < 30000) return;
    lastPersisted.current = now;
    await setItem(KEYS.session, { id, role: roleRef.current, lastActivity: lastActivity.current });
  }, []);

  const touch = useCallback(() => {
    lastActivity.current = Date.now();
    if (userRef.current) persistSession(userRef.current.id);
  }, [persistSession]);

  const loadEmployees = useCallback(async () => {
    const [{ data, error }, dnis] = await Promise.all([
      supabase.from('profiles').select(PROFILE_COLUMNS).order('name'),
      fetchDnis(supabase),
    ]);
    if (error) {
      logError('loadEmployees', error);
      return null;
    }
    // The DNI is private (profile_private): admins get everyone's, employees their own
    const list = withDni(data.map(mapProfile), dnis);
    setEmployees(list);
    return list;
  }, []);

  // Profile and DNI together: one round trip to Supabase instead of two in a row
  const fetchProfile = useCallback(async (id) => {
    const [{ data, error }, dnis] = await Promise.all([
      supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle(),
      fetchDnis(supabase),
    ]);
    if (error) throw error;
    if (!data) return null;
    const [profile] = withDni([mapProfile(data)], dnis);
    return profile;
  }, []);

  // The profile, with the lists the first screen needs asked for at the same time (bootPrefetch)
  const fetchProfileAndLists = useCallback((id, roleGuess) => {
    const profile = fetchProfile(id);
    prefetchLists(id, roleGuess || profile.then((p) => p?.role));
    return profile;
  }, [fetchProfile]);

  // "Recordarme" on the login: keep the email for next time, or forget it
  const rememberEmail = useRef(true);

  const startSession = useCallback(async (profile) => {
    roleRef.current = profile.role;
    lastActivity.current = Date.now();
    setUser(profile);
    setLocked(false);
    await persistSession(profile.id, true);
    if (rememberEmail.current) {
      await setItem(KEYS.lastEmail, profile.email);
      setLastEmail(profile.email);
    } else {
      await removeItem(KEYS.lastEmail);
      setLastEmail('');
    }
    loadEmployees();
    registerForPushNotificationsAsync(profile.id);
  }, [loadEmployees, persistSession]);

  const clearSession = useCallback(async () => {
    clearPrefetch();
    await removeItem(KEYS.session);
    setUser(null);
    setEmployees([]);
    setLocked(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // The keychain and storage reads do not depend on each other
        const [session, bio, email, auth] = await Promise.all([
          getItem(KEYS.session),
          getItem(KEYS.biometric, { enabled: false }),
          getItem(KEYS.lastEmail, ''),
          supabase.auth.getSession().then(({ data }) => data.session),
        ]);
        setBiometric(bio || { enabled: false });
        setLastEmail(email || '');
        if (session?.id && auth?.user?.id === session.id) {
          const profile = await fetchProfileAndLists(session.id, session.role);
          if (profile) {
            roleRef.current = profile.role;
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
  }, [fetchProfileAndLists, loadEmployees]);

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
          // profiles.phone no longer carries the DNI: keep the one already loaded
          setUser((prev) => (prev ? { ...prev, ...mapProfile(payload.new), phone: mapProfile(payload.new).phone || prev.phone } : prev));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadEmployees, clearSession]);

  const login = useCallback(async (emailInput, pass, { remember = true } = {}) => {
    const email = String(emailInput || '').trim();
    rememberEmail.current = remember;
    if (!email || !pass) return { ok: false, msg: 'Introduce tu correo y tu contraseña.' };
    try {
      // First access with the temporary password: the navigator then forces
      // the user to set a personal one (first_login).
      const res = await signIn(supabase, email, pass);
      if (!res.ok) return res;
      const profile = await fetchProfileAndLists(res.userId);
      if (!profile) {
        clearPrefetch();
        await supabase.auth.signOut({ scope: 'local' });
        return { ok: false, msg: 'Tu cuenta no tiene ficha de empleado. Contacta con RRHH.' };
      }
      await startSession(profile);
      return { ok: true };
    } catch (e) {
      logError('login', e);
      return { ok: false, msg: toUserMessage(e) };
    }
  }, [fetchProfileAndLists, startSession]);

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
      const profile = await fetchProfileAndLists(biometric.userId);
      if (!profile) {
        clearPrefetch();
        return { ok: false, msg: 'Tu cuenta ya no está disponible. Entra con tu contraseña.' };
      }
      await startSession(profile);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: toUserMessage(e) };
    }
  }, [biometric, fetchProfileAndLists, startSession]);

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

  /** Profile flow: the current password is checked first. */
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
