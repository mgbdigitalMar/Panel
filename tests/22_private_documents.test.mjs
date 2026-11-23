import fs from 'fs';
import path from 'path';
import {
  storagePathFromUrl, storageRefUrl, signFileUrls, removeStorageFile,
  DOCUMENTS_BUCKET, SIGNED_URL_TTL_SECONDS, SIGNED_URL_REFRESH_MS,
} from '../shared/services/storageFiles.js';
import { fetchDocuments, uploadDocumentFile } from '../shared/services/documents.js';
import { fetchPersonalDays } from '../shared/services/personalDays.js';

export async function runPrivateDocumentsTests() {
  console.log('\n🔵 [SUITE 22: Documentos privados (nóminas, contratos y justificantes)]');
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

  const base = 'https://proj.supabase.co/storage/v1/object';
  const { warn, error: logError } = console;
  console.warn = () => {};
  console.error = () => {};

  // 1. Referencias a objetos del bucket
  assert('Ruta de una URL pública antigua', storagePathFromUrl(`${base}/public/documents/docs/1_a.pdf`) === 'docs/1_a.pdf');
  assert('Ruta de una referencia autenticada', storagePathFromUrl(`${base}/authenticated/documents/docs/1_a.pdf`) === 'docs/1_a.pdf');
  assert('Ruta de una URL firmada, sin el token', storagePathFromUrl(`${base}/sign/documents/docs/1_a.pdf?token=abc`) === 'docs/1_a.pdf');
  assert('Ruta codificada se decodifica', storagePathFromUrl(`${base}/authenticated/documents/docs/n%C3%B3mina.pdf`) === 'docs/nómina.pdf');
  assert('Una ruta con .. no se acepta', storagePathFromUrl(`${base}/authenticated/documents/docs/../x.pdf`) === null);
  assert('Otro bucket no es nuestro', storagePathFromUrl(`${base}/public/avatars/a.png`) === null);
  assert('data: y enlaces externos no son del bucket', storagePathFromUrl('data:application/pdf;base64,AA') === null && storagePathFromUrl('https://example.com/a.pdf') === null);
  assert('Valores vacíos no fallan', storagePathFromUrl(null) === null && storagePathFromUrl(undefined) === null);

  // 2. Cliente simulado de Supabase
  function fakeClient({ sign = 'ok', rows = [], calls = [] } = {}) {
    const bucketApi = (bucket) => ({
      getPublicUrl: (p) => ({ data: { publicUrl: `${base}/public/${bucket}/${p}` } }),
      createSignedUrls: async (paths, ttl) => {
        calls.push({ op: 'sign', bucket, paths, ttl });
        if (sign === 'throw') throw new Error('offline');
        if (sign === 'error') return { data: null, error: { message: 'denied' } };
        return {
          data: paths.map((p) => (p.includes('denied')
            ? { path: p, signedUrl: null, error: 'Object not found' }
            : { path: p, signedUrl: `${base}/sign/${bucket}/${p}?token=t`, error: null })),
          error: null,
        };
      },
      remove: async (paths) => { calls.push({ op: 'remove', bucket, paths }); return { error: null }; },
      upload: async (p) => { calls.push({ op: 'upload', bucket, path: p }); return { error: null }; },
    });
    const q = { select: () => q, order: () => q, eq: () => q, then: (res) => res({ data: rows, error: null }) };
    return { storage: { from: bucketApi }, from: () => q };
  }

  assert('La referencia guardada no es pública', storageRefUrl(fakeClient(), 'docs/1_a.pdf') === `${base}/authenticated/documents/docs/1_a.pdf`);
  assert('Bucket, caducidad y renovación coherentes', DOCUMENTS_BUCKET === 'documents' && SIGNED_URL_REFRESH_MS < SIGNED_URL_TTL_SECONDS * 1000);

  // 3. Firma de listas
  const calls = [];
  const input = [
    { id: 1, fileUrl: `${base}/authenticated/documents/docs/1_a.pdf` },
    { id: 2, fileUrl: `${base}/public/documents/docs/1_a.pdf` },
    { id: 3, fileUrl: `${base}/authenticated/documents/docs/denied.pdf` },
    { id: 4, fileUrl: 'data:application/pdf;base64,AA' },
    { id: 5, fileUrl: null },
  ];
  const out = await signFileUrls(fakeClient({ calls }), input);
  const signCalls = calls.filter((c) => c.op === 'sign');
  assert('Una sola petición de firma para toda la lista, sin rutas repetidas', signCalls.length === 1 && signCalls[0].paths.length === 2);
  assert('La firma caduca (TTL por defecto)', signCalls[0].ttl === SIGNED_URL_TTL_SECONDS);
  assert('Cada archivo recibe su URL firmada', out[0].fileUrl.includes('/object/sign/documents/docs/1_a.pdf?token=') && out[1].fileUrl === out[0].fileUrl);
  assert('Se conserva la referencia guardada en fileRef', out[0].fileRef === input[0].fileUrl && out[1].fileRef === input[1].fileUrl);
  assert('Un archivo que Storage no firma no muestra enlace', out[2].fileUrl === null && out[2].fileRef === input[2].fileUrl);
  assert('data: y filas sin archivo no cambian', out[3].fileUrl === input[3].fileUrl && out[4].fileUrl === null);
  assert('La lista original no se modifica', input[0].fileUrl.includes('/authenticated/'));
  const offline = await signFileUrls(fakeClient({ sign: 'throw' }), input);
  assert('Sin red no se expone ninguna referencia como enlace', offline[0].fileUrl === null && offline[0].fileRef === input[0].fileUrl);
  const refused = await signFileUrls(fakeClient({ sign: 'error' }), input);
  assert('Un rechazo de Storage deja los archivos sin enlace', refused.every((r, i) => i >= 3 || r.fileUrl === null));
  assert('Una lista vacía no hace peticiones', (await signFileUrls(fakeClient(), [])).length === 0);

  // 4. Servicios compartidos (web y app)
  const docs = await fetchDocuments(fakeClient({ rows: [{ id: 'd', title: 'Nómina', file_url: `${base}/authenticated/documents/docs/n.pdf` }] }));
  assert('fetchDocuments devuelve URLs firmadas', docs[0].fileUrl.includes('/object/sign/') && docs[0].fileRef.includes('/object/authenticated/'));
  const days = await fetchPersonalDays(fakeClient({ rows: [{ id: 'p', date: '2026-12-01', file_url: `${base}/public/documents/docs/j.pdf` }] }));
  assert('fetchPersonalDays firma los justificantes', days[0].fileUrl.includes('/object/sign/'));
  const upCalls = [];
  const up = await uploadDocumentFile(fakeClient({ calls: upCalls }), new Uint8Array(4), 'nomina.pdf', 4, 'application/pdf');
  assert('Subir devuelve la referencia autenticada, no la pública', up.url.includes('/object/authenticated/documents/docs/') && !up.url.includes('/object/public/'));
  assert('Las subidas van a docs/', upCalls[0]?.path.startsWith('docs/'));
  const rmCalls = [];
  await removeStorageFile(fakeClient({ calls: rmCalls }), `${base}/sign/documents/docs/1_a.pdf?token=t`);
  assert('Borrar con una URL firmada elimina el objeto correcto', rmCalls[0]?.paths[0] === 'docs/1_a.pdf');
  const rmNone = [];
  await removeStorageFile(fakeClient({ calls: rmNone }), 'https://example.com/x.pdf');
  assert('Un enlace ajeno al bucket no borra nada', rmNone.length === 0);

  console.warn = warn;
  console.error = logError;

  // 5. Código: ningún enlace público ni rutas a mano
  const root = process.cwd();
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(rel);
    return /\.(jsx?|tsx?|mjs)$/.test(e.name) ? [rel] : [];
  });
  const sources = [...walk('src'), ...walk('shared'), ...walk(path.join('mobile', 'src'))];
  const publicUrlUsers = sources.filter((f) => read(f).includes('getPublicUrl') && !f.endsWith('storageFiles.js'));
  assert('Nadie pide URLs públicas del bucket (solo se construye la referencia)', publicUrlUsers.length === 0);
  const manualPaths = sources.filter((f) => read(f).includes('/object/public/documents/'));
  assert('No quedan rutas públicas escritas a mano', manualPaths.length === 0);

  const web = read('src', 'context', 'index.jsx');
  assert('Web: documentos y justificantes se firman al cargarse', (web.match(/signFileUrls\(supabase/g) || []).length >= 2);
  assert('Web: las firmas se renuevan antes de caducar', web.includes('SIGNED_URL_REFRESH_MS') && web.includes('clearInterval(resignTimer)'));
  assert('Web: el borrado usa la referencia guardada', web.includes('row?.fileRef || row?.fileUrl'));
  const app = read('mobile', 'src', 'context', 'DataContext.js');
  assert('App: las firmas se renuevan antes de caducar', app.includes('svc.SIGNED_URL_REFRESH_MS') && app.includes('clearInterval(resignTimer)'));
  assert('App: el borrado usa la referencia guardada', app.includes('doc.fileRef || doc.fileUrl') && app.includes('item.fileRef || item.fileUrl'));

  // 6. Migración
  const sql = read('supabase', 'migrations', '20261123120000_private_documents.sql');
  assert('El bucket documents pasa a privado', /values \('documents', 'documents', false/.test(sql) && sql.includes('set public = false'));
  assert('Límite de 15 MB también en el servidor', sql.includes('15728640'));
  assert('Las referencias guardadas dejan de ser públicas', (sql.match(/replace\(file_url, '\/storage\/v1\/object\/public\/documents\/', '\/storage\/v1\/object\/authenticated\/documents\/'\)/g) || []).length === 2);
  assert('Un archivo ajeno no se lee apuntándolo desde una fila propia', sql.includes('objects.owner_id = d.sender_id::text') && sql.includes('objects.owner_id = p.employee_id::text'));
  assert('Las subidas solo van a docs/', sql.includes("(storage.foldername(name))[1] = 'docs'"));
  assert('La migración es transaccional y no borra datos', sql.includes('begin;') && sql.includes('commit;') && !/\bdelete\s+from\b|\bdrop\s+table\b|\btruncate\b/i.test(sql));

  return { passed, failed };
}
