import assert from 'node:assert/strict';
import { buildAssistantMessages, assistantPayloadBytes, requestAssistantReply } from '../shared/services/assistantClient.js';
import { nativeAssistantContext } from '../shared/services/assistantNative.js';

export async function runAssistantClientTests() {
  let passed = 0, failed = 0;
  const check = async (name, run) => { try { await run(); passed++; } catch (error) { failed++; console.error(name, error); } };
  await check('Unicode history stays below server byte limit', () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: '😀漢字\n"'.repeat(3000) }));
    const bounded = buildAssistantMessages(messages);
    assert.ok(bounded.length <= 12);
    assert.ok(Buffer.byteLength(JSON.stringify({ messages: bounded })) <= 20000);
    assert.equal(bounded.at(-1).role, 'user');
    assert.equal(assistantPayloadBytes({ messages: bounded }), Buffer.byteLength(JSON.stringify({ messages: bounded })));
  });
  await check('Keeps newest messages and removes split surrogate', () => {
    const history = buildAssistantMessages([{ role: 'user', content: 'a'.repeat(2999) + '😀' }]);
    assert.equal(history[0].content, 'a'.repeat(2999));
  });
  await check('Rejects empty or non-user final messages', () => {
    assert.throws(() => buildAssistantMessages([]));
    assert.throws(() => buildAssistantMessages([{ role: 'assistant', content: 'a' }]));
    assert.throws(() => buildAssistantMessages([{ role: 'user', content: '  ' }]));
  });
  const messages = [{ role: 'user', content: 'consulta' }];
  await check('Requires session before sending', async () => {
    await assert.rejects(requestAssistantReply({ messages, fetchImpl: () => assert.fail('No request allowed') }), /sesión/);
  });
  await check('Uses authenticated endpoint and bounded JSON', async () => {
    const answer = await requestAssistantReply({ accessToken: 'test', endpoint: 'https://example.test/api/assistant', messages, fetchImpl: async (url, init) => {
      assert.equal(url, 'https://example.test/api/assistant');
      assert.equal(init.headers.Authorization, 'Bearer test');
      assert.deepEqual(JSON.parse(init.body), { messages });
      return { ok: true, json: async () => ({ message: 'Respuesta', action: null }) };
    } });
    assert.equal(answer.message, 'Respuesta');
  });
  await check('Returns server errors without writes or retries', async () => {
    let calls = 0;
    await assert.rejects(requestAssistantReply({ accessToken: 'test', messages, fetchImpl: async () => { calls++; return { ok: false, json: async () => ({ error: 'Sesión inválida' }) }; } }), /Sesión inválida/);
    assert.equal(calls, 1);
  });
  await check('Handles HTML response from missing endpoint', async () => {
    await assert.rejects(requestAssistantReply({ accessToken: 'test', messages, fetchImpl: async () => ({ json: async () => { throw Error('HTML'); } }) }), /despliegue/);
  });
  await check('Rejects empty successful response', async () => {
    await assert.rejects(requestAssistantReply({ accessToken: 'test', messages, fetchImpl: async () => ({ ok: true, json: async () => ({ message: ' ' }) }) }), /válida/);
  });
  await check('Network failure is actionable', async () => {
    await assert.rejects(requestAssistantReply({ accessToken: 'test', messages, fetchImpl: async () => { throw new TypeError('fetch failed'); } }), /conexión/);
  });
  const abortingFetch = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
  await check('Timeout aborts request', async () => {
    await assert.rejects(requestAssistantReply({ accessToken: 'test', messages, timeoutMs: 5, fetchImpl: abortingFetch }), /demasiado/);
  });
  await check('Unmount cancellation aborts request', async () => {
    const controller = new AbortController();
    const pending = requestAssistantReply({ accessToken: 'test', messages, signal: controller.signal, fetchImpl: abortingFetch });
    controller.abort();
    await assert.rejects(pending, /cancelada/);
  });
  await check('Already cancelled request does not send', async () => {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(requestAssistantReply({ accessToken: 'test', messages, signal: controller.signal, fetchImpl: () => assert.fail() }), /cancelada/);
  });
  await check('Native adapter preserves form payload and current row', async () => {
    const calls = [];
    const context = nativeAssistantContext({ id: 'u' }, { requests: [{ id: 1, type: 'remoto', employeeId: 'u' }], personalDays: [{ id: 2, fileUrl: 'file' }],
      createRequest: async payload => calls.push(payload), createReservation: async payload => calls.push(payload),
      deleteRequest: async row => calls.push(row), setRequestStatus: async (row, status) => calls.push({ row, status }), setReservationStatus: async (...args) => calls.push(args) });
    await context.createRequest('u', { reason: 'motivo' });
    await context.createReservation('u', { room_id: 3 });
    await context.deleteRequest(2, 'asuntos_propios');
    await context.updateRequestStatus(1, 'approved');
    await context.updateReservationStatus(3, 'confirmed');
    assert.deepEqual(calls[0], { reason: 'motivo' });
    assert.deepEqual(calls[1], { room_id: 3 });
    assert.equal(calls[2].fileUrl, 'file'); assert.equal(calls[2].type, 'asuntos_propios');
    assert.equal(calls[3].row.employeeId, 'u'); assert.equal(calls[3].status, 'approved');
    assert.deepEqual(calls[4], [3, 'confirmed']);
    assert.throws(() => context.deleteRequest(999), /disponible/);
  });
  return { passed, failed };
}
