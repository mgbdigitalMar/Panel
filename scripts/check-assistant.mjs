import { createAssistantHandler } from '../server/assistant.mjs';
import { prepareAssistantAction, executeAssistantAction } from '../shared/services/assistant.js';

process.loadEnvFile('.env.local');
const user = { id: '00000000-0000-4000-8000-000000000001', name: 'Persona de prueba', role: 'employee', first_login: false };
const fixtures = { profiles: user, requests: [], personal_days: [], reservations: [], rooms: [{ id: 7, name: 'Sala de prueba', capacity: 8, is_active: true }], vehicles: [] };
const handler = createAssistantHandler({
  env: (name) => process.env[name] || (name === 'SUPABASE_URL' ? process.env.VITE_SUPABASE_URL : name === 'SUPABASE_ANON_KEY' ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined),
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table) => {
      const query = {
        select: () => query, eq: () => query, neq: () => query, gte: () => query, order: () => query, limit: () => query,
        single: async () => ({ data: user, error: null }),
        then: (resolve, reject) => Promise.resolve({ data: fixtures[table] || [], count: 0, error: null }).then(resolve, reject),
      };
      return query;
    },
  }),
  fetchImpl: async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) {
      const detail = await response.clone().json().catch(() => ({}));
      const message = String(detail.error?.message || '').replaceAll(process.env.GROQ_API_KEY, '[redacted]').slice(0, 500);
      console.log(JSON.stringify({ providerStatus: response.status, code: detail.error?.code, message }));
    }
    return response;
  },
});

for (const [expected, content] of [
  ['create_request', 'Solicita trabajo en remoto el 18 de enero de 2027, solo ese día, motivo: trabajo de concentración. Prepara la propuesta para confirmar.'],
  ['create_reservation', 'Reserva la Sala de prueba el 19 de enero de 2027 de 10:00 a 11:00 para una reunión de coordinación. Prepara la propuesta para confirmar.'],
]) {
  const response = await handler(new Request('http://localhost/api/assistant', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-test', 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content }] }),
  }));
  const answer = await response.json();
  let serviceCalled = false;
  if (response.ok && answer.action?.kind === expected) {
    const context = { user, rooms: [{ id: 7, name: 'Sala de prueba', isActive: true }], reservations: [], requests: [], personalDays: [],
      createRequest: async (actor, payload) => { serviceCalled = actor === user.id && payload.type === 'remoto'; return { data: { id: 'synthetic-only' } }; },
      createReservation: async (actor, payload) => { serviceCalled = actor === user.id && payload.room_id === 7 && payload.status === 'pending'; return { data: { id: 'synthetic-only' } }; },
    };
    try {
      prepareAssistantAction(answer.action, context);
      await executeAssistantAction(answer.action, context);
    } catch (error) {
      console.log(JSON.stringify({ validationError: error.message, syntheticAction: answer.action }));
    }
  }
  console.log(JSON.stringify({ expected, status: response.status, proposed: answer.action?.kind || null, confirmationDispatchValidated: serviceCalled, databaseWrites: 0, error: answer.error || null }));
  if (!response.ok || !serviceCalled) process.exitCode = 1;
}
