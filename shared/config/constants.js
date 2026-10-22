// Shared by the web and the app: no DOM, localStorage or React Native imports.

export const DEPARTMENTS = [
  { value: 'Administración - RRHH', label: 'Administración - RRHH' },
  { value: 'Comercial - HEF', label: 'Comercial - HEF' },
  { value: 'Formación', label: 'Formación' },
  { value: 'Verificación (CAE)', label: 'Verificación (CAE)' },
  { value: 'Planificación', label: 'Planificación' },
  { value: 'Técnico', label: 'Técnico' },
  { value: 'Comunicación - marketing', label: 'Comunicación - marketing' },
  { value: 'Marketing - diseño', label: 'Marketing - diseño' },
  { value: 'Sin asignar', label: 'Sin asignar' },
];

export const REQUEST_TYPES = {
  asuntos_propios: 'Asuntos Propios',
  remoto: 'Trabajo Remoto',
  external: 'Trabajo Externo',
  purchase: 'Compra',
};

export const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

export const ENTITY_NAV_MAP = {
  request: 'requests',
  document: 'profile',
  hour_compensation: 'horas',
  reservation: 'reservations',
  personal_day: 'requests',
};

export const ENTITY_NAV_MAP_ADMIN = {
  ...ENTITY_NAV_MAP,
  hour_compensation: 'admin',
};

/**
 * Web path a notification opens.
 * Keep in sync with public/push-sw.js and supabase/functions/send-push.
 */
export function notificationWebPath(notif, isAdmin = false) {
  return '/' + ((isAdmin ? ENTITY_NAV_MAP_ADMIN : ENTITY_NAV_MAP)[notif?.entity_type] || 'dashboard');
}

export const IDLE_TIMEOUT_MOBILE = 30 * 60 * 1000; // 30 min

// Días de asuntos propios por año natural (los que muestra la app en "Tu resumen")
export const PERSONAL_DAYS_PER_YEAR = 6;

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export const REALTIME_CHANNELS = {
  requests: 'realtime-requests',
  reservations: 'realtime-reservations',
  rooms: 'realtime-rooms',
  vehicles: 'realtime-vehicles',
  documents: 'realtime-documents',
  hours: 'realtime-hours',
  personalDays: 'realtime-personal-days',
  news: 'realtime-news',
  notifications: 'realtime-notifications',
  profiles: 'realtime-profiles',
};

// 'ya' and 'debe' are auto-approved; 'bolsa' needs an admin
export const HOUR_TYPES = {
  ya: {
    label: 'Ya',
    desc: 'Registro inmediato, sin aprobación',
    banner: 'Las horas se registrarán como compensadas inmediatamente.',
    dateLabel: 'Fecha de compensación',
    sign: 1,
    tone: 'success',
  },
  bolsa: {
    label: 'Bolsa',
    desc: 'Acumular horas, requiere aprobación',
    banner: 'La solicitud será revisada por el administrador antes de añadirse a tu bolsa.',
    dateLabel: 'Fecha de generación',
    sign: 1,
    tone: 'primary',
  },
  debe: {
    label: 'Debo',
    desc: 'Horas que debo a la empresa',
    banner: 'Estas horas quedan registradas como deuda. El administrador puede revisarlas.',
    dateLabel: 'Fecha en que se debieron',
    sign: -1,
    tone: 'danger',
  },
};
