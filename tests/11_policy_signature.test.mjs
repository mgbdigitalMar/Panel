import fs from 'fs';
import path from 'path';
import {
  normalizeStrokes, isSignatureComplete, strokesToPath, signInternalPolicy, fetchPolicySignatures,
  latestSignatureByUser, policyStatus, formatSignedAt, SIGNATURE_BOX,
} from '../shared/services/policy.js';

export async function runPolicySignatureTests() {
  console.log('\n🔵 [SUITE 11: Firma de las normas internas]');
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

  // 1. Trazos: del recuadro de cada dispositivo al formato guardado (1000 x 400)
  const n = normalizeStrokes([[[0, 0], [50, 20], [50, 20], [100, 40], [200, 30]]], 100, 40);
  assert('Se escala al recuadro 1000 x 400', n[0][1][0] === 500 && n[0][1][1] === 200);
  assert('Los puntos repetidos se quitan', n[0].length === 4);
  assert('Lo que sale del recuadro por la derecha se recorta', n[0][3][0] === SIGNATURE_BOX.width && n[0][3][1] === 300);
  assert('Lo que sale por abajo se recorta', normalizeStrokes([[[0, 0], [10, 99]]], 100, 40)[0][1][1] === SIGNATURE_BOX.height);
  assert('Sin tamaño no hay trazos', normalizeStrokes([[[1, 1]]], 0, 0).length === 0);
  assert('Los trazos vacíos se descartan', normalizeStrokes([[], [[1, 1]]], 10, 10).length === 1);

  // 2. ¿Es una firma? (mismo criterio que sign_internal_policy en el servidor)
  const line = (x0, x1, pts) => Array.from({ length: pts }, (_, i) => [x0 + ((x1 - x0) * i) / (pts - 1), 200]);
  assert('Firma normal: completa', isSignatureComplete([line(100, 600, 30)]));
  assert('Un punto no es una firma', !isSignatureComplete([[[10, 10]]]));
  assert('Menos de 10 puntos no es una firma', !isSignatureComplete([line(100, 600, 9)]));
  assert('Una raya de menos de 60 de ancho no es una firma', !isSignatureComplete([line(100, 150, 30)]));
  assert('Sin trazos no es una firma', !isSignatureComplete([]) && !isSignatureComplete(null));

  // 3. Dibujo
  assert('Trazo → path SVG', strokesToPath([[[1, 2], [3, 4]]]) === 'M1 2 L3 4');
  assert('Un toque se dibuja como punto', strokesToPath([[[5, 5]]]) === 'M5 5 l0.1 0');
  assert('Varios trazos', strokesToPath([[[1, 1], [2, 2]], [[3, 3], [4, 4]]]) === 'M1 1 L2 2 M3 3 L4 4');

  // 4. Firmar y leer
  const calls = [];
  const rpcOk = { rpc: async (fn, args) => { calls.push([fn, args]); return { data: '2026-10-27T08:41:00Z', error: null }; } };
  const res = await signInternalPolicy(rpcOk, { signerName: 'Ana García', strokes: [line(100, 600, 30)], platform: 'web' });
  assert('Firma con sign_internal_policy y devuelve la fecha del servidor', calls[0][0] === 'sign_internal_policy' && res.signedAt === '2026-10-27T08:41:00Z');
  assert('El título del documento por defecto se envía', calls[0][1].p_document_title === 'Procedimiento normas internas 2026');
  assert('No se envía ninguna fecha desde el cliente', !Object.keys(calls[0][1]).some(k => /date|_at$/.test(k)));
  const { warn } = console;
  console.warn = () => {};
  const bad = await signInternalPolicy({ rpc: async () => ({ data: null, error: { code: 'P0001', message: 'La firma es demasiado corta' } }) }, { signerName: 'A', strokes: [] });
  assert('Un rechazo del servidor llega como error', bad.error?.code === 'P0001');

  const rows = [
    { id: 1, user_id: 'a', signer_name: 'Ana', strokes: [], document_title: 'D', document_url: null, platform: 'web', user_agent: null, signed_at: '2026-10-01T10:00:00Z' },
    { id: 2, user_id: 'a', signer_name: 'Ana', strokes: [], document_title: 'D', document_url: null, platform: 'ios', user_agent: null, signed_at: '2026-10-20T10:00:00Z' },
    { id: 3, user_id: 'b', signer_name: 'Beto', strokes: [], document_title: 'D', document_url: null, platform: 'android', user_agent: null, signed_at: '2026-10-05T10:00:00Z' },
  ];
  const q = (result) => ({ from: () => { const x = { select: () => x, order: () => x, then: (r) => r(result) }; return x; } });
  const list = await fetchPolicySignatures(q({ data: rows, error: null }));
  assert('fetchPolicySignatures mapea las filas', list.length === 3 && list[0].userId === 'a' && list[0].signerName === 'Ana');
  assert('Un fallo al cargar devuelve null', (await fetchPolicySignatures(q({ data: null, error: { message: 'x' } }))) === null);
  console.warn = warn;
  const latest = latestSignatureByUser(list);
  assert('Se toma la última firma de cada persona', latest.a.id === 2 && latest.b.id === 3);

  // 5. Estado de cada persona
  assert('Aceptadas y firmadas → signed', policyStatus({ policyAccepted: true }, latest.a) === 'signed');
  assert('Aceptadas sin firma (RRHH) → manual', policyStatus({ policyAccepted: true }, undefined) === 'manual');
  assert('Pedida nueva firma → pending aunque haya una anterior', policyStatus({ policyAccepted: false }, latest.a) === 'pending');
  assert('Fecha en hora de Madrid', formatSignedAt('2026-10-27T08:41:00Z') === '27/10/2026, 09:41');

  // 6. Servidor
  const root = process.cwd();
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
  const sql = read('supabase', 'migrations', '20261027130000_policy_signatures.sql');
  assert('Los clientes solo pueden leer la tabla de firmas', sql.includes('revoke all on public.policy_signatures from anon, authenticated;') && sql.includes('grant select on public.policy_signatures to authenticated;'));
  assert('No hay políticas de escritura (nadie edita ni borra firmas)', !/policy_signatures for (insert|update|delete|all)/.test(sql));
  assert('Cada uno ve la suya; RRHH todas', sql.includes('using (user_id = auth.uid() or public.is_admin())'));
  assert('La fecha la pone el servidor', sql.includes('signed_at      timestamptz not null default now()') && !sql.includes('p_signed_at'));
  assert('La firma se guarda a nombre de quien firma (auth.uid())', sql.includes('auth.uid(), v_name, p_strokes'));
  assert('El servidor valida la firma (puntos y anchura)', sql.includes('v_points < 10 or v_max_x - v_min_x < 60'));
  assert('Un empleado ya no acepta las normas sin firmar',
    sql.includes("v_own text[] := array['work_mode', 'first_login', 'telework_applied_on', 'updated_at'];") && sql.includes("current_setting('margube.policy_signing', true) = 'on'"));
  assert('La plantilla sin firma vuelve a tener las normas pendientes',
    sql.includes('set policy_accepted = false') && sql.includes('not exists (select 1 from public.policy_signatures s where s.user_id = p.id)'));

  // 7. Pantallas
  const modal = read('src', 'components', 'PolicyModal.jsx');
  assert('Web: el modal firma con signInternalPolicy', modal.includes('signInternalPolicy(supabase') && modal.includes('<SignaturePad'));
  assert('Web: ya no acepta las normas sin firma', !modal.includes('policyAccepted: true'));
  assert('Web: se pide nombre, firma y aceptación', modal.includes('Nombre y apellidos') && modal.includes('He leído y acepto'));
  assert('Web: Layout actualiza la sesión al firmar', read('src', 'components', 'Layout.jsx').includes('onSigned={() => { patchUser({ policyAccepted: true })'));
  const admin = read('src', 'pages', 'AdminPage.jsx');
  assert('Web admin: ve la firma, la fecha y el documento', admin.includes('<SignatureView strokes={sig.strokes}') && admin.includes('Fecha y hora'));
  assert('Web admin: registro de firmas en CSV', admin.includes('firmas-normas-internas-'));
  assert('Web admin: puede pedir una nueva firma o marcarlas sin firma', admin.includes('Pedir que vuelva a firmar') && admin.includes('Marcar como aceptadas sin firma'));
  assert('Web admin: al editar un empleado se ve su firma', admin.includes('Firma de las normas internas') && admin.includes('const sig = lastSignature[editEmp.id]'));
  assert('Web admin: al editar se recargan las firmas', admin.includes('loadSignatures(); // they may have signed since the page was opened'));
  const form = read('mobile', 'src', 'screens', 'admin', 'UserFormScreen.jsx');
  assert('App admin: al editar un empleado se ve su firma', form.includes('<SignatureView strokes={signature.strokes}') && form.includes('Firma de las normas internas'));
  assert('Web perfil: la persona ve su propia firma', read('src', 'pages', 'ProfilePage.jsx').includes('Tu firma de las normas internas'));
  const screen = read('mobile', 'src', 'screens', 'PolicyScreen.jsx');
  assert('App: la pantalla firma con signInternalPolicy', screen.includes('signInternalPolicy(supabase') && screen.includes('<SignaturePad'));
  assert('App: ya no acepta las normas sin firma', !screen.includes('setCurrentUser({ policyAccepted: true })'));
  const users = read('mobile', 'src', 'screens', 'admin', 'AdminUsersScreen.jsx');
  assert('App admin: ve las firmas y filtra las pendientes', users.includes('fetchPolicySignatures(supabase)') && users.includes("value: 'policy'") && users.includes('<SignatureView'));

  return { passed, failed };
}
