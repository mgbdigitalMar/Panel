
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
