/**
 * Shared constants — used by both WEB and APP.
 * Platform-agnostic: no DOM, no localStorage, no React Native imports.
 */

// ── Departments ──────────────────────────────────────────────────────
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

// ── Request types ────────────────────────────────────────────────────
export const REQUEST_TYPES = {
  asuntos_propios: 'Asuntos Propios',
  remoto: 'Trabajo Remoto',
  external: 'Trabajo Externo',
  purchase: 'Compra',
};

// ── Status labels ────────────────────────────────────────────────────
export const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

// ── Notification → navigation mapping ────────────────────────────────
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

// ── Idle timeouts (ms) ──────────────────────────────────────────────
export const IDLE_TIMEOUT_WEB = 60 * 1000;        // 1 min
export const IDLE_TIMEOUT_MOBILE = 30 * 60 * 1000; // 30 min

// ── Asuntos propios ─────────────────────────────────────────────────
// Días de asuntos propios por año natural (los que muestra la app en "Tu resumen").
export const PERSONAL_DAYS_PER_YEAR = 6;

// ── File upload limits ──────────────────────────────────────────────
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

// ── Navigation items (shared structure) ─────────────────────────────
export const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',         iconName: 'LayoutDashboard' },
  { id: 'reservations', label: 'Reservas',           iconName: 'Calendar',    badgeKey: 'reservations' },
  { id: 'requests',     label: 'Solicitudes',        iconName: 'Inbox',       badgeKey: 'requests' },
  { id: 'horas',        label: 'Tiempo a compensar', iconName: 'Timer' },
  { id: 'news',         label: 'Noticias y Eventos', iconName: 'Newspaper' },
  { id: 'employees',    label: 'Equipo',             iconName: 'UsersRound' },
];

export const ADMIN_NAV_ITEMS = [
  { id: 'admin', label: 'Administración', iconName: 'Settings', badgeKey: 'admin' },
];

// ── Feature capability flags ────────────────────────────────────────
export const FEATURE_TARGET = {
  WEB: 'web',
  MOBILE: 'mobile',
  BOTH: 'both',
};

// ── Realtime channel names ──────────────────────────────────────────
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

// ── Hour compensation types (same semantics as web HorasPage) ────────
// 'ya' and 'debe' are auto-approved; 'bolsa' requires admin approval.
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
