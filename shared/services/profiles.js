
export function mapProfile(profile) {
  if (!profile) return null;
  const rawDept = (profile.department || profile.dept || '').trim();
  const dept = rawDept || 'Sin asignar';
  const position = (profile.position || '').trim();
  const phone = (profile.phone || '').trim();
  const name = (profile.name || '').trim();
  const email = (profile.email || '').trim();
  const workMode = profile.work_mode || profile.workMode || 'Office';

  return {
    id:             profile.id,
    name:           name,
    email:          email,
    role:           profile.role || 'employee',
    dept:           dept,
    department:     dept,
    phone:          phone,
    position:       position,
    avatar:         profile.avatar_initials || profile.avatar || null,
    avatarUrl:      profile.avatar_url || profile.avatarUrl || null,
    birthdate:      profile.birthdate || profile.birth_date || null,
    joinDate:       profile.join_date || profile.joinDate || null,
    workMode:       workMode,
    firstLogin:     profile.first_login ?? profile.firstLogin,
    policyAccepted: profile.policy_accepted ?? profile.policyAccepted,
    teleworkDays:   profile.telework_days || profile.teleworkDays || [],
    teleworkAppliedOn: profile.telework_applied_on ?? profile.teleworkAppliedOn ?? null,
  };
}

/**
 * DNI by profile id, from profile_private: the session's own, or everyone's for an admin.
 * null when the table is not there yet (before supabase/migrations/20261027120000_private_dni.sql):
 * the DNI is then still in profiles.phone.
 */
export async function fetchDnis(supabase) {
  const { data, error } = await supabase.from('profile_private').select('id, dni');
  if (error) {
    console.warn('fetchDnis:', error.message);
    return null;
  }
  return Object.fromEntries(data.map((r) => [r.id, r.dni || '']));
}

/** Profiles with their DNI in `phone`, the field both apps show as DNI. */
export function withDni(profiles, dnis) {
  if (!dnis) return profiles;
  return profiles.map((p) => (p ? { ...p, phone: dnis[p.id] || '' } : p));
}

/**
 * RRHH saves an employee's DNI (empty clears it). Call after the profiles row exists.
 * Without the private_dni migration the DNI travels in profiles.phone as before.
 */
export async function saveDni(supabase, id, dni) {
  const value = String(dni || '').trim() || null;
  const { error } = await supabase.from('profile_private').upsert({ id, dni: value, updated_at: new Date().toISOString() });
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
    console.warn('saveDni:', error.message);
    return { error };
  }
  return { error: null };
}

export async function loadProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return mapProfile(data);
}

export async function loadAllEmployees(supabase) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name');
  if (error) {
    console.error('loadAllEmployees:', error);
    return [];
  }
  return data.map(mapProfile);
}
