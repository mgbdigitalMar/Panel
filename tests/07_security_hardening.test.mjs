import fs from 'fs';
import path from 'path';
import { safeFileUrl } from '../shared/utils/urls.js';
import { fetchDocuments } from '../shared/services/documents.js';
import { fetchPersonalDays } from '../shared/services/personalDays.js';

export async function runSecurityHardeningTests() {
  console.log('\n🔵 [SUITE 7: Refuerzo de seguridad (enlaces de archivo y reglas del servidor)]');
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

  // 1. safeFileUrl: lo que guardan la web y la app sigue abriéndose
  const storage = 'https://exaggikhxozcfsifwxeq.supabase.co/storage/v1/object/public/documents/docs/1_a.pdf';
  assert('URL de Storage se mantiene', safeFileUrl(storage) === storage);
  assert('data: de PDF (subida sin bucket) se mantiene', safeFileUrl('data:application/pdf;base64,JVBE') === 'data:application/pdf;base64,JVBE');
  assert('data: de imagen se mantiene', safeFileUrl('data:image/jpeg;base64,/9j/') !== null);
  assert('PDF de /public se mantiene', safeFileUrl('/Procedimiento normas internas 2026.pdf') === '/Procedimiento normas internas 2026.pdf');
  assert('Enlace http antiguo se mantiene', safeFileUrl('http://example.com/a.pdf') === 'http://example.com/a.pdf');

  // 2. safeFileUrl: lo que ejecutaría código se descarta
  assert('javascript: se descarta', safeFileUrl('javascript:alert(1)') === null);
  assert('JavaScript: en mayúsculas se descarta', safeFileUrl('JavaScript:alert(1)') === null);
  assert('javascript: con espacios delante se descarta', safeFileUrl('  javascript:alert(1)') === null);
  assert('vbscript: se descarta', safeFileUrl('vbscript:msgbox(1)') === null);
  assert('data:text/html se descarta', safeFileUrl('data:text/html,<script>alert(1)</script>') === null);
  assert('data:image/svg+xml se descarta', safeFileUrl('data:image/svg+xml;base64,PHN2Zz4=') === null);
  assert('URL relativa al protocolo (//host) se descarta', safeFileUrl('//evil.example/x') === null);
  assert('null / no texto devuelve null', safeFileUrl(null) === null && safeFileUrl(42) === null);

  // 3. Los servicios compartidos (los usa la app) aplican el filtro al leer
  const fake = (rows) => ({
    from: () => {
      const q = { select: () => q, order: () => q, eq: () => q, then: (res) => res({ data: rows, error: null }) };
      return q;
    },
  });
  const docs = await fetchDocuments(fake([{ id: 1, file_url: 'javascript:alert(1)' }, { id: 2, file_url: storage }]));
  assert('fetchDocuments descarta enlaces javascript:', docs[0].fileUrl === null && docs[1].fileUrl === storage);
  const days = await fetchPersonalDays(fake([{ id: 1, file_url: 'javascript:alert(1)' }]));
  assert('fetchPersonalDays descarta enlaces javascript:', days[0].fileUrl === null);

  // 4. La web aplica el mismo filtro en su contexto
  const root = process.cwd();
  const ctx = fs.readFileSync(path.join(root, 'src', 'context', 'index.jsx'), 'utf8');
  assert('Contexto web: documentos pasan por safeFileUrl', ctx.includes('fileUrl: safeFileUrl(d.file_url)'));
  assert('Contexto web: asuntos propios pasan por safeFileUrl', ctx.includes('fileUrl: safeFileUrl(p.file_url)'));
  assert('Contexto web: ningún file_url llega sin filtrar', !/fileUrl:\s*[dp]\.file_url/.test(ctx));
  assert('Contexto web: los errores de escritura se avisan en pantalla', ctx.includes('const reportError'));

  // 5. Baja de empleado: primero la ficha, después los archivos (web y app)
  const admin = fs.readFileSync(path.join(root, 'src', 'pages', 'AdminPage.jsx'), 'utf8');
  const webDel = admin.slice(admin.indexOf('const handleDelete'));
  assert('Web: la ficha se borra antes que sus archivos',
    webDel.indexOf("from('profiles').delete()") < webDel.indexOf('deleteEmployeeData(id)'));
  const mobileData = fs.readFileSync(path.join(root, 'mobile', 'src', 'context', 'DataContext.js'), 'utf8');
  const appDel = mobileData.slice(mobileData.indexOf('deleteEmployee: async'));
  assert('App: la ficha se borra antes que sus archivos',
    appDel.indexOf("from('profiles').delete()") < appDel.indexOf('removeStorageFile'));

  // 6. Migración de refuerzo: las reglas siguen en el servidor
  const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261026120000_security_hardening.sql'), 'utf8');
  for (const t of ['requests', 'personal_days', 'hour_compensations', 'reservations']) {
    assert(`Alta de ${t}: protegida por guard_new_row`, sql.includes(`'${t}'`) && sql.includes('guard_new_row'));
  }
  assert('Horas ya/debe siguen aprobándose solas', sql.includes("v->>'type' in ('ya', 'debe')"));
  assert('Ficha propia: lista cerrada de columnas', sql.includes("v_own text[] := array['work_mode', 'policy_accepted', 'first_login', 'telework_applied_on'"));
  assert('Documentos: el destinatario solo cambia el estado', sql.includes('guard_document_update'));
  assert('Enlaces de archivo validados en documents y personal_days', sql.includes('check_file_url') && sql.includes("array['documents', 'personal_days']"));
  assert('Reservas: sin solapes y con bloqueo para envíos simultáneos', sql.includes('check_reservation_overlap') && sql.includes('pg_advisory_xact_lock'));
  assert('Storage: lectura limitada a lo que el usuario puede ver', sql.includes('create policy documents_files_select'));
  assert('Bajas de dispositivos limitadas al propio usuario', (sql.match(/user_id = auth\.uid\(\);/g) || []).length === 2);

  return { passed, failed };
}
