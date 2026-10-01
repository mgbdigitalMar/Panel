import { createClient } from '@supabase/supabase-js';

const url = 'https://exaggikhxozcfsifwxeq.supabase.co';
const key = 'sb_publishable_SaExpxl0EopS3TJPqqJDcg_SSU2Myvc';
const supabase = createClient(url, key);

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

function validateFileSize(file) {
  if (!file) return { valid: false, error: 'No se seleccionó ningún archivo.' };
  if (file.size > MAX_BYTES) {
    return { valid: false, error: 'El archivo supera el tamaño máximo permitido (15 MB).' };
  }
  return { valid: true, error: null };
}

async function runTests() {
  console.log('==================================================');
  console.log('🧪 INICIANDO SUITE DE TESTS: LÍMITES DE ARCHIVO (15 MB)');
  console.log('==================================================');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // TEST 1: Validación lógica de archivos permitidos <= 15MB
  console.log('\n[Test Set 1] Validación de tamaños en bytes:');
  const file1MB = { name: 'doc1.pdf', size: 1 * 1024 * 1024 };
  const file5MB = { name: 'image.png', size: 5 * 1024 * 1024 };
  const file10MB = { name: 'sheet.xlsx', size: 10 * 1024 * 1024 };
  const file14_9MB = { name: 'report.pdf', size: 14.9 * 1024 * 1024 };
  const file15MBExact = { name: 'exact.pdf', size: 15 * 1024 * 1024 };

  assert('Archivo de 1 MB es aceptado', validateFileSize(file1MB).valid === true);
  assert('Archivo de 5 MB es aceptado', validateFileSize(file5MB).valid === true);
  assert('Archivo de 10 MB es aceptado', validateFileSize(file10MB).valid === true);
  assert('Archivo de 14.9 MB es aceptado', validateFileSize(file14_9MB).valid === true);
  assert('Archivo de 15 MB exactos es aceptado', validateFileSize(file15MBExact).valid === true);

  // TEST 2: Validación lógica de archivos que superan 15MB
  console.log('\n[Test Set 2] Rechazo de archivos que superan 15 MB:');
  const file15_1MB = { name: 'too_big.pdf', size: 15.1 * 1024 * 1024 };
  const file16MB = { name: 'heavy.zip', size: 16 * 1024 * 1024 };
  const file20MB = { name: 'video.mp4', size: 20 * 1024 * 1024 };

  const res15_1 = validateFileSize(file15_1MB);
  assert('Archivo de 15.1 MB es rechazado con mensaje exacto de 15 MB', res15_1.valid === false && res15_1.error.includes('15 MB'));

  const res16 = validateFileSize(file16MB);
  assert('Archivo de 16 MB es rechazado con mensaje exacto de 15 MB', res16.valid === false && res16.error.includes('15 MB'));

  const res20 = validateFileSize(file20MB);
  assert('Archivo de 20 MB es rechazado con mensaje exacto de 15 MB', res20.valid === false && res20.error.includes('15 MB'));

  // TEST 3: Simulación de persistencia e inserción en Supabase con payload real de 15 MB
  console.log('\n[Test Set 3] Prueba de inserción real en Supabase con payload de 15 MB:');
  try {
    const { data: p, error: pErr } = await supabase.from('profiles').select('id').limit(1);
    assert('Lectura de perfil en Supabase exitosa', !pErr && p && p.length > 0);
    const userId = p[0].id;

    console.log('  Generando payload base64 de ~15 MB...');
    const payload15MB = 'data:application/pdf;base64,' + 'B'.repeat(15 * 1024 * 1024);
    
    const startTime = Date.now();
    const { data: doc, error: docErr } = await supabase.from('documents').insert([{
      title: '__TEST_15MB_VERIFICATION__',
      description: 'Prueba automatizada de subida de 15MB',
      file_url: payload15MB,
      sender_id: userId,
      recipient_id: userId,
      status: 'pending'
    }]).select('id, title, status');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    assert(`Inserción de 15 MB en Supabase completada en ${duration}s sin errores`, !docErr && doc && doc.length > 0);

    if (doc && doc[0]) {
      const { error: delErr } = await supabase.from('documents').delete().eq('id', doc[0].id);
      assert('Limpieza del registro de prueba de 15 MB en Supabase exitosa', !delErr);
    }
  } catch (err) {
    console.error('  Excepción en prueba con Supabase:', err);
    failed++;
  }

  console.log('\n==================================================');
  console.log(`📊 RESULTADOS: ${passed} pruebas superadas, ${failed} fallidas`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
