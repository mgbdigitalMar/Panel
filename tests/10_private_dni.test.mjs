import fs from 'fs';
import path from 'path';
import { fetchDnis, withDni, saveDni } from '../shared/services/profiles.js';

export async function runPrivateDniTests() {
  console.log('\n🔵 [SUITE 10: DNI privado (solo RRHH y la propia persona)]');
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

  const query = (result, calls = []) => ({
    from: (table) => {
      calls.push(table);
      const q = { select: () => q, upsert: (row) => { calls.push(row); return q; }, then: (res) => res(result) };
      return q;
    },
  });
  const { warn } = console;
  console.warn = () => {};

  // 1. Lectura: lo que RLS deja ver, o null si la migración aún no está
  const dnis = await fetchDnis(query({ data: [{ id: 'a', dni: '12345678Z' }, { id: 'b', dni: null }], error: null }));
  assert('fetchDnis devuelve un mapa id → DNI', dnis.a === '12345678Z' && dnis.b === '');
  const missing = await fetchDnis(query({ data: null, error: { code: 'PGRST205', message: 'not found' } }));
  assert('Sin la tabla devuelve null (se sigue usando profiles.phone)', missing === null);

  // 2. Mezcla en las fichas
  const profiles = [{ id: 'a', phone: '' }, { id: 'b', phone: '' }, { id: 'c', phone: 'X' }];
  const merged = withDni(profiles, { a: '12345678Z' });
  assert('El DNI visible se pone en phone', merged[0].phone === '12345678Z');
  assert('Un DNI que no puedo ver queda vacío', merged[1].phone === '' && merged[2].phone === '');
  assert('Antes de la migración las fichas no cambian', withDni(profiles, null) === profiles);

  // 3. Escritura de RRHH
  const calls = [];
  const ok = await saveDni(query({ error: null }, calls), 'a', '  12345678z ');
  assert('saveDni escribe en profile_private', calls[0] === 'profile_private' && calls[1].id === 'a' && calls[1].dni === '12345678z' && !ok.error);
  const cleared = [];
  await saveDni(query({ error: null }, cleared), 'a', '');
  assert('Un DNI vacío lo borra (null)', cleared[1].dni === null);
  const noTable = await saveDni(query({ error: { code: '42P01', message: 'missing' } }), 'a', '1');
  assert('Sin la tabla no da error (va en profiles.phone)', noTable.error === null);
  const denied = await saveDni(query({ error: { code: '42501', message: 'denied' } }), 'a', '1');
  assert('Un permiso denegado sí se informa', denied.error?.code === '42501');
  console.warn = warn;

  // 4. Migración
  const root = process.cwd();
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
  const sql = read('supabase', 'migrations', '20261027120000_private_dni.sql');
  assert('Solo la persona y los admins leen el DNI', sql.includes('using (id = auth.uid() or public.is_admin())'));
  assert('Solo los admins lo escriben', sql.includes('profile_private_write') && sql.includes('with check (public.is_admin())'));
  assert('Se copian los DNI antes de vaciar profiles.phone',
    sql.indexOf('insert into public.profile_private') < sql.indexOf('update public.profiles set phone = null'));
  assert('Lo escrito en profiles.phone pasa a profile_private', sql.includes('before insert or update of phone on public.profiles'));
  assert('Un valor vacío no borra el DNI guardado', sql.includes("if coalesce(trim(new.phone), '') <> '' then"));

  // 5. Pantallas
  const web = read('src', 'pages', 'EmployeesPage.jsx');
  assert('Web directorio: DNI solo para RRHH o la propia persona', web.includes('const canSeeDni = (emp) => isAdmin || user.id === emp.id'));
  assert('Web tabla: columna DNI solo para admins', web.includes("...(isAdmin ? ['DNI'] : [])") && web.includes('{isAdmin && <td data-label="DNI"'));
  assert('Web RRHH guarda el DNI aparte', read('src', 'pages', 'AdminPage.jsx').includes('saveDni(supabase, editEmp.id, form.phone)'));
  assert('App ficha: DNI solo para RRHH o la propia persona', read('mobile', 'src', 'screens', 'EmployeeDetailScreen.jsx').includes("((isAdmin || isMe) && emp.phone) ? { label: 'DNI'"));
  assert('App búsqueda: por DNI solo RRHH', read('mobile', 'src', 'screens', 'EmployeesScreen.jsx').includes("const dni = user?.role === 'admin' ? e.phone || '' : ''"));
  assert('App RRHH guarda el DNI aparte', read('mobile', 'src', 'context', 'DataContext.js').includes('svc.saveDni(supabase, savedId, form.phone)'));

  return { passed, failed };
}
