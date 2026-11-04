#!/usr/bin/env node
// Despliega el backend de notificaciones en el proyecto de Supabase enlazado. Es repetible.
//
//   npx supabase login
//   npx supabase link --project-ref <ref>
//   node scripts/deploy-notifications.mjs
//
// La base de datos debe ir antes que la web: la web anterior sigue funcionando con la migración
// aplicada, pero la web nueva necesita sus funciones. Los pasos manuales están en docs/NOTIFICACIONES.md.
import { execFileSync, spawnSync } from 'node:child_process';
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
const SHELL = process.platform === 'win32';
const NPX = SHELL ? 'npx.cmd' : 'npx';
const CLI = ['--yes', 'supabase@3'];

const die = (message) => {
  console.error(`\n❌ ${message}`);
  process.exit(1);
};
const step = (message) => console.log(`\n▶ ${message}`);

/** Salida capturada: para lecturas. */
function read(args) {
  return execFileSync(NPX, [...CLI, ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: SHELL });
}
/** A la vista de quien lo ejecuta, que puede responder (contraseña de la base de datos). */
function run(args) {
  const result = spawnSync(NPX, [...CLI, ...args], { cwd: ROOT, stdio: 'inherit', shell: SHELL });
  if (result.status !== 0) die(`Falló: supabase ${args.join(' ')}`);
}
function query(sql) {
  // En un archivo temporal: ni la consulta ni los secretos pasan por la línea de comandos
  const dir = mkdtempSync(join(tmpdir(), 'margube-deploy-'));
  try {
    const file = join(dir, 'query.sql');
    writeFileSync(file, sql, { mode: 0o600 });
    const output = read(['db', 'query', '--remote', '--yes', '--output-format', 'json', '-f', file]);
    return JSON.parse(output.slice(output.indexOf('{'))).rows ?? [];
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

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Se va a desplegar en ${url}. Escribe el identificador (${ref}) para continuar: `);
  rl.close();
  if (answer.trim() !== ref) die('Cancelado.');

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
  const empty = readdirSync(join(ROOT, 'supabase/migrations'))
    .filter((f) => statSync(join(ROOT, 'supabase/migrations', f)).size === 0);
  if (empty.length) {
    die(`Hay migraciones vacías: ${empty.join(', ')}. Una vez aplicadas constarían como hechas aunque luego se rellenen. Rellénalas o bórralas antes de desplegar.`);
  }
  const versions = readdirSync(join(ROOT, 'supabase/migrations')).map((f) => f.split('_')[0]).sort();
  const applied = new Set(query(`select version from supabase_migrations.schema_migrations`).map((r) => r.version));
  const unrecorded = versions.filter((v) => v < NEW_MIGRATION && !applied.has(v));
  if (unrecorded.length) {
    // El esquema comprobado arriba (policy_signatures, rooms.is_active...) demuestra que ya se ejecutaron
    console.log(`  Ya aplicadas a mano, sin constar en el historial: ${unrecorded.join(', ')}`);
    run(['migration', 'repair', '--remote', '--yes', '--status', 'applied', ...unrecorded]);
  }

  step('Aplicando la migración (pedirá la contraseña de la base de datos si hace falta)');
  run(['db', 'push', '--remote', '--yes']);

  step('Secretos de la Edge Function');
  const listed = read(['secrets', 'list']);
  const existingNames = new Set(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'].filter((name) => listed.includes(name)));
  const workerSecret = randomBytes(32).toString('hex');
  const secrets = { ...vapidSecretsToSet(existingNames), NOTIFICATIONS_WORKER_SECRET: workerSecret };
  const dir = mkdtempSync(join(tmpdir(), 'margube-deploy-'));
  try {
    const file = join(dir, 'secrets.env');
    writeFileSync(file, Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
    run(['secrets', 'set', '--yes', '--env-file', file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  step('Edge Function (no necesita Docker)');
  run(['functions', 'deploy', WORKER, '--no-verify-jwt', '--use-api', '--yes']);

  step('Vault: dirección y secreto del procesador');
  const workerUrl = `${url}/functions/v1/${WORKER}`;
  query(`select notif_private.set_worker_config('${workerUrl}', '${workerSecret}')`);

  step('Comprobación');
  const res = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-notifications-secret': workerSecret },
    body: JSON.stringify({ source: 'deploy' }),
  });
  if (res.status !== 202) die(`El procesador respondió ${res.status}. Revisa sus logs en el panel de Supabase.`);
  console.log('  El procesador responde.');
  await new Promise((r) => setTimeout(r, 5000));
  const [{ last_run_at: lastRun } = {}] = query(`select last_run_at from notif_private.heartbeats where name = 'worker'`);
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
