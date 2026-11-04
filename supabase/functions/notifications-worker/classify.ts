// Qué hacer con cada respuesta de un proveedor. Sin dependencias, para poder probarlo con Node.

export type Outcome = 'accepted' | 'retry' | 'invalid' | 'failed';

export type Classified = {
  outcome: Outcome;
  code?: string;
  /** Las credenciales del proyecto están mal: es un problema general, no de este dispositivo. */
  config?: boolean;
};

const EXPO_ERRORS: Record<string, Classified> = {
  DeviceNotRegistered: { outcome: 'invalid', code: 'DeviceNotRegistered' },
  MessageTooBig: { outcome: 'failed', code: 'MessageTooBig' },
  MessageRateExceeded: { outcome: 'retry', code: 'MessageRateExceeded' },
  // Se reintenta: en cuanto se arreglen las credenciales, los avisos pendientes salen solos
  InvalidCredentials: { outcome: 'retry', code: 'InvalidCredentials', config: true },
  MismatchSenderId: { outcome: 'retry', code: 'MismatchSenderId', config: true },
};

/** Ticket o recibo de Expo con status "error". */
export function classifyExpoError(code?: string): Classified {
  // Un error que Expo añada en el futuro no debe perder el aviso de golpe
  return (code && EXPO_ERRORS[code]) || { outcome: 'retry', code: code || 'ExpoUnknownError' };
}

/** Respuesta HTTP de la petición completa a Expo. */
export function classifyExpoHttp(status: number): Classified {
  if (status === 401 || status === 403) return { outcome: 'retry', code: `http_${status}`, config: true };
  if (status === 429 || status >= 500) return { outcome: 'retry', code: `http_${status}` };
  return { outcome: 'failed', code: `http_${status}` };
}

/** Respuesta de un servicio Web Push (RFC 8030). */
export function classifyWebPush(status: number): Classified {
  if (status >= 200 && status < 300) return { outcome: 'accepted' };
  // 404 y 410: el navegador anuló la suscripción (permiso retirado, datos borrados...)
  if (status === 404 || status === 410) return { outcome: 'invalid', code: `http_${status}` };
  // 401 y 403: la suscripción se creó con otra clave VAPID. El navegador se vuelve a
  // suscribir la próxima vez que se abra la web (enablePush en src/services/webPush.js).
  if (status === 401 || status === 403) return { outcome: 'invalid', code: `vapid_rejected_${status}`, config: true };
  if (status === 429 || status >= 500) return { outcome: 'retry', code: `http_${status}` };
  return { outcome: 'failed', code: `http_${status}` };
}

/** Segundos de una cabecera Retry-After (número o fecha), o undefined si no es válida. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now) / 1000));
}
