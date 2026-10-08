/**
 * Auth service — platform-agnostic.
 * Handles login validation against the profiles table using bcrypt.
 * 
 * Note: This intentionally receives `bcryptModule` as a parameter
 * so both web (bcryptjs) and mobile (expo-crypto) can provide their
 * own implementation.
 */
import { mapProfile } from './profiles.js';

/**
 * Verify password against stored hash.
 * @param {string} password - Plain text password
 * @param {string|null} passwordHash - Stored bcrypt hash
 * @param {object} bcryptModule - bcrypt-compatible module with compareSync()
 * @returns {boolean}
 */
export function verifyPassword(password, passwordHash, bcryptModule) {
  if (!passwordHash) return false;

  try {
    if (bcryptModule.compareSync(password, passwordHash)) {
      return true;
    }
  } catch (e) {
    // Invalid hash format
  }

  // Fallback: plaintext comparison (for manually-set passwords in DB)
  if (password === passwordHash) {
    return true;
  }

  return false;
}

/**
 * Async variant of verifyPassword. bcrypt at cost 10 takes ~1 s in pure JS,
 * so React Native uses this to keep the UI thread responsive.
 * @param {object} bcryptModule - bcrypt-compatible module with compare()
 * @returns {Promise<boolean>}
 */
export async function verifyPasswordAsync(password, passwordHash, bcryptModule) {
  if (!passwordHash) return false;

  try {
    if (await bcryptModule.compare(password, passwordHash)) {
      return true;
    }
  } catch (e) {
    // Invalid hash format
  }

  // Fallback: plaintext comparison (for manually-set passwords in DB)
  return password === passwordHash;
}

/**
 * Login flow — query profiles by email + verify password.
 * @param {object} supabase - Supabase client
 * @param {string} email
 * @param {string} password
 * @param {object} bcryptModule - bcrypt-compatible module
 * @returns {{ ok: boolean, user?: object, msg?: string }}
 */
export async function loginWithCredentials(supabase, email, password, bcryptModule) {
  const { data: profileRow, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !profileRow) {
    return {
      ok: false,
      msg: `No se pudo obtener el perfil: ${error?.message || 'Perfil no encontrado'}`,
    };
  }

  const isValid = verifyPassword(password, profileRow.password_hash, bcryptModule);

  if (!isValid) {
    if (!profileRow.password_hash) {
      return {
        ok: false,
        msg: 'Primera vez: Configura tu contraseña en "Cambiar contraseña". (password_hash null)',
      };
    }
    return {
      ok: false,
      msg: 'Email o contraseña incorrectos. Verifica mayúsculas/números especiales.',
    };
  }

  const user = mapProfile(profileRow);
  return { ok: true, user };
}
