export const ASSISTANT_HISTORY_BYTES = 20000;
export const ASSISTANT_EXAMPLES = ['¿Qué solicitudes tengo pendientes?', 'Quiero solicitar trabajo en remoto', 'Ayúdame a reservar una sala'];

export function assistantPayloadBytes(value) {
  let bytes = 0;
  for (const char of JSON.stringify(value)) {
    const point = char.codePointAt(0);
    bytes += point <= 0x7F ? 1 : point <= 0x7FF ? 2 : point <= 0xFFFF ? 3 : 4;
  }
  return bytes;
}

export function buildAssistantMessages(messages) {
  const history = messages.slice(-12).map(({ role, content }) => ({
    role, content: content.slice(0, 3000).replace(/[\uD800-\uDBFF]$/, ''),
  }));
  if (!history.length || history.at(-1).role !== 'user'
    || history.some(m => !['user', 'assistant'].includes(m.role) || !m.content.trim())) {
    throw new Error('Escribe un mensaje para el asistente.');
  }
  while (history.length > 1 && assistantPayloadBytes({ messages: history }) > ASSISTANT_HISTORY_BYTES) history.shift();
  return history;
}

export async function requestAssistantReply({ accessToken, messages, endpoint = '/api/assistant', signal, fetchImpl = fetch, timeoutMs = 32000 }) {
  if (!accessToken) throw new Error('La sesión ha caducado. Vuelve a entrar.');
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; cancel(); }, timeoutMs);
  try {
    if (controller.signal.aborted) throw new Error('Consulta cancelada.');
    const response = await fetchImpl(endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ messages: buildAssistantMessages(messages) }),
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('El servidor del asistente no está disponible en este despliegue.'); }
    if (!response.ok) throw new Error(data?.error || 'No se ha podido conectar con el asistente.');
    if (!data || typeof data.message !== 'string' || !data.message.trim()) throw new Error('No se ha recibido una respuesta válida.');
    return data;
  } catch (error) {
    if (timedOut) throw new Error('El asistente ha tardado demasiado. Vuelve a intentarlo.');
    if (controller.signal.aborted) throw new Error('Consulta cancelada.');
    if (error instanceof TypeError) throw new Error('No se ha podido conectar. Revisa tu conexión y vuelve a intentarlo.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
