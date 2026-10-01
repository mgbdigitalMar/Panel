import { createClient } from '@supabase/supabase-js';

const url = 'https://exaggikhxozcfsifwxeq.supabase.co';
const key = 'sb_publishable_SaExpxl0EopS3TJPqqJDcg_SSU2Myvc';
const supabase = createClient(url, key);

export async function runDatabaseSchemaTests() {
  console.log('\n🔵 [SUITE 2: Esquema de Base de Datos y Relaciones Supabase]');
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

  // 1. Conexión y latencia con el endpoint de Supabase
  const t0 = Date.now();
  const { data: pingData, error: pingError } = await supabase.from('profiles').select('id').limit(1);
  const latency = Date.now() - t0;
  assert(`Conexión con Supabase establecida (latencia: ${latency}ms)`, !pingError && pingData !== null);

  // 2. Existencia y consulta accesible en las 10 tablas centrales
  const tables = [
    'profiles',
    'rooms',
    'vehicles',
    'reservations',
    'requests',
    'personal_days',
    'hour_compensations',
    'documents',
    'news',
    'notifications'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    assert(`Tabla '${table}' accesible y responde sin error`, error === null);
  }

  // 3. Verificación de Foreign Keys / Joins relacionales
  // a) hour_compensations -> employee & reviewer
  const { data: hJoin, error: hErr } = await supabase.from('hour_compensations').select(`
    id, hours,
    employee:profiles!hour_compensations_employee_id_fkey(id, name),
    reviewer:profiles!hour_compensations_reviewed_by_fkey(id, name)
  `).limit(2);
  assert('Foreign Keys en hour_compensations (employee y reviewer) resuelven correctamente', hErr === null);

  // b) personal_days -> employee & reviewer
  const { data: pJoin, error: pErr } = await supabase.from('personal_days').select(`
    id, date,
    employee:profiles!personal_days_employee_id_fkey(id, name),
    reviewer:profiles!personal_days_reviewed_by_fkey(id, name)
  `).limit(2);
  assert('Foreign Keys en personal_days (employee y reviewer) resuelven correctamente', pErr === null);

  // c) documents -> sender & recipient
  const { data: dJoin, error: dErr } = await supabase.from('documents').select(`
    id, title,
    sender:profiles!documents_sender_id_fkey(id, name),
    recipient:profiles!documents_recipient_id_fkey(id, name)
  `).limit(2);
  assert('Foreign Keys en documents (sender y recipient) resuelven correctamente', dErr === null);

  // d) requests -> employee
  const { data: rJoin, error: rErr } = await supabase.from('requests').select(`
    id, type,
    employee:profiles!requests_employee_id_fkey(id, name, department)
  `).limit(2);
  assert('Foreign Key en requests (employee) resuelve correctamente', rErr === null);

  // e) news -> author
  const { data: nJoin, error: nErr } = await supabase.from('news').select(`
    id, title,
    author:profiles!news_author_id_fkey(id, name, avatar_initials)
  `).limit(2);
  assert('Foreign Key en news (author) resuelve correctamente', nErr === null);

  return { passed, failed };
}
