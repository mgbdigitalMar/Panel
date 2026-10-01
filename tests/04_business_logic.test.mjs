export async function runBusinessLogicTests() {
  console.log('\n🔵 [SUITE 4: Lógica de Negocio y Validaciones]');
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

  // 1. Validación de Horas (Bolsa de Horas)
  function validateHours(val) {
    const n = parseFloat(val);
    if (isNaN(n)) return { valid: false, error: 'Debe ser un número' };
    if (n <= 0) return { valid: false, error: 'Las horas deben ser mayores a 0' };
    if (n > 24) return { valid: false, error: 'Las horas no pueden exceder 24 por día' };
    return { valid: true, error: null };
  }

  assert('Horas válidas (2.5h) son aceptadas', validateHours(2.5).valid === true);
  assert('Horas válidas (8h) son aceptadas', validateHours('8').valid === true);
  assert('Horas negativas (-1h) son rechazadas', validateHours(-1).valid === false);
  assert('Horas cero (0h) son rechazadas', validateHours(0).valid === false);
  assert('Horas superiores a 24h (25h) son rechazadas', validateHours(25).valid === false);
  assert('Entrada no numérica ("abc") es rechazada', validateHours('abc').valid === false);

  // 2. Validación de archivos (15 MB y extensiones)
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.webp', '.txt'];

  function validateDocumentUpload(file) {
    if (!file) return { valid: false, error: 'Archivo requerido' };
    if (file.size > MAX_FILE_BYTES) return { valid: false, error: 'Supera 15 MB' };
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) return { valid: false, error: 'Extensión no permitida' };
    return { valid: true, error: null };
  }

  assert('Archivo de 1 MB (.pdf) es aceptado', validateDocumentUpload({ name: 'documento.pdf', size: 1024 * 1024 }).valid === true);
  assert('Archivo de 15 MB (.xlsx) es aceptado', validateDocumentUpload({ name: 'balance.xlsx', size: 15 * 1024 * 1024 }).valid === true);
  assert('Archivo de 15.5 MB es rechazado', validateDocumentUpload({ name: 'pesado.pdf', size: 15.5 * 1024 * 1024 }).valid === false);
  assert('Archivo con extensión permitida (.png) es aceptado', validateDocumentUpload({ name: 'foto.PNG', size: 500000 }).valid === true);
  assert('Archivo con extensión peligrosa (.exe) es rechazado', validateDocumentUpload({ name: 'malware.exe', size: 500000 }).valid === false);
  assert('Archivo con extensión de script (.sh) es rechazado', validateDocumentUpload({ name: 'run.sh', size: 1000 }).valid === false);

  // 3. Detección de solapamiento en reservas (Salas y Vehículos)
  function hasTimeConflict(newRes, existingReservations) {
    const parseMins = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const newStart = parseMins(newRes.timeStart);
    const newEnd = parseMins(newRes.timeEnd);

    return existingReservations.some(r => {
      if (r.resourceId !== newRes.resourceId || r.date !== newRes.date) return false;
      const existStart = parseMins(r.timeStart);
      const existEnd = parseMins(r.timeEnd);
      // Solapamiento: el inicio de uno es antes del fin del otro, y viceversa
      return newStart < existEnd && newEnd > existStart;
    });
  }

  const existingRes = [
    { resourceId: 'room-1', date: '2026-10-15', timeStart: '10:00', timeEnd: '11:30' },
    { resourceId: 'room-2', date: '2026-10-15', timeStart: '10:00', timeEnd: '11:00' },
  ];

  assert('Reserva sin solapamiento (11:30 a 12:30 en room-1) es válida', !hasTimeConflict({ resourceId: 'room-1', date: '2026-10-15', timeStart: '11:30', timeEnd: '12:30' }, existingRes));
  assert('Reserva con solapamiento parcial (10:30 a 11:30 en room-1) es detectada como conflicto', hasTimeConflict({ resourceId: 'room-1', date: '2026-10-15', timeStart: '10:30', timeEnd: '11:30' }, existingRes));
  assert('Reserva en otra sala al mismo tiempo no genera conflicto', !hasTimeConflict({ resourceId: 'room-3', date: '2026-10-15', timeStart: '10:00', timeEnd: '11:00' }, existingRes));
  assert('Reserva en otro día no genera conflicto', !hasTimeConflict({ resourceId: 'room-1', date: '2026-10-16', timeStart: '10:00', timeEnd: '11:00' }, existingRes));

  // 4. Cálculo robusto de cumpleaños en Dashboard
  function calculateUpcomingBirthdays(employees) {
    const valid = employees.filter(e => e.birthdate && !isNaN(new Date(e.birthdate).getTime()));
    return valid.map(e => {
      const bdate = new Date(e.birthdate);
      return { name: e.name, month: bdate.getMonth() + 1, day: bdate.getDate() };
    });
  }

  const sampleEmps = [
    { name: 'Ana', birthdate: '1990-05-12' },
    { name: 'Luis', birthdate: null },
    { name: 'Pedro', birthdate: '' },
    { name: 'Marta', birthdate: 'fecha-invalida' },
    { name: 'Sofia', birthdate: '1985-11-20' },
  ];

  const processedBirthdays = calculateUpcomingBirthdays(sampleEmps);
  assert('Filtro de cumpleaños descarta nulos, cadenas vacías y fechas inválidas', processedBirthdays.length === 2);
  assert('Cumpleaños válidos extraen día y mes correctamente', processedBirthdays[0].name === 'Ana' && processedBirthdays[0].day === 12);

  // 5. Formato de exportación CSV
  function generateCSV(headers, rows) {
    const escapeVal = (v) => {
      const s = String(v ?? '');
      if (s.includes(';') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [
      headers.join(';'),
      ...rows.map(r => r.map(escapeVal).join(';'))
    ];
    return '\uFEFF' + lines.join('\r\n');
  }

  const csvOutput = generateCSV(
    ['Empleado', 'Horas', 'Motivo'],
    [
      ['Juan Pérez', '5,5', 'Horas extra fin de semana'],
      ['María Gómez', '2', 'Reunión con cliente; urgente']
    ]
  );
  assert('CSV incluye BOM UTF-8 para compatibilidad con Excel', csvOutput.startsWith('\uFEFF'));
  assert('CSV escapa valores con punto y coma entre comillas dobles', csvOutput.includes('"Reunión con cliente; urgente"'));

  return { passed, failed };
}
