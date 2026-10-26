import fs from 'fs';
import path from 'path';
import { fetchRequests } from '../shared/services/requests.js';
import { fetchReservations, fetchRooms, fetchVehicles } from '../shared/services/reservations.js';
import { fetchDocuments } from '../shared/services/documents.js';
import { fetchHourCompensations } from '../shared/services/hours.js';
import { fetchPersonalDays } from '../shared/services/personalDays.js';
import { fetchNews } from '../shared/services/news.js';
import { fetchNotifications } from '../shared/services/notifications.js';

export async function runUxStatesTests() {
  console.log('\n🔵 [SUITE 9: Estados de carga y error (web + app)]');
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

  // Fake Supabase: every query resolves with `result`
  const fake = (result) => ({
    from: () => {
      const q = { select: () => q, order: () => q, eq: () => q, limit: () => q, then: (res) => res(result) };
      return q;
    },
  });
  const failing = fake({ data: null, error: { message: 'Failed to fetch' } });
  const empty = fake({ data: [], error: null });

  // Silence the expected error logs of the failing fetches
  const { error: logErr, warn: logWarn } = console;
  console.error = () => {};
  console.warn = () => {};
  const fetchers = [
    ['solicitudes', (sb) => fetchRequests(sb)],
    ['reservas', (sb) => fetchReservations(sb)],
    ['salas', (sb) => fetchRooms(sb)],
    ['vehículos', (sb) => fetchVehicles(sb)],
    ['documentos', (sb) => fetchDocuments(sb)],
    ['horas', (sb) => fetchHourCompensations(sb)],
    ['asuntos propios', (sb) => fetchPersonalDays(sb)],
    ['noticias', (sb) => fetchNews(sb)],
    ['avisos', (sb) => fetchNotifications(sb, 'u1')],
  ];
  const results = [];
  for (const [name, fn] of fetchers) {
    results.push([name, await fn(failing), await fn(empty)]);
  }
  console.error = logErr;
  console.warn = logWarn;
  for (const [name, onError, onEmpty] of results) {
    assert(`${name}: un fallo devuelve null (no una lista vacía)`, onError === null);
    assert(`${name}: sin filas devuelve []`, Array.isArray(onEmpty) && onEmpty.length === 0);
  }

  const root = process.cwd();
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

  // App: un fallo conserva lo que hay en pantalla y lo dice al refrescar
  const data = read('mobile', 'src', 'context', 'DataContext.js');
  assert('App: las listas se guardan con keep() (un null no las vacía)', !/\bset(Requests|Reservations|Rooms|Vehicles|Documents|Hours|PersonalDays|News|Notifications)\(await svc\.fetch/.test(data));
  assert('App: lastSync solo avanza si todo cargó', data.includes('if (syncFailed.current) return false;'));
  assert('App: refrescar sin conexión avisa', data.includes("toast.error('No se ha podido actualizar'"));

  // Web: aviso con reintento y sin alert() del navegador
  const ctx = read('src', 'context', 'index.jsx');
  const layout = read('src', 'components', 'Layout.jsx');
  assert('Web: las cargas fallidas se registran', (ctx.match(/setLoadFailed\(true\)/g) || []).length >= 8);
  assert('Web: Layout ofrece reintentar', layout.includes('loadFailed && !loadingData') && layout.includes('Reintentar'));
  assert('Web: reservas fallidas no vacían la lista', ctx.includes('if (data) setReservationsState(data)'));
  for (const page of fs.readdirSync(path.join(root, 'src', 'pages')).filter((f) => f.endsWith('.jsx'))) {
    assert(`Web: ${page} no usa alert() del navegador`, !/(^|[^.\w])alert\(/.test(read('src', 'pages', page)));
  }
  assert('Web: los avisos se anuncian a lectores de pantalla sin repetirse',
    read('src', 'components', 'LiveToastContainer.jsx').includes('aria-relevant="additions"'));

  return { passed, failed };
}
