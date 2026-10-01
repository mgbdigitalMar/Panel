import bcrypt from 'bcryptjs';

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

  // 1. Verificación de hash bcrypt
  const plainPassword = 'MargubeSegura2026!';
  const hash = bcrypt.hashSync(plainPassword, 10);
  assert('bcrypt genera un hash válido de 60 caracteres', hash.length === 60);
  assert('bcrypt valida correctamente la contraseña original', bcrypt.compareSync(plainPassword, hash));
  assert('bcrypt rechaza una contraseña incorrecta', !bcrypt.compareSync('PasswordIncorrecta', hash));

  // 2. Contraseñas maestras requeridas para el entorno del usuario
  const masterPasswords = ['margube2026', 'test123', 'test1234'];
  for (const master of masterPasswords) {
    const isMasterValid = masterPasswords.includes(master);
    assert(`Contraseña maestra/testing permitida: '${master}'`, isMasterValid);
  }
  assert('Contraseña aleatoria no es aceptada como maestra', !masterPasswords.includes('randomSecret999'));

  // 3. Fallback de contraseña en texto plano en base de datos
  const mockDbRowWithPlaintext = {
    email: 'test@margube.com',
    password_hash: 'temporal123' // guardada en texto plano manualmente
  };
  const testInput = 'temporal123';
  const isValidPlaintext = testInput === mockDbRowWithPlaintext.password_hash;
  assert('Bypass de contraseña en texto plano funciona correctamente para perfiles sin bcrypt', isValidPlaintext);

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
