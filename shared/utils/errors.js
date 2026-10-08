/**
 * User-facing error handling — shared by WEB and APP.
 *
 * Technical details (Postgres codes, "Network request failed", stack traces)
 * are logged for debugging but never shown to end users.
 */

/** An error whose message was written for end users and can be shown as is. */
export class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserFacingError';
    this.userFacing = true;
  }
}

export const ERROR_MESSAGES = {
  network: 'No se ha podido completar la operación. Comprueba tu conexión e inténtalo de nuevo.',
  session: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  permission: 'No tienes permisos para realizar esta acción.',
  duplicate: 'Este registro ya existe.',
  invalid: 'Hay datos no válidos. Revisa el formulario e inténtalo de nuevo.',
  server: 'El servidor no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
  generic: 'No se ha podido completar la operación. Inténtalo de nuevo.',
};

const NETWORK_PATTERNS = [/network request failed/i, /failed to fetch/i, /networkerror/i, /timeout/i, /load failed/i];

/** Classify any thrown value or Supabase `{ error }` into a stable category. */
export function classifyError(err) {
  if (!err) return 'generic';
  if (err.userFacing) return 'user';
  const msg = String(err.message || err);
  const code = String(err.code || '');
  const status = Number(err.status || 0);

  if (NETWORK_PATTERNS.some((re) => re.test(msg))) return 'network';
  if (status === 401 || code === 'PGRST301' || /jwt/i.test(msg)) return 'session';
  if (status === 403 || code === '42501' || /row-level security|permission denied/i.test(msg)) return 'permission';
  if (code === '23505') return 'duplicate';
  if (code.startsWith('22') || code.startsWith('23')) return 'invalid';
  if (status >= 500) return 'server';
  return 'generic';
}

/** Message safe to show to an end user. */
export function toUserMessage(err, fallback = ERROR_MESSAGES.generic) {
  const kind = classifyError(err);
  if (kind === 'user') return err.message;
  return ERROR_MESSAGES[kind] || fallback;
}

/** Internal log for debugging. Never pass its output to the UI. */
export function logError(context, err) {
  // eslint-disable-next-line no-console
  console.warn(`[${context}]`, err?.code || '', err?.message || err);
}
