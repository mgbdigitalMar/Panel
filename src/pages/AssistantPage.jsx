import { useEffect, useRef, useState } from 'react';
import { MessageSquareText, Send, RotateCcw, ShieldCheck, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useRequests, useReservations, usePersonalDays, useDataSync } from '../context';
import { Card, Button } from '../components/ui';
import { supabase } from '../utils/supabase';
import { prepareAssistantAction, executeAssistantAction } from '../../shared/services/assistant.js';
import styles from './AssistantPage.module.scss';

const EXAMPLES = ['¿Qué solicitudes tengo pendientes?', 'Quiero solicitar trabajo en remoto', 'Ayúdame a reservar una sala'];

function AssistantConversation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const requestData = useRequests();
  const reservationData = useReservations();
  const dayData = usePersonalDays();
  const { loadingData, loadFailed } = useDataSync();
  const context = { user, ...requestData, ...reservationData, ...dayData };
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages, proposal, busy]);

  const send = async (event) => {
    event?.preventDefault();
    const content = input.trim();
    if (!content || locked.current || proposal || loadingData || loadFailed) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setInput('');
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    const current = generation.current;
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error('La sesión ha caducado. Vuelve a entrar.');
      const response = await fetch('/api/assistant', {
        method: 'POST', signal: AbortSignal.timeout(32000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ messages: next.slice(-12).map(({ role, content: value }) => ({ role, content: value.slice(0, 3000) })) }),
      });
      if (generation.current !== current) return;
      let data;
      try { data = await response.json(); } catch { throw new Error('El servidor del asistente no está disponible en este despliegue.'); }
      if (!response.ok) throw new Error(data?.error || 'No se ha podido conectar con el asistente.');
      if (!data || typeof data.message !== 'string' || !data.message.trim()) throw new Error('No se ha recibido una respuesta válida.');
      setMessages((list) => [...list, { role: 'assistant', content: data.message }]);
      if (data.action) {
        try {
          const prepared = prepareAssistantAction(data.action, context);
          setProposal({ action: data.action, prepared, expiresAt: Date.now() + 5 * 60 * 1000 });
        } catch (validationError) {
          setError(`${validationError.message} No se ha realizado ningún cambio.`);
          setMessages((list) => [...list, { role: 'assistant', content: `La propuesta no ha superado la validación: ${validationError.message} Corrige los datos para preparar una nueva propuesta.` }]);
        }
      }
    } catch (failure) {
      if (generation.current === current) { setMessages(messages); setError(failure.message); setInput(content); }
    } finally {
      if (generation.current === current) { locked.current = false; setBusy(false); }
    }
  };

  const confirm = async () => {
    if (!proposal || locked.current || loadingData || loadFailed) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const current = generation.current;
    try {
      if (Date.now() > proposal.expiresAt) throw new Error('La propuesta ha caducado. Pide que la prepare de nuevo.');
      const done = await executeAssistantAction(proposal.action, context);
      if (generation.current === current) setMessages((list) => [...list, { role: 'assistant', content: `Acción completada: ${done.title}. Puedes comprobar el resultado en la sección correspondiente.` }]);
    } catch (failure) {
      if (generation.current === current) setError(`${failure.message} Comprueba el estado del trámite antes de volver a pedir la acción.`);
    } finally {
      // A failed or interrupted write must be checked, not retried automatically.
      if (generation.current === current) { setProposal(null); locked.current = false; setBusy(false); }
    }
  };

  const cancel = () => {
    setProposal(null);
    setMessages((list) => [...list, { role: 'assistant', content: 'Propuesta descartada. No se ha ejecutado.' }]);
  };

  const clear = () => {
    if (locked.current) return;
    generation.current++;
    setMessages([]); setProposal(null); setError(''); setInput('');
    inputRef.current?.focus();
  };

  return (
    <div className={styles.page}>
      <Card className={styles.conversation}>
        <div className={styles.header}>
          <div><MessageSquareText size={20} aria-hidden="true" /><h2>Asistente Margube</h2></div>
          <Button variant="ghost" icon={RotateCcw} onClick={clear} disabled={busy}>Nueva conversación</Button>
        </div>
        <div className={styles.log} role="log" aria-label="Conversación con el asistente" aria-relevant="additions" aria-live="polite">
          {messages.length === 0 && (
            <div className={styles.empty}>
              <h3>¿Qué necesitas hacer?</h3>
              <p>Consulta tus trámites, prepara una solicitud o reserva. Antes de cambiar algo verás una propuesta para confirmar.</p>
              <div className={styles.examples}>
                {[...EXAMPLES, ...(user.role === 'admin' ? ['Resume las solicitudes pendientes del equipo'] : [])].map((example) => (
                  <button type="button" key={example} disabled={busy} onClick={() => { setInput(example); inputRef.current?.focus(); }}>{example}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div key={index} className={styles.message} data-author={message.role}>
              <strong>{message.role === 'user' ? 'Tú' : 'Asistente'}</strong>
              <p>{message.content}</p>
            </div>
          ))}
          {busy && <p className={styles.status} role="status">{proposal ? 'Comprobando y ejecutando la acción…' : 'Consultando tus datos y preparando la respuesta…'}</p>}
          <div ref={endRef} />
        </div>
        {proposal && (
          <section className={styles.proposal} aria-labelledby="assistant-proposal">
            <span>Propuesta sin ejecutar</span>
            <h3 id="assistant-proposal">{proposal.prepared.title}</h3>
            <ul>{proposal.prepared.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
            <p>{proposal.prepared.danger ? 'Revisa los datos: esta acción puede eliminar el registro o cambiar su estado.' : 'Se aplicarán las mismas validaciones que en el formulario.'}</p>
            <div className={styles.actions}>
              <Button variant="secondary" icon={X} disabled={busy} onClick={cancel}>Descartar</Button>
              <Button variant={proposal.prepared.danger ? 'danger' : 'primary'} icon={Check} loading={busy} disabled={loadingData || loadFailed} onClick={confirm}>Confirmar acción</Button>
            </div>
          </section>
        )}
        {error && <div className={styles.error} role="alert">
          <p>{error}</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => navigate('/requests?nueva=1')}>Abrir solicitud</Button>
            <Button variant="secondary" onClick={() => navigate('/reservations?nueva=1')}>Abrir reserva</Button>
          </div>
        </div>}
        {(loadingData || loadFailed) && <p className={styles.status} role="status">{loadFailed ? 'Hay datos que no se han podido cargar. Actualiza la página antes de continuar.' : 'Cargando tus trámites…'}</p>}
        <form className={styles.composer} onSubmit={send}>
          <label htmlFor="assistant-message">Tu mensaje</label>
          <textarea id="assistant-message" ref={inputRef} value={input} maxLength={3000} rows={3}
            disabled={busy || !!proposal || loadingData || loadFailed} onChange={(event) => setInput(event.target.value)}
            placeholder="Por ejemplo: quiero solicitar trabajo en remoto el próximo lunes"
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
          <div className={styles.composerFoot}><span>Enter para enviar · Mayús + Enter para otra línea</span>
            <Button type="submit" icon={Send} disabled={!input.trim() || busy || !!proposal || loadingData || loadFailed}>Enviar</Button>
          </div>
        </form>
      </Card>
      <aside className={styles.info}>
        <Card className={styles.scope}>
          <ShieldCheck size={21} aria-hidden="true" />
          <h2>{user.role === 'admin' ? 'Herramientas de administración' : 'Tus trámites'}</h2>
          <p>Puedes consultar y preparar solicitudes, días de asuntos propios y reservas, y eliminar tus trámites pendientes.</p>
          {user.role === 'admin' && <p>También puedes revisar trámites del equipo, aprobar o rechazar solicitudes, confirmar o cancelar reservas y eliminar registros.</p>}
          <p>Las acciones necesitan tu confirmación y respetan los permisos de tu cuenta.</p>
        </Card>
        <p className={styles.privacy}>Las consultas se procesan con Groq usando los datos necesarios de tus trámites. El chat se borra al salir de esta página.</p>
      </aside>
    </div>
  );
}

export default function AssistantPage() {
  const { user } = useAuth();
  return <AssistantConversation key={user.id} />;
}
