// Permisos reales contra un proyecto Supabase de PRUEBAS (staging), con tres cuentas reales.
// Comprueba que un empleado no puede leer lo de otro: archivos privados, documentos, asuntos
// propios, historial de RR. HH. ni departamentos (escritura), ni siquiera manipulando
// identificadores, rutas o peticiones directas.
//
// Solo se ejecuta con RUN_LIVE_DB_TESTS=1 y estas variables (nunca usa producción por defecto):
//   STAGING_SUPABASE_URL, STAGING_SUPABASE_PUBLISHABLE_KEY,
//   STAGING_ADMIN_EMAIL, STAGING_ADMIN_PASSWORD,          (cuenta con role = 'admin')
//   STAGING_EMPLOYEE_A_EMAIL, STAGING_EMPLOYEE_A_PASSWORD,  (role = 'employee')
//   STAGING_EMPLOYEE_B_EMAIL, STAGING_EMPLOYEE_B_PASSWORD   (role = 'employee')
// Crea un documento y un archivo de prueba y los borra al terminar.
import { createClient } from '@supabase/supabase-js';

const ENV = [
  'STAGING_SUPABASE_URL', 'STAGING_SUPABASE_PUBLISHABLE_KEY',
  'STAGING_ADMIN_EMAIL', 'STAGING_ADMIN_PASSWORD',
  'STAGING_EMPLOYEE_A_EMAIL', 'STAGING_EMPLOYEE_A_PASSWORD',
  'STAGING_EMPLOYEE_B_EMAIL', 'STAGING_EMPLOYEE_B_PASSWORD',
];

export async function runRlsLiveTests() {
  console.log('\n🔵 [SUITE 24: Permisos reales en staging (accesos horizontales)]');
  let passed = 0;
  let failed = 0;
  const assert = (desc, condition) => {
    if (condition) { console.log(`  ✅ ${desc}`); passed++; } else { console.error(`  ❌ FAIL: ${desc}`); failed++; }
  };

  const missing = ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`  ❌ Faltan variables: ${missing.join(', ')}`);
    return { passed, failed: 1 };
  }
  const url = process.env.STAGING_SUPABASE_URL;
  if (/exaggikhxozcfsifwxeq/.test(url)) {
    console.error('  ❌ STAGING_SUPABASE_URL apunta al proyecto de producción: usa uno de pruebas.');
    return { passed, failed: 1 };
  }
  const key = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY;
  const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = async (prefix) => {
    const c = client();
    const { data, error } = await c.auth.signInWithPassword({
      email: process.env[`STAGING_${prefix}_EMAIL`], password: process.env[`STAGING_${prefix}_PASSWORD`],
    });
    if (error) throw new Error(`No se pudo entrar como ${prefix}: ${error.message}`);
    return { c, id: data.user.id };
  };

  const anon = client();
  const admin = await signIn('ADMIN');
  const a = await signIn('EMPLOYEE_A');
  const b = await signIn('EMPLOYEE_B');

  // 1. Sin sesión no se lee nada
  for (const table of ['documents', 'personal_days', 'hr_audit_logs', 'departments', 'profiles']) {
    const { data } = await anon.from(table).select('*').limit(1);
    assert(`Sin sesión: ${table} no devuelve filas`, !data || data.length === 0);
  }

  // 2. Historial de RR. HH.
  const auditA = await a.c.from('hr_audit_logs').select('id').limit(5);
  assert('Empleado: el historial de RR. HH. no devuelve nada', !auditA.error && auditA.data.length === 0);
  const forge = await a.c.from('hr_audit_logs').insert({ action: 'update', entity_type: 'profiles', changes: {} });
  assert('Empleado: no puede escribir en el historial', !!forge.error);
  const auditAdmin = await admin.c.from('hr_audit_logs').select('id').limit(1);
  assert('Admin: puede leer el historial', !auditAdmin.error);

  // 3. Departamentos: lectura sí, escritura no
  const deptRead = await a.c.from('departments').select('name').limit(1);
  assert('Empleado: ve los departamentos', !deptRead.error && deptRead.data.length > 0);
  const deptWrite = await a.c.from('departments').insert({ name: `__TEST_${Date.now()}` }).select();
  assert('Empleado: no puede crear departamentos', !!deptWrite.error || (deptWrite.data || []).length === 0);
  const ownDept = await a.c.from('profiles').update({ department: 'Comunicación - marketing' }).eq('id', a.id).select();
  assert('Empleado: no puede cambiarse de departamento (ni ganar permisos de noticias)', !!ownDept.error);

  // 4. Documento privado de B (nómina de prueba subida por RR. HH.)
  const path = `docs/__test_${Date.now()}.txt`;
  const up = await admin.c.storage.from('documents').upload(path, new Blob(['nomina de prueba'], { type: 'text/plain' }), { contentType: 'text/plain' });
  assert('Admin: sube un archivo al bucket privado', !up.error);
  const ref = admin.c.storage.from('documents').getPublicUrl(path).data.publicUrl.replace('/object/public/', '/object/authenticated/');
  const doc = await admin.c.from('documents').insert({
    title: '__TEST_RLS_NOMINA__', file_url: ref, sender_id: admin.id, recipient_id: b.id, status: 'pending',
  }).select().single();
  assert('Admin: envía el documento a B', !doc.error);

  try {
    const publicFetch = await fetch(admin.c.storage.from('documents').getPublicUrl(path).data.publicUrl);
    assert('Nadie abre el archivo con la URL pública (bucket privado)', !publicFetch.ok);

    const bSign = await b.c.storage.from('documents').createSignedUrl(path, 60);
    assert('B: puede abrir su propio documento (URL firmada)', !bSign.error && !!bSign.data?.signedUrl);

    const aDocs = await a.c.from('documents').select('id').eq('id', doc.data?.id);
    assert('A: no ve el documento de B aunque pida su id', !aDocs.error && aDocs.data.length === 0);
    const aSign = await a.c.storage.from('documents').createSignedUrl(path, 60);
    assert('A: no puede firmar el archivo de B conociendo la ruta', !!aSign.error);
    const aDownload = await a.c.storage.from('documents').download(path);
    assert('A: no puede descargar el archivo de B directamente', !!aDownload.error);

    // Ataque: A crea un documento suyo que apunta al archivo de B
    const trap = await a.c.from('documents').insert({
      title: '__TEST_RLS_TRAP__', file_url: ref, sender_id: a.id, recipient_id: a.id, status: 'pending',
    }).select().single();
    const aSignAfter = await a.c.storage.from('documents').createSignedUrl(path, 60);
    assert('A: apuntar al archivo de B desde una fila propia no da acceso', !!aSignAfter.error);
    if (trap.data?.id) await a.c.from('documents').delete().eq('id', trap.data.id);

    const tamper = await a.c.from('documents').update({ recipient_id: a.id }).eq('id', doc.data?.id).select();
    assert('A: no puede quedarse el documento de B cambiando el destinatario', (tamper.data || []).length === 0);

    // Subidas fuera de docs/
    const outside = await a.c.storage.from('documents').upload(`otros/__test_${Date.now()}.txt`, new Blob(['x']), { contentType: 'text/plain' });
    assert('Empleado: no puede subir fuera de docs/', !!outside.error);
  } finally {
    if (doc.data?.id) await admin.c.from('documents').delete().eq('id', doc.data.id);
    await admin.c.storage.from('documents').remove([path]);
  }

  // 5. Asuntos propios de otra persona
  const bDays = await a.c.from('personal_days').select('id').eq('employee_id', b.id);
  assert('A: no ve los asuntos propios de B', !bDays.error && bDays.data.length === 0);
  const forgeDay = await a.c.from('personal_days').insert({ employee_id: b.id, date: '2099-01-02', reason: 'test', status: 'pending' });
  assert('A: no puede pedir asuntos propios en nombre de B', !!forgeDay.error);

  // 6. DNI de otra persona
  const bDni = await a.c.from('profile_private').select('dni').eq('id', b.id);
  assert('A: no ve el DNI de B', !bDni.error && bDni.data.length === 0);

  await Promise.all([admin.c.auth.signOut(), a.c.auth.signOut(), b.c.auth.signOut()]);
  return { passed, failed };
}
