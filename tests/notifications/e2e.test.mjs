// Prueba de integración del sistema de notificaciones sobre un Supabase local en Docker:
// Postgres, pg_cron, pgmq, pg_net, Realtime, Auth y la Edge Function son los reales. Solo se
// simulan Expo y el servicio Web Push (descifrando el payload como lo haría el navegador).
//
//   npm run test:notifications            usa un proyecto temporal aparte y lo deja arrancado
//   npm run test:notifications -- --stop  lo para al terminar
//
// No toca producción ni otros proyectos locales: usa sus propios contenedores y puertos 553xx.
// Lo que requiere un móvil o un iPhone físico está en docs/NOTIFICACIONES.md.
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createECDH, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const webpush = require('web-push');
const ece = require('http_ece');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WORKDIR = process.env.E2E_WORKDIR || join(tmpdir(), 'margube-notifications-e2e');
const ID_TYPE = process.env.E2E_ID_TYPE === 'bigint'
  ? 'bigint generated always as identity primary key'
  : 'uuid primary key default gen_random_uuid()';
const PROJECT = 'margube-e2e';
const API_URL = 'http://127.0.0.1:55321';
const MOCK_PORT = 54999;
const WORKER_SECRET = 'e2e-worker-secret';
const GENERIC_BODY = 'Tienes una nueva notificación.';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

let passed = 0;
const failures = [];
function check(name, ok, extra) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ❌ ${name}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''}`);
  }
}
const section = (s) => console.log(`\n${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 20_000, every = 400) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) return value;
    await sleep(every);
  }
}

// --- Stack local --------------------------------------------------------------------------------

function supabaseCli(args) {
  return execFileSync(NPX, ['--yes', 'supabase@latest', ...args], {
    cwd: WORKDIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32',
  });
}

function prepareProject() {
  const dir = join(WORKDIR, 'supabase');
  mkdirSync(join(dir, 'migrations'), { recursive: true });
  for (const f of readdirSync(join(ROOT, 'supabase/migrations'))) {
    copyFileSync(join(ROOT, 'supabase/migrations', f), join(dir, 'migrations', f));
  }
  writeFileSync(
    join(dir, 'migrations/20260101000000_baseline.sql'),
    readFileSync(join(ROOT, 'tests/notifications/baseline_schema.sql'), 'utf8').replaceAll(':id_type', ID_TYPE),
  );
  cpSync(join(ROOT, 'supabase/functions/notifications-worker'), join(dir, 'functions/notifications-worker'), { recursive: true });

  writeFileSync(join(dir, 'config.toml'), `project_id = "${PROJECT}"
[api]
port = 55321
[db]
major_version = 17
port = 55322
shadow_port = 55320
[studio]
enabled = false
[analytics]
enabled = false
[db.pooler]
enabled = false
[edge_runtime]
inspector_port = 55083
[functions.notifications-worker]
verify_jwt = false
`);

  const envFile = join(dir, 'functions/.env');
  if (!existsSync(envFile)) {
    const keys = webpush.generateVAPIDKeys();
    writeFileSync(envFile, [
      `NOTIFICATIONS_WORKER_SECRET=${WORKER_SECRET}`,
      `EXPO_API_BASE=http://host.docker.internal:${MOCK_PORT}/expo`,
      `VAPID_PUBLIC_KEY=${keys.publicKey}`,
      `VAPID_PRIVATE_KEY=${keys.privateKey}`,
      'VAPID_SUBJECT=mailto:test@example.com',
      '',
    ].join('\n'));
  }
  supabaseCli(['start', '-x', 'studio,imgproxy,mailpit,logflare,vector,supavisor,postgres-meta']);
  // Siempre desde cero: aplica las migraciones actuales y no arrastra datos de otra ejecución
  supabaseCli(['db', 'reset']);
}

function sql(query) {
  return execFileSync('docker', ['exec', '-i', `supabase_db_${PROJECT}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA'], {
    input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const count = (query) => Number(sql(`select count(*) from (${query}) x`));

// --- Proveedores simulados ----------------------------------------------------------------------

const mock = { expo: [], web: [], receipts: {}, expoMode: 'ok', webMode: {}, expoCalls: 0 };

function expoTicket(mode) {
  if (mode === 'device_not_registered') {
    return { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } };
  }
  return { status: 'ok', id: `ticket-${randomBytes(6).toString('hex')}` };
}

const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(data === undefined ? '' : JSON.stringify(data));
    };
    if (req.url === '/expo/send') {
      mock.expoCalls++;
      if (mock.expoMode === '503') return reply(503, { errors: [{ code: 'INTERNAL' }] });
      const messages = JSON.parse(body.toString());
      mock.expo.push(...messages);
      return reply(200, { data: messages.map(() => expoTicket(mock.expoMode)) });
    }
    if (req.url === '/expo/getReceipts') {
      const { ids } = JSON.parse(body.toString());
      return reply(200, { data: Object.fromEntries(ids.filter((id) => mock.receipts[id]).map((id) => [id, mock.receipts[id]])) });
    }
    if (req.url.startsWith('/web/')) {
      const id = req.url.slice(5);
      const mode = mock.webMode[id];
      if (mode) return reply(mode);
      mock.web.push({ id, headers: req.headers, body });
      return reply(201);
    }
    return reply(404);
  });
});

function newBrowser() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return { id: randomBytes(6).toString('hex'), ecdh, auth, p256dh: ecdh.getPublicKey().toString('base64url'), authB64: auth.toString('base64url') };
}
function decryptWebPush(browser, body) {
  return JSON.parse(ece.decrypt(body, {
    version: 'aes128gcm', privateKey: browser.ecdh, authSecret: browser.auth.toString('base64url'),
  }).toString());
}

// --- Datos --------------------------------------------------------------------------------------

async function createUser(name, role) {
  const email = `${name.toLowerCase()}.${randomBytes(3).toString('hex')}@example.com`;
  const id = sql(`
    select gen_random_uuid()::text \\gset
    insert into public.profiles (id, email, name, role, first_login, policy_accepted)
      values (:'gen_random_uuid', ${lit(email)}, ${lit(name)}, ${lit(role)}, false, true)
      returning id;
    select public.create_auth_account(id, email, extensions.crypt('e2e-password', extensions.gen_salt('bf', 10)))
      from public.profiles where email = ${lit(email)};
  `).split('\n')[0];
  const client = createClient(API_URL, process.env.E2E_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: 'e2e-password' });
  if (error) throw new Error(`signIn ${name}: ${error.message}`);
  return { id, name, email, client };
}

function addExpoDevice(user) {
  const token = `ExponentPushToken[${randomBytes(8).toString('hex')}]`;
  sql(`insert into public.push_tokens (user_id, token, platform) values (${lit(user.id)}, ${lit(token)}, 'android')`);
  return token;
}
function addWebDevice(user) {
  const browser = newBrowser();
  const endpoint = `http://host.docker.internal:${MOCK_PORT}/web/${browser.id}`;
  sql(`insert into public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
       values (${lit(user.id)}, ${lit(endpoint)}, ${lit(browser.p256dh)}, ${lit(browser.authB64)})`);
  return browser;
}

const inbox = (user) => sql(`select coalesce(json_agg(n order by created_at desc), '[]') from public.notifications n where user_id = ${lit(user.id)}`);
const inboxRows = (user) => JSON.parse(inbox(user));
const deliveriesOf = (eventId) => JSON.parse(sql(`select coalesce(json_agg(d), '[]') from notif_private.deliveries d where event_id = ${lit(eventId)}`));
const queued = (eventId) => count(`select 1 from pgmq.q_notification_jobs where message->>'event_id' = ${lit(eventId)}`);
const dispatch = (eventId) => sql(`select dispatch_status from public.notifications where event_id = ${lit(eventId)}`);

async function newRequestFor(user) {
  const { data, error } = await user.client.from('requests').insert({
    employee_id: user.id, type: 'remoto', status: 'pending', reason: 'Motivo PRIVADO', start_date: '2099-01-10', end_date: '2099-01-12',
  }).select().single();
  if (error) throw new Error(`insert request: ${error.message}`);
  return data;
}

// --- Escenarios ---------------------------------------------------------------------------------

async function main() {
  prepareProject();
  const status = JSON.parse(supabaseCli(['status', '-o', 'json']));
  process.env.E2E_PUBLISHABLE_KEY = status.PUBLISHABLE_KEY;
  await new Promise((r) => server.listen(MOCK_PORT, '0.0.0.0', r));

  const workerUrl = `http://supabase_kong_${PROJECT}:8000/functions/v1/notifications-worker`;
  sql(`select notif_private.set_worker_config(${lit(workerUrl)}, ${lit(WORKER_SECRET)})`);

  const admin = await createUser('Ana Admin', 'admin');
  const emp = await createUser('Eva Empleada', 'employee');
  const other = await createUser('Otto Otro', 'employee');

  section('Canal privado y aislamiento (Realtime Broadcast)');
  const received = { created: [], updated: [], sync: 0 };
  let joined = false;
  const { subscribeToNotifications } = await import('../../shared/services/notifications.js');
  const closeEmp = subscribeToNotifications(emp.client, emp.id, {
    onCreated: (row) => received.created.push(row),
    onUpdated: (p) => received.updated.push(p),
    onSync: () => { joined = true; received.sync++; },
  });
  await until(() => joined, 15_000);
  check('La persona entra en su canal privado', joined);

  const spy = { events: 0, status: null };
  await other.client.realtime.setAuth();
  const spyChannel = other.client.channel(`user:${emp.id}:notifications`, { config: { private: true } })
    .on('broadcast', { event: '*' }, () => { spy.events++; })
    .subscribe((s) => { spy.status = s; });
  await until(() => spy.status && spy.status !== 'SUBSCRIBED' ? spy.status : false, 8000);
  check('Otro empleado no puede entrar en un canal ajeno', spy.status !== 'SUBSCRIBED', spy.status);

  section('1-2. Nueva solicitud: el destinatario correcto y sin datos en la pantalla bloqueada');
  const adminToken = addExpoDevice(admin);
  const adminBrowser = addWebDevice(admin);
  const req = await newRequestFor(emp);
  const adminNotif = (await until(() => inboxRows(admin).find((n) => n.entity_id === String(req.id))));
  check('El administrador tiene el aviso en su bandeja', Boolean(adminNotif));
  check('El texto interno es el real', adminNotif?.title === '📋 Nueva solicitud: Remoto' && /Eva Empleada/.test(adminNotif?.body), adminNotif?.title);
  check('Quien crea la solicitud no recibe aviso', !inboxRows(emp).some((n) => n.entity_id === String(req.id)));

  await until(() => mock.expo.some((m) => m.to === adminToken) && mock.web.some((w) => w.id === adminBrowser.id));
  const expoMsg = mock.expo.find((m) => m.to === adminToken);
  check('La petición llega a Expo por webhook, en segundos', Boolean(expoMsg));
  check('Expo: título y cuerpo genéricos', expoMsg?.title === 'Margube' && expoMsg?.body === GENERIC_BODY, expoMsg);
  check('Expo: los datos no llevan contenido', expoMsg && !/Eva|PRIVADO|solicitud/i.test(JSON.stringify(expoMsg.data)), expoMsg?.data);
  check('Expo: canal Android y prioridad alta', expoMsg?.channelId === 'default' && expoMsg?.priority === 'high');

  const webMsg = mock.web.find((w) => w.id === adminBrowser.id);
  check('Web Push lleva firma VAPID', /^vapid t=/.test(webMsg?.headers?.authorization || ''));
  const webPayload = webMsg && decryptWebPush(adminBrowser, webMsg.body);
  check('Web Push se descifra con las claves del navegador', webPayload?.title === 'Margube' && webPayload?.body === GENERIC_BODY, webPayload);
  check('Web Push: enlace al módulo y sin contenido', webPayload?.url === '/requests' && !/Eva|PRIVADO/.test(JSON.stringify(webPayload)), webPayload);
  check('El cuerpo cifrado no contiene el texto en claro', webMsg && !webMsg.body.toString().includes('Margube'));

  await until(() => dispatch(adminNotif.event_id) === 'processed');
  const adminDeliveries = deliveriesOf(adminNotif.event_id);
  check('Trabajo procesado', dispatch(adminNotif.event_id) === 'processed');
  check('Un registro por dispositivo y canal', adminDeliveries.length === 2 && new Set(adminDeliveries.map((d) => d.channel)).size === 2, adminDeliveries.length);
  check('Estado: aceptado por el proveedor, no "entregado"', adminDeliveries.every((d) => d.status === 'provider_accepted'), adminDeliveries.map((d) => d.status));
  check('Expo guarda el ticket', Boolean(adminDeliveries.find((d) => d.channel === 'expo')?.expo_ticket_id));
  check('El trabajo sale de la cola solo al terminar', queued(adminNotif.event_id) === 0);
  check('El mensaje de la cola solo llevaba el identificador', count(`select 1 from pgmq.a_notification_jobs where message->>'event_id' = ${lit(adminNotif.event_id)} and message - 'event_id' = '{}'::jsonb`) === 1);

  section('3-4. Cambio de estado, tiempo real y duplicados');
  const empToken = addExpoDevice(emp);
  const beforeApprove = inboxRows(emp).length;
  const { error: approveErr } = await admin.client.from('requests')
    .update({ status: 'approved', reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq('id', req.id);
  check('El administrador aprueba', !approveErr, approveErr?.message);
  await until(() => inboxRows(emp).length > beforeApprove);
  const empNotif = inboxRows(emp)[0];
  check('El empleado recibe "aprobada"', empNotif?.title === '✅ Solicitud aprobada' && empNotif?.type === 'success', empNotif?.title);
  await until(() => received.created.some((n) => n.event_id === empNotif?.event_id), 8000);
  const live = received.created.find((n) => n.event_id === empNotif?.event_id);
  check('Llega por Broadcast al instante, sin consultar', Boolean(live) && live.title === empNotif.title);
  check('Broadcast no expone campos internos', live && !('dedupe_key' in live) && !('actor_id' in live));
  await until(() => mock.expo.some((m) => m.to === empToken));
  check('Y como push a su móvil', mock.expo.some((m) => m.to === empToken));

  await admin.client.from('requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.id);
  await admin.client.from('requests').update({ reason: 'editada' }).eq('id', req.id);
  await sleep(1200);
  check('Actualizar otra vez la solicitud no crea otro aviso', inboxRows(emp).filter((n) => n.entity_id === String(req.id)).length === 1);

  sql(`select public.notif_worker_prepare(${lit(empNotif.event_id)})`);
  sql(`select public.notif_worker_prepare(${lit(empNotif.event_id)})`);
  check('Preparar dos veces no duplica entregas', deliveriesOf(empNotif.event_id).length === 1);
  sql(`update notif_private.deliveries set status = 'provider_accepted', locked_until = null where event_id = ${lit(empNotif.event_id)} and status = 'sending'`);

  section('10. Estado leído entre web y app');
  received.updated.length = 0;
  const { error: readErr } = await emp.client.from('notifications').update({ read: true }).eq('id', empNotif.id);
  check('Marcar como leída con la columna permitida', !readErr, readErr?.message);
  await until(() => received.updated.length > 0, 8000);
  check('La otra sesión recibe el cambio y el contador', received.updated[0]?.read === true && received.updated[0]?.unread === 0, received.updated[0]);

  const syncBefore = received.sync;
  const updatedBefore = received.updated.length;
  sql(`select notif_private.emit(array[${lit(emp.id)}]::uuid[], 'requests', 'a', 'b', 'info', 'request', null, 'bulk-1', null);
       select notif_private.emit(array[${lit(emp.id)}]::uuid[], 'requests', 'c', 'd', 'info', 'request', null, 'bulk-2', null);`);
  await until(() => inboxRows(emp).filter((n) => !n.read).length === 2);
  await emp.client.from('notifications').update({ read: true }).eq('user_id', emp.id).eq('read', false);
  await until(() => received.sync > syncBefore, 8000);
  check('Marcar todas produce un único evento de sincronización', received.sync === syncBefore + 1 && received.updated.length === updatedBefore, { sync: received.sync - syncBefore, updated: received.updated.length - updatedBefore });

  section('Reglas de negocio reales');
  const beforeSelf = inboxRows(admin).length;
  const { data: ownReq } = await admin.client.from('requests').insert({ employee_id: admin.id, type: 'purchase', status: 'pending', item: 'x', amount: 5 }).select().single();
  await admin.client.from('requests').update({ status: 'rejected', reviewed_by: admin.id }).eq('id', ownReq.id);
  await sleep(600);
  check('Un administrador no recibe avisos de sus propias acciones', inboxRows(admin).length === beforeSelf);

  await emp.client.from('hour_compensations').insert({ employee_id: emp.id, date: '2020-01-01', reason: 'r', hours: 2.5, type: 'debe', status: 'approved' });
  const { data: bolsa } = await emp.client.from('hour_compensations').insert({ employee_id: emp.id, date: '2099-01-01', reason: 'r', hours: 2.5, type: 'bolsa', status: 'pending' }).select().single();
  await sleep(500);
  const adminAfterHours = inboxRows(admin);
  check('Horas "debe": sin revisión, sin aviso', adminAfterHours.filter((n) => n.entity_type === 'hour_compensation').length === 1);
  check('Bolsa de horas: aviso con las horas', adminAfterHours.some((n) => n.entity_id === String(bolsa.id) && /2\.5h/.test(n.body)));

  const { data: day } = await emp.client.from('personal_days').insert({ employee_id: emp.id, date: '2099-02-01', reason: 'r', status: 'pending' }).select().single();
  await admin.client.from('personal_days').update({ status: 'approved', reviewed_by: admin.id }).eq('id', day.id);
  await sleep(400);
  check('Asuntos propios: aviso a admin y resolución al empleado', inboxRows(admin).some((n) => n.entity_id === String(day.id)) && inboxRows(emp).some((n) => n.entity_id === String(day.id) && n.title === '✅ Asuntos propios aprobados'));

  const roomId = sql(`insert into public.rooms (name) values ('Sala Azul') returning id`);
  const { data: resv, error: resvErr } = await emp.client.from('reservations').insert({ employee_id: emp.id, type: 'room', room_id: roomId, date: '2099-03-03', time_start: '10:00', time_end: '11:00', status: 'pending' }).select().single();
  check('Se crea la reserva con RLS', !resvErr, resvErr?.message);
  await admin.client.from('reservations').update({ status: 'confirmed', reviewed_by: admin.id }).eq('id', resv.id);
  await sleep(400);
  check('Reserva nueva: aviso a admin con recurso y franja', inboxRows(admin).some((n) => n.entity_id === String(resv.id) && /Sala Azul · 03\/03\/2099 · 10:00–11:00/.test(n.body)));
  check('Reserva confirmada: aviso al dueño', inboxRows(emp).some((n) => n.entity_id === String(resv.id) && n.title === '✅ Reserva confirmada'));

  await admin.client.from('reservations').delete().eq('id', resv.id);
  await sleep(400);
  check('Admin borra una reserva futura: el dueño lo sabe', inboxRows(emp).some((n) => n.title === '❌ Reserva cancelada' && /Sala Azul/.test(n.body)));

  const { data: resv2 } = await emp.client.from('reservations').insert({ employee_id: emp.id, type: 'room', room_id: roomId, date: '2099-03-04', time_start: '10:00', time_end: '11:00', status: 'pending' }).select().single();
  await emp.client.from('reservations').delete().eq('id', resv2.id);
  await sleep(400);
  check('El dueño cancela: avisa a administradores', inboxRows(admin).some((n) => n.title === '📅 Reserva cancelada'));

  const { data: docRow } = await admin.client.from('documents').insert({ title: 'Nómina', description: 'de marzo', sender_id: admin.id, recipient_id: emp.id, status: 'pending' }).select().single();
  await admin.client.from('documents').insert({ title: '__ONBOARDING_DOC__', sender_id: admin.id, status: 'completed' });
  await sleep(400);
  check('Documento: aviso al destinatario', inboxRows(emp).some((n) => n.entity_id === String(docRow.id)));
  check('El documento de onboarding no avisa', !inboxRows(emp).some((n) => /__ONBOARDING_DOC__/.test(n.title)));

  sql(`update public.profiles set department = 'Comunicación - marketing' where id = ${lit(other.id)}`);
  const newsCount = (u) => inboxRows(u).filter((n) => n.entity_type === 'news').length;
  const { data: post, error: postErr } = await other.client.from('news').insert({ type: 'event', title: 'Cena de empresa', content: 'Detalle', author_id: other.id, category: 'Empresa' }).select().single();
  check('Marketing publica', !postErr, postErr?.message);
  await sleep(400);
  check('Evento: avisa a toda la plantilla menos al autor', newsCount(admin) === 1 && newsCount(emp) === 1 && newsCount(other) === 0, [newsCount(admin), newsCount(emp), newsCount(other)]);
  check('El evento se presenta como evento', inboxRows(emp).some((n) => n.title === '📅 Nuevo evento: Cena de empresa'));
  await other.client.from('news').update({ title: 'Cena de empresa (editada)' }).eq('id', post.id);
  await sleep(300);
  check('Editar la publicación no vuelve a avisar', newsCount(emp) === 1);

  sql(`update public.profiles set work_mode = 'Office' where id = ${lit(emp.id)}`);
  const { error: officeErr } = await emp.client.rpc('notify_office_return', { p_previous: 'remoto', p_request_id: String(req.id) });
  await emp.client.rpc('notify_office_return', { p_previous: 'remoto', p_request_id: String(req.id) });
  check('Vuelta a la oficina: un aviso, con la fecha de fin', !officeErr && inboxRows(admin).filter((n) => n.title === '🏢 Vuelta a la oficina' && /10|12\/01\/2099/.test(n.body)).length === 1, officeErr?.message);

  const deleted = await createUser('Dora Baja', 'employee');
  const { data: dResv } = await deleted.client.from('reservations').insert({ employee_id: deleted.id, type: 'room', room_id: roomId, date: '2099-04-01', time_start: '09:00', time_end: '10:00', status: 'pending' }).select().single();
  const { error: delErr } = await admin.client.from('profiles').delete().eq('id', deleted.id);
  check('Borrar un perfil con reservas sigue funcionando', !delErr && dResv, delErr?.message);

  section('15. Seguridad: RLS, colas y API interna');
  const seen = await other.client.from('notifications').select('id').eq('user_id', emp.id);
  check('No se pueden consultar avisos ajenos', !seen.error && seen.data.length === 0);
  const forged = await emp.client.from('notifications').insert({ user_id: admin.id, title: 'falso' });
  check('Un cliente no puede crear avisos', Boolean(forged.error), forged.status);
  const ownForged = await emp.client.from('notifications').insert({ user_id: emp.id, title: 'falso' });
  check('Tampoco para sí mismo (versiones antiguas de la app no duplican)', Boolean(ownForged.error));
  const retitle = await emp.client.from('notifications').update({ title: 'cambiado' }).eq('id', empNotif.id);
  check('Solo se puede cambiar la columna read', Boolean(retitle.error));
  const othersRead = await other.client.from('notifications').update({ read: false }).eq('id', empNotif.id).select();
  check('No se pueden marcar avisos ajenos', !othersRead.error && othersRead.data.length === 0);

  const anon = createClient(API_URL, status.PUBLISHABLE_KEY, { auth: { persistSession: false } });
  for (const [name, client] of [['anon', anon], ['empleado', emp.client]]) {
    const claim = await client.rpc('notif_worker_claim', {});
    check(`${name}: no puede leer la cola`, Boolean(claim.error));
    const q = await client.schema('pgmq').from('q_notification_jobs').select('*');
    check(`${name}: la tabla de la cola no está accesible`, Boolean(q.error));
    const log = await client.schema('notif_private').from('deliveries').select('*');
    check(`${name}: las entregas no están accesibles`, Boolean(log.error));
    const tokens = await client.from('push_tokens').select('*');
    check(`${name}: los tokens no están accesibles`, Boolean(tokens.error));
  }
  const healthEmp = await emp.client.rpc('notification_system_health');
  check('La supervisión no responde a empleados', healthEmp.error?.code === '42501', healthEmp.error);

  const badToken = await emp.client.rpc('register_push_token', { p_user_id: admin.id, p_token: 'ExponentPushToken[x]', p_platform: 'android' });
  check('No se puede registrar un dispositivo a nombre de otro', Boolean(badToken.error));

  const noSecret = await fetch(`${API_URL}/functions/v1/notifications-worker`, { method: 'POST', body: '{}' });
  check('El worker rechaza llamadas sin secreto', noSecret.status === 401, noSecret.status);

  await emp.client.from('notification_preferences').upsert({ user_id: emp.id, category: 'news', push_enabled: true });
  const prefOther = await emp.client.from('notification_preferences').upsert({ user_id: other.id, category: 'news', push_enabled: false });
  check('Las preferencias de otro no se pueden cambiar', Boolean(prefOther.error));

  section('Preferencias');
  await emp.client.from('notification_preferences').upsert({ user_id: emp.id, category: 'documents', push_enabled: false });
  const expoBefore = mock.expo.filter((m) => m.to === empToken).length;
  const { data: mutedDoc } = await admin.client.from('documents').insert({ title: 'Silenciado', sender_id: admin.id, recipient_id: emp.id, status: 'pending' }).select().single();
  const muted = await until(() => inboxRows(emp).find((n) => n.entity_id === String(mutedDoc.id)));
  await until(() => dispatch(muted.event_id) === 'skipped_preference');
  check('Categoría desactivada: sigue en la bandeja, sin push', dispatch(muted.event_id) === 'skipped_preference' && mock.expo.filter((m) => m.to === empToken).length === expoBefore);
  check('Sale de la cola', await until(() => queued(muted.event_id) === 0));

  section('Tokens y suscripciones inválidas');
  const deadUser = await createUser('Dani Token', 'employee');
  const deadToken = addExpoDevice(deadUser);
  mock.expoMode = 'device_not_registered';
  sql(`select notif_private.emit(array[${lit(deadUser.id)}]::uuid[], 'requests', 'a', 'b', 'info', 'request', null, 'dnr-1', null)`);
  const dnrRow = await until(() => count(`select 1 from public.push_tokens where token = ${lit(deadToken)} and disabled_reason = 'DeviceNotRegistered'`) === 1);
  mock.expoMode = 'ok';
  check('DeviceNotRegistered desactiva el token', dnrRow);

  const goneUser = await createUser('Gina Web', 'employee');
  const goneBrowser = addWebDevice(goneUser);
  mock.webMode[goneBrowser.id] = 410;
  sql(`select notif_private.emit(array[${lit(goneUser.id)}]::uuid[], 'requests', 'a', 'b', 'info', 'request', null, 'gone-1', null)`);
  check('Web Push 410 desactiva la suscripción', await until(() => count(`select 1 from public.web_push_subscriptions where user_id = ${lit(goneUser.id)} and disabled_at is not null`) === 1));
  const reSub = await goneUser.client.rpc('register_web_push', {
    p_user_id: goneUser.id, p_endpoint: `https://push.example.com/${goneBrowser.id}`, p_p256dh: goneBrowser.p256dh, p_auth: goneBrowser.authB64,
  });
  check('Registrar de nuevo funciona', !reSub.error, reSub.error?.message);

  const rotateOld = `https://push.example.com/${goneBrowser.id}`;
  const rotate = await anon.rpc('notif_rotate_web_push', { p_old_endpoint: rotateOld, p_new_endpoint: `${rotateOld}-nuevo`, p_p256dh: goneBrowser.p256dh, p_auth: goneBrowser.authB64 });
  check('pushsubscriptionchange actualiza la suscripción', !rotate.error && count(`select 1 from public.web_push_subscriptions where endpoint = ${lit(`${rotateOld}-nuevo`)} and user_id = ${lit(goneUser.id)}`) === 1, rotate.error?.message);
  const rotateForged = await anon.rpc('notif_rotate_web_push', { p_old_endpoint: 'https://nope', p_new_endpoint: 'https://attacker', p_p256dh: 'x', p_auth: 'y' });
  check('Sin el endpoint anterior no cambia nada', !rotateForged.error && count(`select 1 from public.web_push_subscriptions where endpoint = 'https://attacker'`) === 0);
  sql(`delete from public.web_push_subscriptions where user_id = ${lit(goneUser.id)}`);

  section('Recibos de Expo y confirmación del dispositivo');
  const receiptUser = await createUser('Rita Recibos', 'employee');
  addExpoDevice(receiptUser);
  addExpoDevice(receiptUser);
  sql(`select notif_private.emit(array[${lit(receiptUser.id)}]::uuid[], 'requests', 'a', 'b', 'info', 'request', null, 'rcpt-1', null)`);
  const rcptEvent = sql(`select event_id from public.notifications where user_id = ${lit(receiptUser.id)}`);
  await until(() => dispatch(rcptEvent) === 'processed');
  const rcptRows = deliveriesOf(rcptEvent);
  const [okRow, deadRow] = rcptRows;
  mock.receipts[okRow.expo_ticket_id] = { status: 'ok' };
  mock.receipts[deadRow.expo_ticket_id] = { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } };
  sql(`update notif_private.deliveries set accepted_at = now() - interval '20 minutes' where event_id = ${lit(rcptEvent)}`);
  sql(`select notif_private.recovery_tick()`);
  const done = await until(() => count(`select 1 from notif_private.deliveries where event_id = ${lit(rcptEvent)} and receipt_state is not null`) === 2);
  check('Cron dispara la consulta de recibos cuando tocan', done);
  const afterRcpt = deliveriesOf(rcptEvent);
  check('Recibo ok = aceptado por FCM', afterRcpt.find((d) => d.id === okRow.id)?.status === 'provider_confirmed');
  check('Recibo DeviceNotRegistered = dispositivo inválido', afterRcpt.find((d) => d.id === deadRow.id)?.status === 'invalid_device');
  check('Y desactiva ese token', count(`select 1 from public.push_tokens where user_id = ${lit(receiptUser.id)} and disabled_at is not null`) === 1);
  const ack = await anon.rpc('notif_ack_delivery', { p_delivery_id: okRow.id });
  check('El dispositivo puede confirmar la entrega', !ack.error && deliveriesOf(rcptEvent).find((d) => d.id === okRow.id)?.device_confirmed_at, ack.error?.message);

  section('11, 13, 14. Fallos: proveedor caído, worker caído, cron recupera');
  const retryUser = await createUser('Pablo Proveedor', 'employee');
  const retryToken = addExpoDevice(retryUser);
  mock.expoMode = '503';
  sql(`select notif_private.emit(array[${lit(retryUser.id)}]::uuid[], 'requests', 'a', 'b', 'info', 'request', null, 'retry-1', null)`);
  const retryEvent = sql(`select event_id from public.notifications where user_id = ${lit(retryUser.id)}`);
  const retrying = await until(() => deliveriesOf(retryEvent)[0]?.status === 'retry');
  check('Proveedor caído: la entrega queda en reintento', retrying, deliveriesOf(retryEvent)[0]?.status);
  const firstRetry = deliveriesOf(retryEvent)[0];
  check('Con el error registrado', firstRetry?.last_error_code === 'http_503', firstRetry?.last_error_code);
  check('El trabajo sigue en la cola', queued(retryEvent) === 1);
  const backoff = new Date(firstRetry.next_attempt_at) - Date.now();
  check('El reintento se programa con espera', backoff > 15_000 && backoff < 40_000, backoff);

  mock.expoMode = 'ok';
  console.log('     (esperando a que pg_cron reintente solo; hasta 2 min)');
  const recovered = await until(() => deliveriesOf(retryEvent)[0]?.status === 'provider_accepted', 130_000, 2000);
  check('Proveedor de vuelta: cron reintenta y el envío sale, sin intervención', recovered, deliveriesOf(retryEvent)[0]);
  check('Con 2 intentos registrados', deliveriesOf(retryEvent)[0]?.attempts === 2, deliveriesOf(retryEvent)[0]?.attempts);
  check('Un único mensaje final en el dispositivo', mock.expo.filter((m) => m.to === retryToken).length === 1);
  await until(() => queued(retryEvent) === 0, 5000);
  check('Solo entonces se retira de la cola', queued(retryEvent) === 0);

  const downUser = await createUser('Diego Caído', 'employee');
  const downToken = addExpoDevice(downUser);
  sql(`select vault.update_secret((select id from vault.secrets where name = 'notifications_worker_url'), 'http://127.0.0.1:9/nada')`);
  sql(`select notif_private.emit(array[${lit(downUser.id)}]::uuid[], 'requests', 'a', 'b', 'info', 'request', null, 'down-1', null)`);
  const downEvent = sql(`select event_id from public.notifications where user_id = ${lit(downUser.id)}`);
  await sleep(4000);
  check('Worker inalcanzable: el trabajo espera en la cola', queued(downEvent) === 1 && !mock.expo.some((m) => m.to === downToken));
  check('Y la notificación ya está en la bandeja', inboxRows(downUser).length === 1);
  sql(`select vault.update_secret((select id from vault.secrets where name = 'notifications_worker_url'), ${lit(workerUrl)})`);
  console.log('     (esperando a la pasada de pg_cron; hasta 90 s)');
  check('Worker de vuelta: pg_cron recupera el trabajo sin webhook', await until(() => mock.expo.some((m) => m.to === downToken), 90_000, 2000));
  const recoveryHeartbeat = JSON.parse(sql(`select row_to_json(h) from notif_private.heartbeats h where name = 'recovery'`) || '{}');
  check('La recuperación deja constancia de su última ejecución', Boolean(recoveryHeartbeat?.last_run_at));

  const crashUser = await createUser('Carla Corte', 'employee');
  const crashToken = addExpoDevice(crashUser);
  sql(`select vault.update_secret((select id from vault.secrets where name = 'notifications_worker_url'), 'http://127.0.0.1:9/nada')`);
  sql(`select notif_private.emit(array[${lit(crashUser.id)}]::uuid[], 'requests', 'a', 'b', 'info', 'request', null, 'crash-1', null)`);
  const crashEvent = sql(`select event_id from public.notifications where user_id = ${lit(crashUser.id)}`);
  // Lo que deja un worker que muere a mitad de lote: trabajo leído y entrega reservada, sin resultado
  sql(`select msg_id from pgmq.read('notification_jobs', 1, 50) where message->>'event_id' = ${lit(crashEvent)};
       select public.notif_worker_prepare(${lit(crashEvent)}, 1);`);
  check('Simulación: entrega reservada por un worker que muere', deliveriesOf(crashEvent)[0]?.status === 'sending');
  await sleep(2200);
  sql(`select notif_private.recovery_tick()`);
  check('La recuperación libera la entrega bloqueada', deliveriesOf(crashEvent)[0]?.status === 'retry', deliveriesOf(crashEvent)[0]?.status);
  check('Y queda registrado', count(`select 1 from notif_private.ops_log where kind = 'stuck_deliveries_released'`) >= 1);
  sql(`update notif_private.deliveries set next_attempt_at = now() where event_id = ${lit(crashEvent)}`);
  sql(`select vault.update_secret((select id from vault.secrets where name = 'notifications_worker_url'), ${lit(workerUrl)})`);
  sql(`select notif_private.wake_worker('test')`);
  check('Se completa tras el corte', await until(() => mock.expo.some((m) => m.to === crashToken) && dispatch(crashEvent) === 'processed', 30_000));
  check('Sin deduplicar mal: una sola entrega', deliveriesOf(crashEvent).length === 1);

  section('Dead Letter Queue');
  const dlqUser = await createUser('Lola Letra', 'employee');
  const dlqToken = addExpoDevice(dlqUser);
  mock.expoMode = '503';
  sql(`select notif_private.emit(array[${lit(dlqUser.id)}]::uuid[], 'requests', 'a', 'b', 'info', 'request', null, 'dlq-1', null)`);
  const dlqEvent = sql(`select event_id from public.notifications where user_id = ${lit(dlqUser.id)}`);
  await until(() => deliveriesOf(dlqEvent)[0]?.status === 'retry');
  // Último intento: el siguiente fallo agota los reintentos
  sql(`update notif_private.deliveries set attempts = 11, next_attempt_at = now() where event_id = ${lit(dlqEvent)};
       update pgmq.q_notification_jobs set vt = now() where message->>'event_id' = ${lit(dlqEvent)};
       select notif_private.wake_worker('test');`);
  const inDlq = await until(() => count(`select 1 from pgmq.q_notification_jobs_dlq where message->>'event_id' = ${lit(dlqEvent)}`) === 1, 30_000);
  check('Reintentos agotados: pasa a la cola de errores', inDlq);
  check('Con el motivo y fuera de la cola principal', dispatch(dlqEvent) === 'dead_letter' && queued(dlqEvent) === 0, dispatch(dlqEvent));

  sql(`select notif_private.evaluate_alerts()`);
  const alerted = inboxRows(admin).find((n) => n.entity_type === 'system');
  check('Alerta en la bandeja de administradores', Boolean(alerted), alerted?.title);
  const alertCount = inboxRows(admin).filter((n) => n.entity_type === 'system').length;
  sql(`select notif_private.evaluate_alerts()`);
  check('La alerta no se repite mientras sigue abierta', inboxRows(admin).filter((n) => n.entity_type === 'system').length === alertCount);

  mock.expoMode = 'ok';
  check('Reencolado automático: una segunda oportunidad', Number(sql(`select notif_private.requeue_dead_letters()`)) >= 1);
  sql(`select notif_private.wake_worker('test')`);
  check('Y se entrega cuando el proveedor vuelve', await until(() => mock.expo.some((m) => m.to === dlqToken) && dispatch(dlqEvent) === 'processed', 30_000), dispatch(dlqEvent));
  check('La cola de errores queda vacía', count(`select 1 from pgmq.q_notification_jobs_dlq where message->>'event_id' = ${lit(dlqEvent)}`) === 0);
  sql(`select notif_private.evaluate_alerts()`);
  check('La alerta se resuelve sola', count(`select 1 from notif_private.alerts where key = 'dead_letters' and resolved_at is not null`) === 1);

  section('Supervisión y tareas programadas');
  const health = (await admin.client.rpc('notification_system_health')).data;
  check('Estado del sistema para administradores', Boolean(health?.last_worker_run && health?.last_recovery_run && health?.queue && health?.devices), health);
  check('Cuenta lo reintentado y lo inválido', health?.retries_24h >= 1 && health?.devices?.expo_disabled >= 1, { retries: health?.retries_24h, devices: health?.devices });
  const jobs = sql(`select string_agg(jobname, ',' order by jobname) from cron.job where jobname like 'notifications-%'`);
  check('Tareas de pg_cron registradas', jobs === 'notifications-maintenance,notifications-recovery', jobs);
  check('pg_cron ejecuta la recuperación de verdad', count(`select 1 from cron.job_run_details d join cron.job j using (jobid) where j.jobname = 'notifications-recovery' and d.status = 'succeeded'`) >= 1);
  sql(`select notif_private.maintenance()`);
  check('El mantenimiento se ejecuta sin error', true);

  sql(`delete from public.notifications where event_id = ${lit(rcptEvent)}`);
  check('Borrar un aviso borra sus entregas', deliveriesOf(rcptEvent).length === 0);

  sql(`select pgmq.send('notification_jobs', '{"event_id":"00000000-0000-0000-0000-000000000000"}'); select notif_private.wake_worker('test')`);
  check('Un trabajo de una fila que ya no existe no bloquea la cola', await until(() => count(`select 1 from pgmq.q_notification_jobs where message->>'event_id' = '00000000-0000-0000-0000-000000000000'`) === 0, 20_000));

  closeEmp();
  await other.client.removeChannel(spyChannel);
  check('Nadie espió el canal ajeno', spy.events === 0, spy.events);
}

main()
  .catch((err) => {
    failures.push(`Excepción: ${err.message}`);
    console.error(err);
  })
  .finally(() => {
    server.close();
    console.log(`\n${'='.repeat(60)}\n${passed} correctas, ${failures.length} fallidas`);
    failures.forEach((f) => console.log(`  ❌ ${f}`));
    if (process.argv.includes('--stop')) {
      try { supabaseCli(['stop']); } catch (err) { console.warn(err.message); }
    }
    process.exit(failures.length ? 1 : 0);
  });
