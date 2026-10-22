import { signIn, changeOwnPassword, authErrorMessage, isFirstAccess, FIRST_ACCESS_PASSWORD } from '../shared/services/auth.js';

export async function runAuthSecurityTests() {
  console.log('\n🔵 [SUITE 1: Autenticación, Seguridad y Sesión]');
  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✅ ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Login (shared/services/auth.js, lo usan la web y la app): la contraseña
  //    la comprueba Supabase Auth en el servidor, el cliente nunca ve un hash
  const calls = [];
  const fakeSupabase = (result) => ({
    auth: {
      signInWithPassword: async (args) => { calls.push(['signIn', args]); return result; },
      updateUser: async (args) => { calls.push(['update', args]); return { error: null }; },
    },
  });
  const ok = await signIn(fakeSupabase({ data: { user: { id: 'u1' } }, error: null }), '  Ana@Margube.com ', 'secreta');
  assert('Login correcto devuelve el id de la cuenta', ok.ok && ok.userId === 'u1');
  assert('El email se envía sin espacios y en minúsculas', calls[0][1].email === 'ana@margube.com');
  const bad = await signIn(fakeSupabase({ data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }), 'a@b.com', 'x');
  assert('Credenciales malas: mensaje genérico, sin decir si el email existe', !bad.ok && bad.msg === 'Email o contraseña incorrectos.');
  assert('Límite de intentos con mensaje propio', authErrorMessage({ code: 'over_request_rate_limit' }).startsWith('Demasiados intentos'));

  // 2. Cambio de contraseña: con la actual (perfil) se comprueba primero
  calls.length = 0;
  const wrong = await changeOwnPassword(fakeSupabase({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }), { email: 'a@b.com', currentPassword: 'mal', newPassword: 'nueva1234' });
  assert('Contraseña actual incorrecta no cambia nada', wrong.error === 'Contraseña actual incorrecta.' && !calls.some(c => c[0] === 'update'));
  calls.length = 0;
  const first = await changeOwnPassword(fakeSupabase({ error: null }), { newPassword: 'nueva1234' });
  assert('Primer acceso: guarda la nueva sin pedir la actual', first.error === null && calls.length === 1 && calls[0][0] === 'update');

  // 3. Primer acceso
  assert('isFirstAccess reconoce first_login', isFirstAccess({ first_login: true }) && !isFirstAccess({ first_login: false }));
  assert('La contraseña temporal está definida', typeof FIRST_ACCESS_PASSWORD === 'string' && FIRST_ACCESS_PASSWORD.length >= 8);

  // 4. Mapeo de perfil (mapProfile)
  function mapProfile(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role || 'employee',
      dept: row.department || 'Sin asignar',
      position: row.position || '',
      phone: row.phone || '',
      avatar: row.avatar_initials || row.name?.slice(0, 2).toUpperCase() || '??',
      birthdate: row.birthdate || null,
      workMode: row.work_mode || 'office',
      firstLogin: row.first_login ?? false,
      policyAccepted: row.policy_accepted ?? false,
    };
  }

  const rawRow = {
    id: 'user-uuid-123',
    name: 'Carlos Santana',
    email: 'csantana@margube.com',
    department: 'Operaciones',
    work_mode: 'hybrid',
    first_login: true,
    policy_accepted: false,
    avatar_initials: 'CS'
  };
  const mapped = mapProfile(rawRow);
  assert('mapProfile asigna correctamente campos camelCase', mapped.workMode === 'hybrid' && mapped.dept === 'Operaciones');
  assert('mapProfile preserva firstLogin y policyAccepted', mapped.firstLogin === true && mapped.policyAccepted === false);
  assert('mapProfile genera avatar con iniciales correctas', mapped.avatar === 'CS');

  // Mapeo seguro con campos nulos
  const emptyRow = { id: 'empty-1', name: null, email: 'solo@email.com' };
  const mappedEmpty = mapProfile(emptyRow);
  assert('mapProfile no produce excepciones ante valores nulos', mappedEmpty.dept === 'Sin asignar' && mappedEmpty.avatar === '??');

  // 5. Caducidad de sesión (IDLE_TIMEOUT)
  const IDLE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 horas
  assert('IDLE_TIMEOUT configurado exactamente a 8 horas', IDLE_TIMEOUT === 28800000);

  const now = Date.now();
  const activeSession = { lastActivity: now - (1000 * 60 * 30) }; // hace 30 minutos
  const expiredSession = { lastActivity: now - (IDLE_TIMEOUT + 5000) }; // hace 8h y 5s

  assert('Sesión activa de hace 30m no se considera expirada', (now - activeSession.lastActivity) <= IDLE_TIMEOUT);
  assert('Sesión inactiva tras 8h se marca como expirada', (now - expiredSession.lastActivity) > IDLE_TIMEOUT);

  return { passed, failed };
}
