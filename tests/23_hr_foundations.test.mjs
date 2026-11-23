import fs from 'fs';
import path from 'path';
import {
  fetchDepartments, departmentOptions, validateDepartmentName, countByDepartment,
  createDepartment, updateDepartment, NEWS_DEPARTMENT,
} from '../shared/services/departments.js';
import {
  fetchAuditLog, purgeAuditLog, auditChangeLines, auditTitle, formatAuditValue, AUDIT_PAGE_SIZE,
} from '../shared/services/hrAudit.js';

export async function runHrFoundationsTests() {
  console.log('\n🔵 [SUITE 23: Base de RR. HH. (departamentos e historial de cambios)]');
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

  const { warn, error: logError } = console;
  console.warn = () => {};
  console.error = () => {};

  // Cliente simulado: registra cada llamada de la consulta y devuelve `result`
  function fakeClient(result, calls = []) {
    const q = {};
    for (const m of ['select', 'order', 'limit', 'eq', 'gte', 'lte', 'lt', 'insert', 'update', 'delete', 'single']) {
      q[m] = (...args) => { calls.push([m, ...args]); return q; };
    }
    q.then = (res) => res(result);
    return {
      from: (table) => { calls.push(['from', table]); return q; },
      rpc: async (fn, args) => { calls.push(['rpc', fn, args]); return result; },
    };
  }

  // 1. Departamentos
  const depts = [
    { id: '1', name: 'Técnico', isActive: true },
    { id: '2', name: 'Sin asignar', isActive: true },
    { id: '3', name: 'Antiguo', isActive: false },
    { id: '4', name: 'Administración - RRHH', isActive: true },
  ];
  const opts = departmentOptions(depts).map((o) => o.value);
  assert('Solo se ofrecen los departamentos activos', !opts.includes('Antiguo') && opts.includes('Técnico'));
  assert('Orden alfabético con «Sin asignar» al final', opts[0] === 'Administración - RRHH' && opts[opts.length - 1] === 'Sin asignar');
  assert('El departamento actual de la persona se conserva aunque esté oculto', departmentOptions(depts, 'Antiguo').some((o) => o.value === 'Antiguo'));
  assert('Sin datos se usa la lista fija de siempre', departmentOptions(null).some((o) => o.value === NEWS_DEPARTMENT));

  assert('El nombre se limpia de espacios', validateDepartmentName('  Calidad   y  medio ambiente ').name === 'Calidad y medio ambiente');
  assert('Un nombre vacío se rechaza', !!validateDepartmentName('   ').error);
  assert('Un nombre demasiado largo se rechaza', !!validateDepartmentName('x'.repeat(121)).error);
  assert('Duplicado sin distinguir mayúsculas ni tildes', !!validateDepartmentName('tecnico', depts).error);
  assert('Renombrar sin cambiar no choca consigo mismo', !validateDepartmentName('Técnico', depts, '1').error);

  const counts = countByDepartment([{ dept: 'Técnico' }, { dept: 'Técnico' }, { department: '' }, {}]);
  assert('Personas por departamento (vacío cuenta como «Sin asignar»)', counts['Técnico'] === 2 && counts['Sin asignar'] === 2);

  const loaded = await fetchDepartments(fakeClient({ data: [{ id: 'a', name: 'Técnico', is_active: false, created_at: 'x' }], error: null }));
  assert('fetchDepartments convierte las filas', loaded[0].name === 'Técnico' && loaded[0].isActive === false);
  const before = await fetchDepartments(fakeClient({ data: null, error: { code: 'PGRST205', message: 'missing' } }));
  assert('Antes de la migración devuelve la lista fija, de solo lectura', before.length >= 9 && before.every((d) => d.fallback));
  const failedLoad = await fetchDepartments(fakeClient({ data: null, error: { code: '500', message: 'down' } }));
  assert('Un fallo de red devuelve null (se mantiene lo que hay)', failedLoad === null);

  const createCalls = [];
  await createDepartment(fakeClient({ data: { id: 'n', name: 'Calidad', is_active: true }, error: null }, createCalls), 'Calidad');
  assert('Crear inserta en departments', createCalls.some((c) => c[0] === 'from' && c[1] === 'departments') && createCalls.some((c) => c[0] === 'insert' && c[1][0].name === 'Calidad'));
  const updCalls = [];
  await updateDepartment(fakeClient({ error: null }, updCalls), 'n', { isActive: false });
  assert('Ocultar solo envía is_active', updCalls.some((c) => c[0] === 'update' && JSON.stringify(c[1]) === '{"is_active":false}'));

  // 2. Historial: presentación
  const update = { action: 'update', entity_type: 'profiles', changes: {
    department: { old: 'Técnico', new: 'Formación' },
    role: { old: 'employee', new: 'admin' },
    policy_accepted: { old: false, new: true },
  } };
  const lines = auditChangeLines(update);
  assert('Un cambio muestra antes → después', lines.find((l) => l.field === 'department')?.from === 'Técnico' && lines.find((l) => l.field === 'department')?.to === 'Formación');
  assert('Los valores se traducen (rol, sí/no)', lines.find((l) => l.field === 'role')?.to === 'Administrador' && lines.find((l) => l.field === 'policy_accepted')?.to === 'Sí');
  const secret = auditChangeLines({ action: 'update', entity_type: 'profile_private', changes: { dni: { changed: true } } });
  assert('El DNI aparece como modificado, sin valores', secret.length === 1 && secret[0].to === 'modificado' && secret[0].from === undefined);
  const insert = auditChangeLines({ action: 'insert', entity_type: 'documents', changes: { id: 'x', title: 'Nómina octubre', file_url: 'https://x/storage/v1/object/authenticated/documents/docs/a.pdf', employee_id: 'e' } });
  assert('Un alta lista sus valores sin columnas técnicas', insert.some((l) => l.field === 'title') && !insert.some((l) => l.field === 'id' || l.field === 'employee_id'));
  assert('Un archivo nunca se muestra como enlace', insert.find((l) => l.field === 'file_url')?.to === 'adjunto');
  assert('Fechas legibles y vacíos como guion', formatAuditValue('reviewed_at', '2026-11-23T10:00:00Z') !== '2026-11-23T10:00:00Z' && formatAuditValue('reason', null) === '—');
  assert('Título con acción y elemento', auditTitle({ action: 'delete', entity_type: 'requests' }) === 'Baja · Solicitud');

  // 3. Historial: consulta por páginas
  const rows = Array.from({ length: AUDIT_PAGE_SIZE + 1 }, (_, i) => ({ id: 1000 - i }));
  const qCalls = [];
  const page = await fetchAuditLog(fakeClient({ data: rows, error: null }, qCalls), {
    entityType: 'profiles', subjectId: 'u1', from: '2026-11-01', to: '2026-11-30', before: 1001,
  });
  assert('Se lee de hr_audit_logs, lo más reciente primero', qCalls.some((c) => c[0] === 'from' && c[1] === 'hr_audit_logs') && qCalls.some((c) => c[0] === 'order' && c[1] === 'id' && c[2].ascending === false));
  assert('Pide una fila de más para saber si hay otra página', qCalls.some((c) => c[0] === 'limit' && c[1] === AUDIT_PAGE_SIZE + 1) && page.hasMore === true && page.rows.length === AUDIT_PAGE_SIZE);
  assert('Aplica los filtros de elemento y persona', qCalls.some((c) => c[0] === 'eq' && c[1] === 'entity_type' && c[2] === 'profiles') && qCalls.some((c) => c[0] === 'eq' && c[1] === 'subject_id' && c[2] === 'u1'));
  assert('Aplica el rango de fechas, ambos días incluidos', qCalls.some((c) => c[0] === 'gte' && c[2] === '2026-11-01T00:00:00') && qCalls.some((c) => c[0] === 'lte' && c[2].startsWith('2026-11-30T23:59:59')));
  assert('La siguiente página continúa tras la última fila', qCalls.some((c) => c[0] === 'lt' && c[1] === 'id' && c[2] === 1001));
  const lastPage = await fetchAuditLog(fakeClient({ data: [{ id: 1 }], error: null }));
  assert('Sin más filas no ofrece otra página', lastPage.hasMore === false);
  const denied = await fetchAuditLog(fakeClient({ data: null, error: { code: '42501', message: 'denied' } }));
  assert('Un rechazo se devuelve como error', denied.error?.code === '42501');
  const purgeCalls = [];
  await purgeAuditLog(fakeClient({ data: 3, error: null }, purgeCalls), 400);
  assert('La purga usa la función del servidor', purgeCalls.some((c) => c[0] === 'rpc' && c[1] === 'purge_hr_audit_logs' && c[2].p_older_than_days === 400));

  console.warn = warn;
  console.error = logError;

  // 4. Migración
  const root = process.cwd();
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
  const sql = read('supabase', 'migrations', '20261123130000_hr_foundations.sql');
  assert('Departamentos: lectura para la plantilla, escritura solo admins', sql.includes('departments_select on public.departments for select to authenticated\n  using (public.is_employee())') && sql.includes('using (public.is_admin()) with check (public.is_admin())'));
  assert('Las fichas referencian el departamento y siguen su nombre', sql.includes('references public.departments (name) on update cascade on delete restrict'));
  assert('Se cargan los departamentos existentes antes de la clave foránea', sql.indexOf('select distinct department from public.profiles') < sql.indexOf('add constraint profiles_department_fkey'));
  assert('Un departamento vacío se guarda como null', sql.includes("nullif(btrim(new.department), '')"));
  assert('El departamento de noticias no se puede renombrar', sql.includes("old.name = 'Comunicación - marketing'"));
  assert('Historial: solo los admins lo leen', sql.includes('hr_audit_logs for select to authenticated\n  using (public.is_admin())'));
  assert('Historial: nadie escribe ni borra desde la API', sql.includes('revoke all on public.hr_audit_logs from anon, authenticated;') && sql.includes('grant select on public.hr_audit_logs to authenticated;') && !/create policy\s+\w+\s+on public\.hr_audit_logs for (insert|update|delete|all)/.test(sql));
  assert('Historial: la captura corre en el servidor con su propio search_path', /function hr_private\.capture_audit\(\)[\s\S]*?security definer\s+set search_path = ''/.test(sql));
  assert('El valor del DNI nunca se guarda', sql.includes("('profile_private',    'id',           '',                              'dni')") && sql.includes("jsonb_build_object('changed', true)"));
  assert('Archivos incrustados largos no se copian al historial', sql.includes('[omitido: '));
  assert('Se audita lo sensible de RR. HH.', ['profiles', 'profile_private', 'departments', 'documents', 'requests', 'personal_days', 'hour_compensations'].every((t) => sql.includes(`('${t}',`)));
  assert('Conservación: mínimo un año y la purga queda registrada', sql.includes('p_older_than_days < 365') && sql.includes("'purge', 'hr_audit_logs'"));
  assert('Migración transaccional y sin borrar tablas', sql.includes('begin;') && sql.includes('commit;') && !/\bdrop\s+table\b|\btruncate\b/i.test(sql));

  // 5. Interfaz
  const page1 = read('src', 'pages', 'AdminPage.jsx');
  assert('Web: el formulario de empleado usa los departamentos de la base de datos', page1.includes('departmentOptions(departments, editEmp?.dept)') && !page1.includes('const DEPARTMENTS = ['));
  const desk = read('src', 'pages', 'AdminDesk.jsx');
  assert('Escritorio: pestañas Departamentos e Historial', desk.includes("value: 'departments'") && desk.includes("value: 'audit'") && desk.includes('hrPanels.audit'));
  const touch = read('src', 'pages', 'AdminTouch.jsx');
  assert('Táctil: se abren desde Organización y se puede volver', touch.includes("setTab('departments')") && touch.includes("setTab('audit')") && touch.includes("setTab('employees')"));
  const audit = read('src', 'pages', 'admin', 'AuditPanel.jsx');
  assert('Historial: carga, error, vacío y más páginas', audit.includes("'loading'") && audit.includes("'error'") && audit.includes('Aún no hay cambios registrados') && audit.includes('load(true)'));
  assert('El historial no se precarga para nadie', !read('src', 'context', 'index.jsx').includes('hr_audit_logs') && !read('mobile', 'src', 'context', 'DataContext.js').includes('hr_audit_logs'));
  const deptPanel = read('src', 'pages', 'admin', 'DepartmentsPanel.jsx');
  assert('Departamentos: solo se borra uno sin personas', deptPanel.includes('peopleOf(d) === 0'));
  const appForm = read('mobile', 'src', 'screens', 'admin', 'UserFormScreen.jsx');
  assert('App: el formulario de empleado usa los departamentos de la base de datos', appForm.includes('departmentOptions(departments, existing?.dept)'));

  return { passed, failed };
}
