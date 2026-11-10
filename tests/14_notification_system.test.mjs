// Sin red ni Docker: lo que se puede comprobar leyendo el código y ejecutando la lógica pura.
// El recorrido real (pgmq, Realtime, cron, Edge Function) está en tests/notifications/e2e.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyExpoError, classifyExpoHttp, classifyWebPush, parseRetryAfter,
} from '../supabase/functions/notifications-worker/classify.ts';
import { mergeNotification, fetchNotifications, NOTIFICATION_CATEGORIES, allNotificationsEnabled, setAllNotificationPreferences } from '../shared/services/notifications.js';
import { ENTITY_NAV_MAP, ENTITY_NAV_MAP_ADMIN, notificationWebPath } from '../shared/config/constants.js';

export async function runNotificationSystemTests() {
  let passed = 0;
  let failed = 0;
  const assert = (name, ok) => {
    if (ok) {
      passed++;
      console.log(`  ✅ ${name}`);
    } else {
      failed++;
      console.log(`  ❌ ${name}`);
    }
  };
  const read = (...p) => fs.readFileSync(path.join(process.cwd(), ...p), 'utf8');

  const migration = read('supabase/migrations/20261104131241_notification_system.sql');
  const worker = read('supabase/functions/notifications-worker/index.ts');
  const sw = read('public/push-sw.js');
  const ctx = read('src/context/index.jsx');
  const appData = read('mobile/src/context/DataContext.js');
  const shared = ['requests', 'reservations', 'personalDays', 'hours', 'documents', 'workMode', 'notifications']
    .map((f) => read('shared/services', `${f}.js`)).join('\n');

  // Clasificación de respuestas de los proveedores
  assert('Expo: DeviceNotRegistered invalida el token', classifyExpoError('DeviceNotRegistered').outcome === 'invalid');
  assert('Expo: MessageTooBig no se reintenta', classifyExpoError('MessageTooBig').outcome === 'failed');
  assert('Expo: MessageRateExceeded se reintenta', classifyExpoError('MessageRateExceeded').outcome === 'retry');
  assert('Expo: credenciales inválidas se reintentan y alertan', classifyExpoError('InvalidCredentials').outcome === 'retry' && classifyExpoError('InvalidCredentials').config === true);
  assert('Expo: un error desconocido no pierde el aviso', classifyExpoError('AlgoNuevo').outcome === 'retry');
  assert('Expo: 429 y 5xx se reintentan', classifyExpoHttp(429).outcome === 'retry' && classifyExpoHttp(503).outcome === 'retry');
  assert('Expo: otro 4xx no se reintenta', classifyExpoHttp(400).outcome === 'failed');
  assert('Web Push: 201 aceptado', classifyWebPush(201).outcome === 'accepted');
  assert('Web Push: 404 y 410 invalidan la suscripción', classifyWebPush(404).outcome === 'invalid' && classifyWebPush(410).outcome === 'invalid');
  assert('Web Push: clave VAPID rechazada invalida y alerta', classifyWebPush(403).outcome === 'invalid' && classifyWebPush(403).config === true);
  assert('Web Push: 429 y 5xx se reintentan', classifyWebPush(429).outcome === 'retry' && classifyWebPush(500).outcome === 'retry');
  assert('Retry-After en segundos y en fecha', parseRetryAfter('30') === 30 && parseRetryAfter(new Date(61_000).toUTCString(), 1000) === 60 && parseRetryAfter('x') === undefined && parseRetryAfter(null) === undefined);

  // Bandeja
  const merged = mergeNotification(
    [{ id: 2, created_at: '2026-01-02' }, { id: 1, created_at: '2026-01-01' }],
    { id: 3, created_at: '2026-01-03' },
  );
  assert('Una fila nueva queda la primera', merged[0].id === 3 && merged.length === 3);
  assert('Una fila repetida no se duplica', mergeNotification(merged, { id: 2, created_at: '2026-01-02', read: true }).filter((n) => n.id === 2).length === 1);

  const calls = [];
  const builder = {
    select: () => builder, eq: () => builder, order: () => builder,
    lt: (c, v) => { calls.push([c, v]); return builder; },
    limit: () => Promise.resolve({ data: [], error: null }),
  };
  await fetchNotifications({ from: () => builder }, 'u1', { before: '2026-01-01' });
  assert('El historial pide la página anterior a la última', calls.length === 1 && calls[0][0] === 'created_at');

  // Enlaces: los mismos en la web, en el push y en la app
  for (const [entity, target] of [['news', '/news'], ['request', '/requests'], ['reservation', '/reservations'], ['document', '/profile'], ['system', '/settings']]) {
    assert(`Enlace ${entity} → ${target} igual en cliente y base de datos`,
      notificationWebPath({ entity_type: entity }) === target && new RegExp(`when '${entity}' then '${target}'`).test(migration));
  }
  assert('Horas: los admins van a /admin en cliente y base de datos', ENTITY_NAV_MAP_ADMIN.hour_compensation === 'admin' && ENTITY_NAV_MAP.hour_compensation === 'horas' && /when 'hour_compensation' then case when p_is_admin then '\/admin' else '\/horas' end/.test(migration));
  assert('App: las noticias abren su pantalla', /case 'news':\s*\n?\s*navigation\.navigate\('News'\)/.test(read('mobile/src/navigation/notificationTarget.js').replace(/\r/g, '')));

  // Reglas de negocio en un solo sitio
  assert('Los servicios compartidos ya no crean avisos', !/from\('notifications'\)\s*\.insert|notifications'\)\.insert|notifyAdmins|createNotification/.test(shared));
  assert('La web ya no crea avisos', !/notifyAdmins|createNotification|from\('notifications'\)\.insert/.test(ctx));
  assert('La app ya no crea avisos', !/notifyAdmins|createNotification/.test(appData));
  for (const t of ['requests', 'personal_days', 'hour_compensations', 'reservations', 'documents', 'news']) {
    assert(`Trigger de negocio en ${t}`, migration.includes(`('${t}', `));
  }
  assert('Solo hay categorías de módulos que existen', NOTIFICATION_CATEGORIES.every((c) => new RegExp(`'${c.id}'`).test(migration.match(/category in \(([^)]*)\)/)?.[1] || '')));

  // Privacidad
  assert('Push de Expo con texto genérico', /const PUSH_TITLE = 'Margube'/.test(worker) && /const PUSH_BODY = 'Tienes una nueva notificación\.'/.test(worker));
  assert('El worker nunca lee título ni cuerpo de la notificación', !/\.title|\.body\b(?!\?\.cancel)/.test(worker.replace(/res\.body/g, '').replace(/request\.body/g, '')));
  assert('El service worker enseña siempre lo mismo', /showNotification\(GENERIC\.title/.test(sw) && /body: GENERIC\.body/.test(sw));
  assert('El aviso local de la web también es genérico', !/showSystemNotification\(\{[^}]*row\.title/.test(ctx));

  // Sin procesos permanentes ni secretos en el código
  assert('Sin polling desde el navegador', !/setInterval\([^)]*fetchNotifications/.test(ctx));
  assert('Web y app usan Broadcast privado para los avisos', /subscribeToNotifications\(supabase, user\.id/.test(ctx) && /subscribeToNotifications\(supabase, user\.id/.test(appData) && !/table: 'notifications'/.test(ctx) && !/table: 'notifications'/.test(appData));
  assert('El secreto del worker sale de Vault, no del SQL', /vault\.decrypted_secrets where name = 'notifications_worker_secret'/.test(migration) && !/sb_secret|eyJhbGci/.test(migration));
  assert('Sin claves de servidor en los clientes', ![ctx, appData, sw, read('src/services/webPush.js')].some((f) => /service_role|sb_secret_|VAPID_PRIVATE/.test(f)));
  assert('La cola se protege de los clientes', /revoke all on schema pgmq from public, anon, authenticated/.test(migration));
  assert('El mensaje de la cola solo lleva el identificador', /pgmq\.send\('notification_jobs', jsonb_build_object\('event_id', r\.event_id\)\)/.test(migration));
  assert('Colas duraderas, no temporales', !/create_unlogged/.test(migration));
  assert('Recuperación y mantenimiento programados', /cron\.schedule\('notifications-recovery', '\* \* \* \* \*'/.test(migration) && /cron\.schedule\('notifications-maintenance'/.test(migration));
  assert('send-push se retira', !fs.existsSync(path.join(process.cwd(), 'supabase/functions/send-push')) && /drop trigger if exists on_notification_insert_push/.test(migration));

  // Una sesión que caduca no debe apagar los avisos del dispositivo
  assert('El cierre por inactividad conserva el dispositivo', /logout\(\{ keepDevice: true \}\)/.test(ctx) && /if \(!keepDevice\) await disablePush/.test(ctx));
  assert('Pulsar un push sobrevive al login', /pendingPathRef/.test(ctx));
  // Encontrado con Chrome real: dos subscribe() simultáneos dejan un endpoint muerto que parece válido
  assert('Suscribirse no se solapa', /if \(!enablingPush\) enablingPush = subscribeBrowser\(userId\)/.test(read('src/services/webPush.js')));

  assert('Sin preferencias cargadas no se muestra activado', !allNotificationsEnabled(null));
  assert('Sin preferencias guardadas todas están activadas', allNotificationsEnabled({}));
  assert('Preferencias mixtas no se presentan como todas activadas', !allNotificationsEnabled({ news: false }));
  for (const enabled of [true, false]) {
    let calls = 0;
    let rows;
    let conflict;
    const client = { from: () => ({ upsert: async (values, options) => {
      calls++;
      rows = values;
      conflict = options.onConflict;
      return { error: null };
    } }) };
    const result = await setAllNotificationPreferences(client, 'user-test', enabled);
    assert(`Control global ${enabled}: guarda todas las categorías juntas`, !result.error && calls === 1 && rows.length === NOTIFICATION_CATEGORIES.length && rows.every((r) => r.user_id === 'user-test' && r.push_enabled === enabled) && conflict === 'user_id,category');
  }
  const failure = new Error('sin conexión');
  const failedSave = await setAllNotificationPreferences({ from: () => ({ upsert: async () => { throw failure; } }) }, 'user-test', false);
  assert('El fallo de conexión vuelve a la interfaz para mantener el estado anterior', failedSave.error === failure);
  const noSession = await setAllNotificationPreferences({}, null, false);
  assert('Sin sesión no se intenta guardar', !!noSession.error);
  return { passed, failed };
}
