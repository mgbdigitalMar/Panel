import { runAuthSecurityTests } from './01_auth_security.test.mjs';
import { runDatabaseSchemaTests } from './02_database_schema.test.mjs';
import { runCrudLifecycleTests } from './03_crud_lifecycle.test.mjs';
import { runBusinessLogicTests } from './04_business_logic.test.mjs';
import { runFrontendIntegrityTests } from './05_frontend_integrity.test.mjs';
import { runMobileAppTests } from './06_mobile_app.test.mjs';
import { runSecurityHardeningTests } from './07_security_hardening.test.mjs';
import { runTeamAvailabilityTests } from './08_team_availability.test.mjs';
import { runUxStatesTests } from './09_ux_states.test.mjs';
import { runPrivateDniTests } from './10_private_dni.test.mjs';
import { runPolicySignatureTests } from './11_policy_signature.test.mjs';
import { runGlassAppearanceTests } from './12_glass_appearance.test.mjs';

// Suites 2 and 3 read and write the real Supabase project (suite 3 creates and
// deletes rows): they only run when asked, e.g. against a staging project.
const LIVE_DB = process.env.RUN_LIVE_DB_TESTS === '1';

async function main() {
  const startGlobal = Date.now();
  console.log('================================================================');
  console.log('🚀 MARGUBE INTRANET: SUITE COMPLETA DE PRUEBAS (WEB + APP MÓVIL)');
  console.log('================================================================');

  const suites = [
    { name: 'Autenticación, Seguridad y Sesión', fn: runAuthSecurityTests },
    { name: 'Esquema de BD y Relaciones Supabase', fn: runDatabaseSchemaTests, live: true },
    { name: 'Ciclo de Vida CRUD y Persistencia', fn: runCrudLifecycleTests, live: true },
    { name: 'Lógica de Negocio y Validaciones', fn: runBusinessLogicTests },
    { name: 'Integridad del Frontend y Assets', fn: runFrontendIntegrityTests },
    { name: 'App Móvil y Servicios Compartidos', fn: runMobileAppTests },
    { name: 'Refuerzo de Seguridad', fn: runSecurityHardeningTests },
    { name: 'Disponibilidad del Equipo', fn: runTeamAvailabilityTests },
    { name: 'Estados de Carga y Error', fn: runUxStatesTests },
    { name: 'DNI Privado', fn: runPrivateDniTests },
    { name: 'Firma de Normas Internas', fn: runPolicySignatureTests },
    { name: 'Diseño Cristal', fn: runGlassAppearanceTests },
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  const summary = [];

  for (const suite of suites) {
    if (suite.live && !LIVE_DB) {
      summary.push({ suite: suite.name, passed: 0, failed: 0, time: '-', status: '⏭️ OMITIDA (RUN_LIVE_DB_TESTS=1)' });
      continue;
    }
    const t0 = Date.now();
    try {
      const res = await suite.fn();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      totalPassed += res.passed;
      totalFailed += res.failed;
      summary.push({
        suite: suite.name,
        passed: res.passed,
        failed: res.failed,
        time: `${elapsed}s`,
        status: res.failed === 0 ? '✅ APROBADO' : '❌ FALLIDO',
      });
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      totalFailed++;
      summary.push({
        suite: suite.name,
        passed: 0,
        failed: 1,
        time: `${elapsed}s`,
        status: '❌ EXCEPCIÓN',
      });
      console.error(`Error ejecutando suite ${suite.name}:`, err);
    }
  }

  const totalTime = ((Date.now() - startGlobal) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log('📊 RESUMEN EJECUTIVO DE PRUEBAS');
  console.log('================================================================');
  console.table(summary);

  console.log(`\nTOTALES: ${totalPassed} pruebas superadas, ${totalFailed} pruebas fallidas en ${totalTime}s.`);

  if (totalFailed > 0) {
    console.log('❌ Se detectaron fallos en la suite de pruebas.\n');
    process.exit(1);
  } else {
    console.log('🎉 TODAS LAS PRUEBAS DE LA WEB SE EJECUTARON CON ÉXITO SIN ERRORES.\n');
    process.exit(0);
  }
}

main();
