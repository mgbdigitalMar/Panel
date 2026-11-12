import { useEffect, useRef, useState } from 'react';
import { prepareAssistantAction, executeAssistantAction } from '../services/assistant.js';
import { requestAssistantReply } from '../services/assistantClient.js';

export function useAssistantConversation({ context, getAccessToken, endpoint, loadingData = false, loadFailed = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const request = useRef(null);
  const latest = useRef(context);
  useEffect(() => { latest.current = context; }, [context]);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);

  const send = async () => {
    const content = input.trim();
    if (!content || locked.current || proposal || loadingData || loadFailed) return;
    locked.current = true;
    setBusy(true); setError(''); setInput('');
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    const current = generation.current;
    request.current = new AbortController();
    try {
      const accessToken = await getAccessToken();
      const data = await requestAssistantReply({ accessToken, messages: next, endpoint, signal: request.current.signal });
      if (generation.current !== current) return;
      setMessages(list => [...list, { role: 'assistant', content: data.message }]);
      if (data.action) {
        try {
          const prepared = prepareAssistantAction(data.action, latest.current);
          setProposal({ action: data.action, prepared, expiresAt: Date.now() + 5 * 60 * 1000 });
        } catch (failure) {
          setError(`${failure.message} No se ha realizado ningún cambio.`);
        }
      }
    } catch (failure) {
      if (generation.current === current) { setMessages(messages); setInput(content); setError(failure.message); }
    } finally {
      if (generation.current === current) { locked.current = false; setBusy(false); request.current = null; }
    }
  };

  const confirm = async () => {
    if (!proposal || locked.current || loadingData || loadFailed) return;
    locked.current = true; setBusy(true); setError('');
    const current = generation.current;
    try {
      if (Date.now() > proposal.expiresAt) throw new Error('La propuesta ha caducado. Pide que la prepare de nuevo.');
      const done = await executeAssistantAction(proposal.action, latest.current);
      if (generation.current === current) setMessages(list => [...list, { role: 'assistant', content: `Acción completada: ${done.title}. Puedes comprobar el resultado en la sección correspondiente.` }]);
    } catch (failure) {
      if (generation.current === current) setError(`${failure.message} Comprueba el estado del trámite antes de repetirlo.`);
    } finally {
      if (generation.current === current) { setProposal(null); locked.current = false; setBusy(false); }
    }
  };

  const cancel = () => {
    if (locked.current) return;
    setProposal(null);
    setMessages(list => [...list, { role: 'assistant', content: 'Propuesta descartada. No se ha ejecutado.' }]);
  };
  const clear = () => {
    if (locked.current) return;
    generation.current++;
    setMessages([]); setProposal(null); setError(''); setInput('');
  };
  return { messages, input, setInput, busy, error, proposal, send, confirm, cancel, clear,
    blocked: busy || !!proposal || loadingData || loadFailed };
}
