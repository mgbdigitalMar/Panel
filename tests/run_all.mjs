import { runAuthSecurityTests } from './01_auth_security.test.mjs';
import { runDatabaseSchemaTests } from './02_database_schema.test.mjs';
import { runCrudLifecycleTests } from './03_crud_lifecycle.test.mjs';
import { runBusinessLogicTests } from './04_business_logic.test.mjs';
import { runFrontendIntegrityTests } from './05_frontend_integrity.test.mjs';

async function main() {
  const startGlobal = Date.now();
  console.log('================================================================');
  console.log('🚀 MARGUBE INTRANET: SUITE COMPLETA DE PRUEBAS DE LA WEB');
  console.log('================================================================');

  const suites = [
    { name: 'Autenticación, Seguridad y Sesión', fn: runAuthSecurityTests },
    { name: 'Esquema de BD y Relaciones Supabase', fn: runDatabaseSchemaTests },
    { name: 'Ciclo de Vida CRUD y Persistencia', fn: runCrudLifecycleTests },
    { name: 'Lógica de Negocio y Validaciones', fn: runBusinessLogicTests },
    { name: 'Integridad del Frontend y Assets', fn: runFrontendIntegrityTests },
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  const summary = [];

  for (const suite of suites) {
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
