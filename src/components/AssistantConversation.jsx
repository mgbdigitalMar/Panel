import { useEffect, useRef } from 'react';
import { MessageSquareText, Send, RotateCcw, Check, X } from 'lucide-react';
import { Card, Button } from './ui';
import { ASSISTANT_EXAMPLES } from '../../shared/services/assistantClient.js';
import styles from '../pages/AssistantPage.module.scss';

export default function AssistantConversation({ conversation, user, loadingData, loadFailed, onClose, go }) {
  const { messages, input, setInput, busy, error, proposal, send, confirm, cancel, clear } = conversation;
  const endRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => {
    const log = endRef.current?.parentElement;
    if (log) log.scrollTop = messages.length || proposal || busy ? log.scrollHeight : 0;
  }, [messages, proposal, busy]);
  return (
    <div className={styles.page}>
      <Card className={styles.conversation}>
        <div className={styles.header}>
          <div><MessageSquareText size={20} aria-hidden="true" /><h2>Asistente Margube</h2></div>
          <Button variant="ghost" icon={RotateCcw} onClick={clear} disabled={busy}>Nueva conversación</Button>
          <Button variant="ghost" icon={X} iconOnly title="Cerrar asistente" onClick={onClose} />
        </div>
        <div className={styles.log} role="log" aria-label="Conversación con el asistente" aria-relevant="additions" aria-live="polite">
          {messages.length === 0 && (
            <div className={styles.empty}>
              <h3>¿Qué necesitas hacer?</h3>
              <p>Consulta tus trámites, prepara una solicitud o reserva. Antes de cambiar algo verás una propuesta para confirmar.</p>
              <p className={styles.privacy}>Las consultas se procesan con Groq. El chat se borra al cerrar sesión.</p>
              <div className={styles.examples}>
                {[...ASSISTANT_EXAMPLES, ...(user.role === 'admin' ? ['Resume las solicitudes pendientes del equipo'] : [])].map((example) => (
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
            <Button variant="secondary" onClick={() => go('/requests?nueva=1')}>Abrir solicitud</Button>
            <Button variant="secondary" onClick={() => go('/reservations?nueva=1')}>Abrir reserva</Button>
          </div>
        </div>}
        {(loadingData || loadFailed) && <p className={styles.status} role="status">{loadFailed ? 'Hay datos que no se han podido cargar. Actualiza la página antes de continuar.' : 'Cargando tus trámites…'}</p>}
        <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); send(); }}>
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
    </div>
  );
}
