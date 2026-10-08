/**
 * Feature capability registry — single source of truth for WHERE each
 * feature is available. Shared by WEB (Vite) and APP (Expo/Metro).
 *
 * To add a feature:
 *   1. Add an entry below with target WEB, MOBILE or BOTH.
 *   2. Gate the UI with isFeatureEnabled('<key>', PLATFORM) on each client.
 *   3. Business rules and permissions stay in the backend (Supabase), never here:
 *      this registry only decides what UI is shown, it is not a security boundary.
 */
import { FEATURE_TARGET } from './constants.js';

export const PLATFORM = { WEB: 'web', MOBILE: 'mobile' };

export const FEATURE_WEB = FEATURE_TARGET.WEB;
export const FEATURE_MOBILE = FEATURE_TARGET.MOBILE;
export const FEATURE_BOTH = FEATURE_TARGET.BOTH;

export const FEATURES = {
  // ── Shared (same data, rules and backend; UI adapted per platform) ──
  login:               { target: FEATURE_BOTH,   label: 'Login' },
  changePassword:      { target: FEATURE_BOTH,   label: 'Cambio de contraseña' },
  dashboard:           { target: FEATURE_BOTH,   label: 'Dashboard' },
  reservations:        { target: FEATURE_BOTH,   label: 'Reservas de salas y vehículos' },
  reservationCalendar: { target: FEATURE_BOTH,   label: 'Calendario de reservas' },
  requests:            { target: FEATURE_BOTH,   label: 'Solicitudes (remoto, externo, compra)' },
  personalDays:        { target: FEATURE_BOTH,   label: 'Asuntos propios' },
  hours:               { target: FEATURE_BOTH,   label: 'Tiempo a compensar' },
  news:                { target: FEATURE_BOTH,   label: 'Noticias y eventos' },
  employees:           { target: FEATURE_BOTH,   label: 'Equipo' },
  profile:             { target: FEATURE_BOTH,   label: 'Perfil y documentos' },
  settings:            { target: FEATURE_BOTH,   label: 'Ajustes' },
  notificationCenter:  { target: FEATURE_BOTH,   label: 'Centro de notificaciones' },
  admin:               { target: FEATURE_BOTH,   label: 'Administración', roles: ['admin'] },
  onboardingPolicy:    { target: FEATURE_BOTH,   label: 'Onboarding y aceptación de normas' },

  // ── Web only (desktop-oriented tools) ──
  commandPalette:      { target: FEATURE_WEB,    label: 'Paleta de comandos (Ctrl+K)' },
  desktopNotifications:{ target: FEATURE_WEB,    label: 'Notificaciones de escritorio del navegador' },
  densityToggle:       { target: FEATURE_WEB,    label: 'Densidad compacta/normal' },

  // ── Mobile only (native capabilities) ──
  pushNotifications:   { target: FEATURE_MOBILE, label: 'Notificaciones push' },
  appBadge:            { target: FEATURE_MOBILE, label: 'Badge del icono' },
  deepLinks:           { target: FEATURE_MOBILE, label: 'Deep links' },
  biometricUnlock:     { target: FEATURE_MOBILE, label: 'Desbloqueo biométrico', planned: true },
  cameraUpload:        { target: FEATURE_MOBILE, label: 'Subir justificante con cámara', planned: true },
  qrScanner:           { target: FEATURE_MOBILE, label: 'Escáner QR', planned: true },
};

/**
 * @param {keyof FEATURES} key
 * @param {'web'|'mobile'} platform
 * @param {{ role?: string }} [user] optional, for role-gated UI
 */
export function isFeatureEnabled(key, platform, user) {
  const f = FEATURES[key];
  if (!f || f.planned) return false;
  if (f.target !== FEATURE_BOTH && f.target !== platform) return false;
  if (f.roles && !f.roles.includes(user?.role)) return false;
  return true;
}
