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
 * Shared temporary password. It only opens accounts that are still on their
 * first access (`first_login = true`); the person must then set their own.
 */
export const FIRST_ACCESS_PASSWORD = 'margube2026';

const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(value);

/** Whether `profile` may sign in with FIRST_ACCESS_PASSWORD */
export function isFirstAccess(profile) {
  return profile?.first_login === true || profile?.first_login === 'true'
    || profile?.firstLogin === true || profile?.firstLogin === 'true';
}

/**
 * Verify password against stored hash.
 * @param {string} password - Plain text password
 * @param {string|null} passwordHash - Stored bcrypt hash
 * @param {object} bcryptModule - bcrypt-compatible module with compareSync()
 * @returns {boolean}
 */
export function verifyPassword(password, passwordHash, bcryptModule) {
  if (!passwordHash) return false;

  // Plaintext comparison only for values that are not a bcrypt hash (set by
  // hand in the DB). Comparing against a real hash would let anyone who can
  // read the hash sign in by typing the hash itself.
  if (!isBcryptHash(passwordHash)) return password === passwordHash;

  try {
    return bcryptModule.compareSync(password, passwordHash);
  } catch (e) {
    return false;
  }
}

/**
 * Async variant of verifyPassword. bcrypt at cost 10 takes ~1 s in pure JS,
 * so React Native uses this to keep the UI thread responsive.
 * @param {object} bcryptModule - bcrypt-compatible module with compare()
 * @returns {Promise<boolean>}
 */
export async function verifyPasswordAsync(password, passwordHash, bcryptModule) {
  if (!passwordHash) return false;

  // See verifyPassword: never compare a bcrypt hash as plaintext
  if (!isBcryptHash(passwordHash)) return password === passwordHash;

  try {
    return await bcryptModule.compare(password, passwordHash);
  } catch (e) {
    return false;
  }
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
