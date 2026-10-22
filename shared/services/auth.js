// Passwords live in Supabase Auth and are only checked by the server
// (supabase/migrations/20261022120000_secure_auth.sql).

/** RRHH's temporary password; the client only uses it to refuse it as the person's own. */
export const FIRST_ACCESS_PASSWORD = 'margube2026';

/** Whether `profile` still has to replace its temporary password */
export function isFirstAccess(profile) {
  return profile?.first_login === true || profile?.first_login === 'true'
    || profile?.firstLogin === true || profile?.firstLogin === 'true';
}

/** Spanish message for a Supabase Auth error */
export function authErrorMessage(error) {
  const code = error?.code || '';
  const msg = error?.message || '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return 'Email o contraseña incorrectos.';
  }
  if (code === 'over_request_rate_limit' || /rate limit|too many/i.test(msg)) {
    return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
  }
  if (code === 'weak_password' || /password should be/i.test(msg)) {
    return 'La contraseña es demasiado débil. Usa al menos 8 caracteres.';
  }
  if (code === 'same_password') return 'La nueva contraseña debe ser distinta de la actual.';
  if (code === 'reauthentication_needed') return 'Por seguridad, vuelve a iniciar sesión y repite el cambio.';
  if (/failed to fetch|network/i.test(msg)) return 'Sin conexión con el servidor. Revisa tu red.';
  return msg || 'No se pudo completar la operación.';
}

/** @returns {Promise<{ ok: boolean, userId?: string, msg?: string }>} */
export async function signIn(supabase, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, msg: authErrorMessage(error) };
  return { ok: true, userId: data.user.id };
}

/** With `currentPassword` it is checked first (profile page); without it, first access. */
export async function changeOwnPassword(supabase, { email, currentPassword, newPassword }) {
  if (currentPassword != null) {
    // The login email is the session's; the profile's may differ in older accounts
    const { data: { session } } = await supabase.auth.getSession();
    const loginEmail = session?.user?.email || String(email || '').trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: currentPassword });
    if (error) {
      console.warn('[changeOwnPassword] check', error.code || '', error.message);
      return { error: error.code === 'invalid_credentials' || /invalid login/i.test(error.message || '')
        ? 'Contraseña actual incorrecta.'
        : authErrorMessage(error) };
    }
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) console.warn('[changeOwnPassword] update', error.code || '', error.message);
  return { error: error ? authErrorMessage(error) : null };
}

/** Creates the login first; the new profiles row must use the returned id. */
export async function createEmployeeAccount(supabase, email, password) {
  const { data, error } = await supabase.rpc('admin_create_account', { p_email: email, p_password: password });
  return error ? { error: error.message } : { id: data };
}

/** RRHH: give an employee a temporary password (forces a change on next login) */
export async function setEmployeePassword(supabase, userId, password) {
  const { error } = await supabase.rpc('admin_set_password', { p_user_id: userId, p_password: password });
  return { error: error ? error.message : null };
}
