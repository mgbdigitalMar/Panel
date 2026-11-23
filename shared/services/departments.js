// Departments (public.departments, supabase/migrations/20261123130000_hr_foundations.sql).
// Shared by the web and the app. profiles.department holds the department's name.
import { DEPARTMENTS } from '../config/constants.js';

const MISSING_TABLE = new Set(['42P01', 'PGRST205']);
const NAME_MAX = 120;

// The department that lets its people publish news (can_edit_news): it cannot be renamed
export const NEWS_DEPARTMENT = 'Comunicación - marketing';

const mapDepartment = (d) => ({
  id: d.id,
  name: d.name,
  isActive: d.is_active !== false,
  createdAt: d.created_at,
});

/**
 * Every department, by name. Before the migration the table does not exist: the fixed list the
 * apps always used comes back instead (`fallback: true`, nothing can be edited).
 * Resolves to null when the request fails, so the caller keeps what it shows.
 */
export async function fetchDepartments(supabase) {
  const { data, error } = await supabase.from('departments').select('id, name, is_active, created_at').order('name');
  if (error) {
    if (MISSING_TABLE.has(error.code)) {
      return DEPARTMENTS.map((d) => ({ id: d.value, name: d.value, isActive: true, fallback: true }));
    }
    console.error('fetchDepartments:', error);
    return null;
  }
  return data.map(mapDepartment);
}

/**
 * Options for an employee's department: the active ones, plus the person's current one when it
 * has been deactivated (so editing them does not change it by accident).
 */
export function departmentOptions(departments, current) {
  const list = Array.isArray(departments) && departments.length
    ? departments
    : DEPARTMENTS.map((d) => ({ name: d.value, isActive: true }));
  const names = list.filter((d) => d.isActive).map((d) => d.name);
  if (current && !names.includes(current)) names.push(current);
  return names
    .sort((a, b) => (a === 'Sin asignar') - (b === 'Sin asignar') || a.localeCompare(b, 'es'))
    .map((name) => ({ value: name, label: name }));
}

/** Department name as typed by RR. HH.: trimmed, single spaces. Returns { name } or { error }. */
export function validateDepartmentName(raw, departments = [], ignoreId = null) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return { error: 'Escribe el nombre del departamento.' };
  if (name.length > NAME_MAX) return { error: `El nombre puede tener como máximo ${NAME_MAX} caracteres.` };
  const clash = departments.find((d) => d.id !== ignoreId && d.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0);
  if (clash) return { error: `Ya existe el departamento «${clash.name}».` };
  return { name };
}

export async function createDepartment(supabase, name) {
  const { data, error } = await supabase.from('departments').insert([{ name }]).select().single();
  if (error) {
    console.error('createDepartment:', error);
    return { error };
  }
  return { data: mapDepartment(data) };
}

/** Renaming moves every person of the department with it (ON UPDATE CASCADE). */
export async function updateDepartment(supabase, id, { name, isActive }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (isActive !== undefined) patch.is_active = isActive;
  const { error } = await supabase.from('departments').update(patch).eq('id', id);
  if (error) console.error('updateDepartment:', error);
  return { error };
}

/** Only a department nobody belongs to can be deleted (the database refuses otherwise). */
export async function deleteDepartment(supabase, id) {
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) console.error('deleteDepartment:', error);
  return { error };
}

/** People per department name (null department counts as «Sin asignar»). */
export function countByDepartment(employees = []) {
  const counts = {};
  for (const e of employees) {
    const key = e?.dept || e?.department || 'Sin asignar';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
