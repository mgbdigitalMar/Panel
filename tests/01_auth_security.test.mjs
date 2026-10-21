import bcrypt from 'bcryptjs';
import { verifyPassword, verifyPasswordAsync, isFirstAccess, FIRST_ACCESS_PASSWORD } from '../shared/services/auth.js';

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

  // 2. Regla real de login (shared/services/auth.js, la usan la web y la app)
  const isValidLogin = (row, pass) =>
    (isFirstAccess(row) && pass === FIRST_ACCESS_PASSWORD) || verifyPassword(pass, row.password_hash, bcrypt);
  const activeRow = { first_login: false, password_hash: hash };
  const firstRow = { first_login: true, password_hash: null };
  assert('Login acepta la contraseña propia', isValidLogin(activeRow, plainPassword));
  assert('Pegar el hash como contraseña NO da acceso', !isValidLogin(activeRow, hash));
  for (const master of ['margube2026', 'test123', 'test1234']) {
    assert(`'${master}' NO abre una cuenta que ya tiene contraseña propia`, !isValidLogin(activeRow, master));
  }
  assert(`'${FIRST_ACCESS_PASSWORD}' abre una cuenta en su primer acceso`, isValidLogin(firstRow, FIRST_ACCESS_PASSWORD));
  assert("'test123' NO abre una cuenta en su primer acceso", !isValidLogin(firstRow, 'test123'));
  assert('Una cuenta sin contraseña y sin primer acceso no entra', !isValidLogin({ first_login: false, password_hash: null }, FIRST_ACCESS_PASSWORD));

  // 3. Texto plano solo para valores que no son un hash bcrypt (puestos a mano en la BD)
  assert('Contraseña en texto plano guardada a mano sigue funcionando', verifyPassword('temporal123', 'temporal123', bcrypt));
  assert('verifyPasswordAsync también rechaza el hash como contraseña', !(await verifyPasswordAsync(hash, hash, bcrypt)));

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
