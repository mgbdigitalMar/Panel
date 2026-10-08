/**
 * Profiles / Employees service — platform-agnostic.
 * All functions receive the Supabase client as first argument.
 */

/** Map a Supabase profile row → app user shape */
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
  };
}

/** Load a single profile by auth user ID */
export async function loadProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return mapProfile(data);
}

/** Load all employees (profiles) */
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

/** Update profile fields */
export async function updateProfile(supabase, userId, updates) {
  const dbUpdates = {};
  if (updates.firstLogin === false) dbUpdates.first_login = false;
  if (updates.workMode) dbUpdates.work_mode = updates.workMode;
  if (updates.policyAccepted === true) dbUpdates.policy_accepted = true;

  if (Object.keys(dbUpdates).length > 0) {
    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId);
    if (error) console.error('updateProfile:', error);
    return { error };
  }
}
