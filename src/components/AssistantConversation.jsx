import { useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowUp, RotateCcw, Check, X, ShieldCheck } from 'lucide-react';
import { Button, LeafMark } from './ui';
import { ASSISTANT_EXAMPLES } from '../../shared/services/assistantClient.js';
import styles from '../pages/AssistantPage.module.scss';
import { StreamText, ThinkingLine } from './AssistantMotion';

const THINKING = ['Leyendo tu consulta', 'Consultando tus trámites', 'Preparando la respuesta'];
const EXECUTING = ['Comprobando la propuesta', 'Aplicando el cambio'];

export default function AssistantConversation({ conversation, user, loadingData, loadFailed, onClose, go }) {
  const { messages, input, setInput, busy, error, proposal, send, confirm, cancel, clear } = conversation;
  const logRef = useRef(null);
  // Replies already in the chat when the window opens are shown as they are; only new ones stream in
  const shown = useRef(new Set(messages));
  const inputRef = useRef(null);
  const blocked = busy || !!proposal || loadingData || loadFailed;
  const examples = [...ASSISTANT_EXAMPLES, ...(user.role === 'admin' ? ['Resume las solicitudes pendientes del equipo'] : [])];

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = messages.length || proposal || busy ? log.scrollHeight : 0;
  }, [messages, proposal, busy]);

  // One line to start, growing with the text up to the CSS max-height
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }, [input]);

  const pick = (example) => { setInput(example); inputRef.current?.focus(); };

  return (
    <div className={styles.conversation}>
      <header className={styles.header}>
        <LeafMark size={32} animate={false} />
        <div className={styles.titles}>
          <h2>Asistente Margube</h2>
          <p>{busy ? 'Escribiendo…' : 'Consulta y prepara tus trámites'}</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" icon={RotateCcw} iconOnly title="Nueva conversación" onClick={() => { clear(); inputRef.current?.focus(); }} disabled={busy} />
        )}
        <Button variant="ghost" icon={X} iconOnly title="Cerrar asistente" onClick={onClose} />
      </header>

      <div ref={logRef} className={styles.log} role="log" aria-label="Conversación con el asistente" aria-relevant="additions" aria-live="polite">
        {messages.length === 0 && (
          <div className={styles.empty}>
            <h3>¿Qué necesitas hacer?</h3>
            <p>Consulta tus trámites, prepara una solicitud o reserva. Antes de cambiar algo verás una propuesta para confirmar.</p>
            <div className={styles.examples}>
              {examples.map((example) => (
                <button type="button" key={example} disabled={busy} onClick={() => pick(example)}>{example}</button>
              ))}
            </div>
            <p className={styles.privacy}><ShieldCheck size={14} aria-hidden="true" />Las consultas se procesan con Groq. El chat se borra al cerrar sesión.</p>
          </div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={styles.message} data-author={message.role}>
            <span className="sr-only">{message.role === 'user' ? 'Tú:' : 'Asistente:'}</span>
            <p>{message.role === 'assistant'
              ? <StreamText text={message.content} animate={!shown.current.has(message)} />
              : message.content}</p>
          </div>
        ))}
        {busy && (
          <div className={`${styles.message} ${styles.typing}`} data-author="assistant" role="status">
            <ThinkingLine states={proposal ? EXECUTING : THINKING} />
            <span className="sr-only">{proposal ? 'Comprobando y ejecutando la acción…' : 'Consultando tus datos y preparando la respuesta…'}</span>
          </div>
        )}
      </div>

      {proposal && (
        <section className={styles.proposal} data-danger={proposal.prepared.danger || undefined} aria-labelledby="assistant-proposal">
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
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={() => go('/requests?nueva=1')}>Abrir solicitud</Button>
            <Button variant="secondary" size="sm" onClick={() => go('/reservations?nueva=1')}>Abrir reserva</Button>
          </div>
        </div>
      )}
      {(loadingData || loadFailed) && <p className={styles.status} role="status">{loadFailed ? 'Hay datos que no se han podido cargar. Actualiza la página antes de continuar.' : 'Cargando tus trámites…'}</p>}

      <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); send(); }}>
        <label htmlFor="assistant-message" className="sr-only">Tu mensaje</label>
        <div className={styles.field} data-disabled={blocked || undefined}>
          <textarea id="assistant-message" ref={inputRef} value={input} maxLength={3000} rows={1}
            disabled={blocked} onChange={(event) => setInput(event.target.value)}
            placeholder={proposal ? 'Confirma o descarta la propuesta' : 'Escribe tu consulta…'}
            aria-describedby="assistant-hint"
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
          <Button type="submit" icon={ArrowUp} iconOnly title="Enviar" className={styles.send} disabled={!input.trim() || blocked} />
        </div>
        <p id="assistant-hint" className={styles.hint}>Enter para enviar · Mayús + Enter para otra línea</p>
      </form>
    </div>
  );
}
