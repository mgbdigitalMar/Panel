#!/usr/bin/env node
// Despliega el backend de notificaciones en el proyecto de Supabase enlazado. Es repetible.
//
//   npx supabase login
//   npx supabase link --project-ref <ref>
//   node scripts/deploy-notifications.mjs           despliega
//   node scripts/deploy-notifications.mjs --check   solo lee producción y dice qué haría
//
// La base de datos debe ir antes que la web: la web anterior sigue funcionando con la migración
// aplicada, pero la web nueva necesita sus funciones. Los pasos manuales están en docs/NOTIFICACIONES.md.
import { execSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEW_MIGRATION = '20261104131241';
const WORKER = 'notifications-worker';
const VAPID_FILE = join(ROOT, 'supabase/.env.push');
const CHECK_ONLY = process.argv.includes('--check');

const die = (message) => {
  console.error(`\n❌ ${message}`);
  process.exit(1);
};
const step = (message) => console.log(`\n▶ ${message}`);

// Una sola cadena: en Windows npx es un .cmd y necesita shell. Ningún secreto pasa por aquí.
// --agent no: la CLI cambia el formato de su salida si cree que la ejecuta un agente. Así se
// comporta igual en cualquier terminal.
const command = (args) => ['npx', '--yes', 'supabase@3', ...args, '--agent', 'no']
  .map((a) => (/^[\w@./:=-]+$/.test(a) ? a : `"${a}"`))
  .join(' ');

/** Salida capturada: para lecturas. */
function read(args) {
  return execSync(command(args), { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
/** A la vista de quien lo ejecuta, que puede responder (contraseña de la base de datos). */
function run(args, { timeoutMs = 300_000 } = {}) {
  const result = spawnSync(command(args), { cwd: ROOT, stdio: 'inherit', shell: true, timeout: timeoutMs });
  if (result.error?.code === 'ETIMEDOUT') die(`Sin respuesta tras ${timeoutMs / 1000} s: supabase ${args[0]} ${args[1] ?? ''}. Vuelve a ejecutar el script: se puede repetir.`);
  if (result.status !== 0) die(`Falló: supabase ${args.join(' ')}`);
}

const secretLine = (name) => read(['secrets', 'list']).split(/\r?\n/).find((line) => line.includes(name)) ?? null;

/** Los documentos JSON de la salida de la CLI: según el modo, una lista de filas o varios objetos. */
function jsonDocuments(text) {
  const docs = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (depth > 0 && c === '"') {
      inString = true;
    } else if (c === '{' || c === '[') {
      if (depth++ === 0) start = i;
    } else if ((c === '}' || c === ']') && depth > 0 && --depth === 0) {
      docs.push(JSON.parse(text.slice(start, i + 1)));
    }
  }
  return docs;
}

function queryRows(output) {
  const docs = jsonDocuments(output);
  const failure = docs.find((d) => d._tag === 'Error');
  if (failure) throw new Error(failure.error?.message || JSON.stringify(failure));
  const rows = docs.find(Array.isArray) ?? docs.find((d) => Array.isArray(d.rows))?.rows;
  if (!rows) throw new Error(`Respuesta inesperada de la CLI: ${output.slice(0, 200)}`);
  return rows;
}

function query(sql, { write = false } = {}) {
  // En un archivo temporal: ni la consulta ni los secretos pasan por la línea de comandos
  const dir = mkdtempSync(join(tmpdir(), 'margube-deploy-'));
  try {
    const file = join(dir, 'query.sql');
    writeFileSync(file, sql, { mode: 0o600 });
    const args = ['db', 'query', '--remote', write ? '--yes' : '--read-only', '--output-format', 'json', '-f', file];
    let output;
    try {
      output = read(args);
    } catch (err) {
      // El detalle del error va en stdout, en JSON
      output = err.stdout?.toString() || '';
      if (!/[{[]/.test(output)) throw err;
    }
    return queryRows(output);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function linkedProject() {
  const refFile = join(ROOT, 'supabase/.temp/project-ref');
  if (!existsSync(refFile)) die('Proyecto sin enlazar. Ejecuta: npx supabase link --project-ref <ref>');
  return readFileSync(refFile, 'utf8').trim();
}

function parseEnvFile(path) {
  return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}

/** Web Push deja de funcionar en todos los navegadores si la clave cambia sin motivo: solo se crea si falta. */
function vapidSecretsToSet(existingNames) {
  if (existingNames.has('VAPID_PRIVATE_KEY') && existingNames.has('VAPID_PUBLIC_KEY')) {
    console.log('  VAPID ya está en Supabase: no se toca.');
    return {};
  }
  if (!existsSync(VAPID_FILE)) {
    const require = createRequire(import.meta.url);
    const keys = require('web-push').generateVAPIDKeys();
    writeFileSync(VAPID_FILE, [
      `VAPID_PUBLIC_KEY=${keys.publicKey}`,
      `VAPID_PRIVATE_KEY=${keys.privateKey}`,
      'VAPID_SUBJECT=mailto:admin@margube.com',
      '',
    ].join('\n'), { mode: 0o600 });
    console.log('  Claves VAPID nuevas en supabase/.env.push (fuera de git).');
  }
  const env = parseEnvFile(VAPID_FILE);
  console.log(`\n  ⚠ Pon esta clave pública en Vercel como VITE_VAPID_PUBLIC_KEY y vuelve a desplegar la web:\n    ${env.VAPID_PUBLIC_KEY}\n`);
  return env;
}

async function main() {
  const ref = linkedProject();
  const url = `https://${ref}.supabase.co`;
  try {
    read(['projects', 'list']);
  } catch {
    die('Sin sesión en Supabase. Ejecuta: npx supabase login');
  }

  if (!CHECK_ONLY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`Se va a desplegar en ${url}. Escribe el identificador (${ref}) para continuar: `);
    rl.close();
    if (answer.trim() !== ref) die('Cancelado.');
  }

  step('Comprobando el esquema de producción (solo lectura)');
  const expected = [
    ['notifications', 'read'], ['notifications', 'entity_id'], ['news', 'is_active'], ['news', 'author_id'],
    ['reservations', 'time_start'], ['reservations', 'room_id'], ['hour_compensations', 'hours'],
    ['documents', 'recipient_id'], ['requests', 'returned_at'], ['rooms', 'is_active'], ['policy_signatures', 'signed_at'],
  ];
  const found = query(`select table_name, column_name, data_type from information_schema.columns
    where table_schema = 'public' and table_name in (${[...new Set(expected.map(([t]) => `'${t}'`))].join(',')})`);
  const missing = expected.filter(([t, c]) => !found.some((f) => f.table_name === t && f.column_name === c));
  if (missing.length) die(`Faltan columnas que esta migración necesita: ${missing.map((m) => m.join('.')).join(', ')}`);
  const idTypes = found.filter((f) => f.table_name === 'notifications' && f.column_name === 'entity_id');
  console.log(`  Esquema correcto (notifications.entity_id: ${idTypes[0].data_type}).`);

  // Las migraciones antiguas se ejecutaron a mano en el SQL Editor. Si no constan en el historial,
  // `db push` las repetiría todas, y alguna reescribe cuentas de auth.users.
  step('Revisando el historial de migraciones');
  const files = readdirSync(join(ROOT, 'supabase/migrations')).sort();
  const versionOf = (f) => f.split('_')[0];
  const emptyVersions = new Set(files
    .filter((f) => statSync(join(ROOT, 'supabase/migrations', f)).size === 0)
    .map(versionOf));
  // Un proyecto que nunca usó `db push` no tiene ni la tabla del historial
  const [{ history, engine }] = query(`select to_regclass('supabase_migrations.schema_migrations') as history,
    to_regproc('notif_private.set_worker_config') as engine`);
  const applied = new Set(history
    ? query('select version from supabase_migrations.schema_migrations').map((r) => r.version)
    : []);
  const versions = files.map(versionOf);
  const engineApplied = Boolean(engine);
  // El esquema comprobado arriba (policy_signatures, rooms.is_active...) demuestra que ya se ejecutaron
  const unrecorded = versions.filter((v) => !applied.has(v) && (v < NEW_MIGRATION || (v === NEW_MIGRATION && engineApplied)));
  const pending = versions.filter((v) => !applied.has(v) && !unrecorded.includes(v));
  const pendingEmpty = pending.filter((v) => emptyVersions.has(v));

  if (CHECK_ONLY) {
    const listed = read(['secrets', 'list']);
    const functions = read(['functions', 'list']);
    const state = (ok) => (ok ? 'sí' : 'no');
    console.log(`  Motor de notificaciones aplicado: ${state(engineApplied)}`);
    console.log(`  Tabla de historial de migraciones: ${state(history)}`);
    console.log(`  Se marcarían como aplicadas: ${unrecorded.join(', ') || 'ninguna'}`);
    console.log(`  Se aplicarían: ${pending.filter((v) => !emptyVersions.has(v)).join(', ') || 'ninguna'}`);
    console.log(`  Vacías, sin aplicar: ${pendingEmpty.join(', ') || 'ninguna'}`);
    console.log(`  VAPID en Supabase: ${state(listed.includes('VAPID_PRIVATE_KEY') && listed.includes('VAPID_PUBLIC_KEY'))}`);
    console.log(`  Procesador desplegado: ${state(functions.includes(WORKER))}`);
    console.log('\nSolo lectura: no se ha cambiado nada.');
    return;
  }

  if (unrecorded.length) {
    console.log(`  Ya aplicadas a mano, sin constar en el historial: ${unrecorded.join(', ')}`);
    const repair = ['migration', 'repair', '--remote', '--yes', '--status', 'applied', ...unrecorded];
    // Si el motor ya está aplicado, el historial no impide seguir; sin él, db push repetiría todo
    if (engineApplied) {
      const result = spawnSync(command(repair), { cwd: ROOT, stdio: 'inherit', shell: true });
      if (result.status !== 0) console.warn(`  ⚠ Historial sin actualizar. Antes de usar db push, ejecuta: npx supabase ${repair.join(' ')}`);
    } else {
      run(repair);
    }
  }

  if (pendingEmpty.length) {
    // Aplicada, constaría como hecha aunque luego se rellene y su contenido no se ejecutaría nunca
    console.log(`  ⚠ Migraciones vacías que no se aplican: ${pendingEmpty.join(', ')}.`);
  }
  if (pending.length > pendingEmpty.length) {
    if (pendingEmpty.length) die('Hay migraciones vacías junto a otras pendientes: db push las aplicaría todas. Rellénalas o bórralas.');
    step('Aplicando las migraciones pendientes (pedirá la contraseña de la base de datos si hace falta)');
    run(['db', 'push', '--remote', '--yes']);
  } else {
    console.log('  No hay migraciones que aplicar.');
  }

  step('Secretos de la Edge Function');
  const listed = read(['secrets', 'list']);
  const existingNames = new Set(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'].filter((name) => listed.includes(name)));
  const workerSecret = randomBytes(32).toString('hex');
  const secrets = { ...vapidSecretsToSet(existingNames), NOTIFICATIONS_WORKER_SECRET: workerSecret };
  const dir = mkdtempSync(join(tmpdir(), 'margube-deploy-'));
  try {
    const file = join(dir, 'secrets.env');
    writeFileSync(file, Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
    // Se comprueba en Supabase: `secrets set` puede guardar el valor y tardar en devolver el control
    const before = secretLine('NOTIFICATIONS_WORKER_SECRET');
    const result = spawnSync(command(['secrets', 'set', '--yes', '--env-file', file]), {
      cwd: ROOT, stdio: 'inherit', shell: true, timeout: 60_000,
    });
    const after = secretLine('NOTIFICATIONS_WORKER_SECRET');
    if (!after || after === before) die('El secreto del procesador no se ha guardado en Supabase.');
    if (result.status !== 0) console.warn('  ⚠ La CLI no terminó bien, pero el secreto consta como guardado: se continúa.');
    console.log('  Secreto guardado.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  step('Edge Function (no necesita Docker)');
  run(['functions', 'deploy', WORKER, '--no-verify-jwt', '--use-api', '--yes']);

  step('Vault: dirección y secreto del procesador');
  const workerUrl = `${url}/functions/v1/${WORKER}`;
  query(`select notif_private.set_worker_config('${workerUrl}', '${workerSecret}')`, { write: true });

  step('Comprobación');
  const res = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-notifications-secret': workerSecret },
    body: JSON.stringify({ source: 'deploy' }),
  });
  if (res.status !== 202) die(`El procesador respondió ${res.status}. Revisa sus logs en el panel de Supabase.`);
  console.log('  El procesador responde.');
  // El primer arranque tarda más: descarga sus dependencias
  let lastRun = null;
  for (let i = 0; i < 12 && !lastRun; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    lastRun = query(`select last_run_at from notif_private.heartbeats where name = 'worker'`)[0]?.last_run_at;
  }
  if (!lastRun) die('El procesador no ha dejado constancia de ejecución: revisa sus logs.');
  const jobs = query(`select jobname, active from cron.job where jobname like 'notifications-%'`);
  console.log(`  Última ejecución: ${lastRun}. Tareas programadas: ${jobs.map((j) => j.jobname).join(', ')}.`);

  console.log(`
✅ Backend desplegado. Falta:
   1. Comprobar VITE_VAPID_PUBLIC_KEY en Vercel y publicar la web (git push).
   2. Compilar la app: cd mobile && npm run build:apk
   3. Cuando esté publicada, retirar la función antigua: npx supabase functions delete send-push --yes
   4. Pasar las pruebas físicas de docs/NOTIFICACIONES.md.`);
}

main().catch((err) => die(err.stderr?.toString() || err.message));
