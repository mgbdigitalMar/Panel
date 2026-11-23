// RR. HH. audit log (public.hr_audit_logs, supabase/migrations/20261123130000_hr_foundations.sql).
// Only admins can read it (RLS); nobody can change it through the API. Shared by the web and the app.

export const AUDIT_PAGE_SIZE = 50;

export const AUDIT_ENTITIES = {
  profiles: 'Ficha de empleado',
  profile_private: 'DNI',
  departments: 'Departamento',
  documents: 'Documento',
  requests: 'Solicitud',
  personal_days: 'Asuntos propios',
  hour_compensations: 'Bolsa de horas',
  time_corrections: 'Corrección de fichaje',
  work_schedules: 'Horario',
  hr_audit_logs: 'Registro de auditoría',
};

export const AUDIT_ACTIONS = {
  insert: 'Alta',
  update: 'Cambio',
  delete: 'Baja',
  purge: 'Purga',
};

const FIELD_LABELS = {
  name: 'Nombre',
  email: 'Email',
  role: 'Rol',
  department: 'Departamento',
  position: 'Cargo',
  birthdate: 'Fecha de nacimiento',
  join_date: 'Fecha de incorporación',
  first_login: 'Primer acceso',
  policy_accepted: 'Normas aceptadas',
  telework_days: 'Días de teletrabajo',
  avatar_initials: 'Iniciales',
  avatar_url: 'Foto',
  dni: 'DNI',
  is_active: 'Activo',
  title: 'Título',
  description: 'Descripción',
  file_url: 'Archivo',
  status: 'Estado',
  recipient_id: 'Destinatario',
  sender_id: 'Remitente',
  type: 'Tipo',
  reason: 'Motivo',
  start_date: 'Desde',
  end_date: 'Hasta',
  date: 'Fecha',
  hours: 'Horas',
  amount: 'Importe',
  item: 'Artículo',
  reviewed_by: 'Revisado por',
  reviewed_at: 'Revisado el',
  older_than_days: 'Más antiguos que (días)',
  deleted: 'Registros eliminados',
  work_schedule_id: 'Horario',
  proposed_at: 'Hora corregida',
  target_entry_id: 'Fichaje corregido',
  review_note: 'Nota de RR. HH.',
  requested_by: 'Pedida por',
  days: 'Días y horas',
  tolerance_minutes: 'Tolerancia (min)',
  is_default: 'Predeterminado',
};

const VALUE_LABELS = {
  role: { admin: 'Administrador', employee: 'Empleado' },
  status: {
    pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', signed: 'Firmado',
    completed: 'Completado', confirmed: 'Confirmada', cancelled: 'Cancelada',
  },
  kind: {
    in: 'Entrada', out: 'Salida', break_start: 'Inicio de descanso', break_end: 'Fin de descanso', void: 'Quitar fichaje',
  },
  type: {
    asuntos_propios: 'Asuntos propios', remoto: 'Trabajo remoto', external: 'Trabajo externo',
    purchase: 'Compra', ya: 'Ya compensadas', bolsa: 'Bolsa', debe: 'Debidas',
  },
};

// Technical columns that say nothing to the person reading the log
const HIDDEN_FIELDS = new Set(['id', 'created_at', 'employee_id', 'author_id']);

export const fieldLabel = (key) => FIELD_LABELS[key] || key.replace(/_/g, ' ');

/** A value as words: booleans, enums, dates and files (never a link). */
export function formatAuditValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value && typeof value === 'object' && value.changed) return 'modificado';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (key === 'file_url') return 'adjunto';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (key === 'days' && typeof value === 'object') {
    const short = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };
    const parts = Object.entries(value).sort(([a], [b]) => a - b)
      .map(([d, s]) => `${short[d] || d} ${s?.start}–${s?.end}${s?.break ? ` (pausa ${s.break} min)` : ''}`);
    return parts.length ? parts.join(', ') : 'Sin días';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const mapped = VALUE_LABELS[key]?.[value];
  if (mapped) return mapped;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  }
  return String(value);
}

/**
 * The changes of an entry as lines ready to read: { field, label, from?, to? }.
 * Updates carry before → after; inserts and deletes, the values the row had.
 */
export function auditChangeLines(entry) {
  const changes = entry?.changes && typeof entry.changes === 'object' ? entry.changes : {};
  return Object.entries(changes)
    .filter(([key]) => !HIDDEN_FIELDS.has(key))
    .map(([key, value]) => {
      if (entry.action === 'update') {
        if (value && typeof value === 'object' && value.changed) {
          return { field: key, label: fieldLabel(key), to: 'modificado' };
        }
        return {
          field: key,
          label: fieldLabel(key),
          from: formatAuditValue(key, value?.old),
          to: formatAuditValue(key, value?.new),
        };
      }
      return { field: key, label: fieldLabel(key), to: formatAuditValue(key, value) };
    });
}

/** One-line title for an entry: «Cambio · Ficha de empleado». */
export function auditTitle(entry) {
  return `${AUDIT_ACTIONS[entry?.action] || 'Cambio'} · ${AUDIT_ENTITIES[entry?.entity_type] || entry?.entity_type || 'Registro'}`;
}

/**
 * A page of the log, newest first. Filters: entityType, subjectId, actorId, from / to (YYYY-MM-DD,
 * both included, Spain's calendar day is close enough to UTC for a filter) and `before`
 * (the id of the last entry already shown: the next page continues from there).
 * Resolves to { rows, hasMore } or { error }.
 */
export async function fetchAuditLog(supabase, { entityType, subjectId, actorId, from, to, before, limit = AUDIT_PAGE_SIZE } = {}) {
  let query = supabase
    .from('hr_audit_logs')
    .select('id, occurred_at, actor_id, actor_name, subject_id, subject_name, action, entity_type, entity_id, changes')
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (entityType) query = query.eq('entity_type', entityType);
  if (subjectId) query = query.eq('subject_id', subjectId);
  if (actorId) query = query.eq('actor_id', actorId);
  if (from) query = query.gte('occurred_at', `${from}T00:00:00`);
  if (to) query = query.lte('occurred_at', `${to}T23:59:59.999`);
  if (before) query = query.lt('id', before);
  const { data, error } = await query;
  if (error) {
    console.error('fetchAuditLog:', error);
    return { error };
  }
  return { rows: data.slice(0, limit), hasMore: data.length > limit };
}

/** RR. HH. applies the retention period (at least 365 days). Resolves to { deleted } or { error }. */
export async function purgeAuditLog(supabase, olderThanDays) {
  const { data, error } = await supabase.rpc('purge_hr_audit_logs', { p_older_than_days: olderThanDays });
  if (error) {
    console.error('purgeAuditLog:', error);
    return { error };
  }
  return { deleted: data };
}
