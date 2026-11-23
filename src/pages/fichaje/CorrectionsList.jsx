import { useState } from 'react';
import { Check, X, Undo2, PenLine, AlertTriangle, RotateCcw } from 'lucide-react';
import { Avatar, Button, Modal, Textarea, Spinner } from '../../components/ui';
import { DeskPanel, DeskTable, CellStack, StatusPill, RowAction, RowActions, DeskEmpty } from '../../components/Desk';
import { FeedGroup, FeedItem, ItemAction, TouchEmpty, TouchButton, LeafIcon } from '../../components/Touch';
import { CORRECTION_KINDS, CORRECTION_STATUS, madridTime } from '../../../shared/services/timeTracking.js';
import styles from './Fichaje.module.scss';

const when = (iso) => (iso
  ? `${new Date(iso).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' })} a las ${madridTime(iso)}`
  : '—');

/**
 * Correction requests. A person sees theirs and can withdraw one still pending; RR. HH. sees
 * everyone's and approves or rejects (a rejection says why). Each row says what changes and when.
 */
export default function CorrectionsList({ touch, rows, state, onRetry, employees = [], isAdmin, onCancel, onReview, busyId, title, emptyText }) {
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
  const nameOf = (id) => employees.find((e) => String(e.id) === String(id))?.name || '—';
  const avatarOf = (id) => employees.find((e) => String(e.id) === String(id))?.avatar;

  const describe = (c) => (c.kind === 'void'
    ? 'Quitar un fichaje que sobra'
    : `${CORRECTION_KINDS[c.kind]} · ${when(c.at)}${c.targetEntryId ? ' (sustituye a otro)' : ''}`);

  const confirmReject = async () => {
    const ok = await onReview(rejecting, false, note);
    if (ok) { setRejecting(null); setNote(''); }
  };

  let body;
  if (state === 'loading') {
    body = <div className={styles.loading}><Spinner size={20} label="Cargando correcciones" /> Cargando correcciones…</div>;
  } else if (state === 'error') {
    body = touch
      ? <TouchEmpty compact icon={AlertTriangle} title="No se han podido cargar las correcciones" action={<TouchButton icon={RotateCcw} onClick={onRetry}>Reintentar</TouchButton>} />
      : <DeskEmpty icon={AlertTriangle} title="No se han podido cargar las correcciones" action={<Button variant="secondary" icon={RotateCcw} onClick={onRetry}>Reintentar</Button>} />;
  } else if (!rows.length) {
    body = touch
      ? <TouchEmpty compact icon={PenLine} title="Sin correcciones" text={emptyText} />
      : <DeskEmpty icon={PenLine} title="Sin correcciones" text={emptyText} />;
  } else if (touch) {
    body = (
      <FeedGroup>
        {rows.map((c) => {
          const st = CORRECTION_STATUS[c.status];
          const pending = c.status === 'pending';
          return (
            <FeedItem key={c.id}
              tone={pending ? 'warning' : undefined}
              lead={isAdmin ? <Avatar initials={avatarOf(c.employeeId)} size={40} /> : <LeafIcon icon={PenLine} tone={st.tone} />}
              title={isAdmin ? nameOf(c.employeeId) : describe(c)}
              meta={isAdmin ? describe(c) : `Pedida el ${when(c.createdAt)}`}
              status={st}
              details={[
                { label: 'Motivo', value: c.reason, wide: true },
                c.reviewNote && { label: 'Respuesta de RR. HH.', value: c.reviewNote, wide: true },
                c.reviewedAt && { label: 'Revisada', value: when(c.reviewedAt) },
              ]}
              actions={pending && (
                <>
                  {isAdmin && <ItemAction icon={Check} tone="success" disabled={busyId === c.id} onClick={() => onReview(c.id, true)}>{busyId === c.id ? 'Guardando…' : 'Aprobar'}</ItemAction>}
                  {isAdmin && <ItemAction icon={X} tone="danger" disabled={busyId === c.id} onClick={() => setRejecting(c.id)}>Rechazar</ItemAction>}
                  {!isAdmin && <ItemAction icon={Undo2} disabled={busyId === c.id} onClick={() => onCancel(c.id)}>Cancelar</ItemAction>}
                </>
              )}
            />
          );
        })}
      </FeedGroup>
    );
  } else {
    body = (
      <DeskTable label={title} head={[
        ...(isAdmin ? [{ label: 'Persona' }] : []), { label: 'Corrección' }, { label: 'Motivo' }, { label: 'Estado' }, { label: 'Acciones', end: true },
      ]}>
        {rows.map((c) => {
          const st = CORRECTION_STATUS[c.status];
          const pending = c.status === 'pending';
          return (
            <tr key={c.id} data-attention={pending || undefined}>
              {isAdmin && <td><CellStack lead={<Avatar initials={avatarOf(c.employeeId)} size={30} />} title={nameOf(c.employeeId)} sub={`Pedida el ${when(c.createdAt)}`} /></td>}
              <td><CellStack title={describe(c)} sub={!isAdmin ? `Pedida el ${when(c.createdAt)}` : undefined} /></td>
              <td><span className={styles.hint} title={c.reason}>{c.reason}</span>{c.reviewNote && <span className={styles.hint}><br />RR. HH.: {c.reviewNote}</span>}</td>
              <td><StatusPill tone={st.tone}>{st.text}</StatusPill></td>
              <td>
                {pending && (
                  <RowActions>
                    {isAdmin && <RowAction icon={Check} tone="success" disabled={busyId === c.id} onClick={() => onReview(c.id, true)}>Aprobar</RowAction>}
                    {isAdmin && <RowAction icon={X} tone="danger" disabled={busyId === c.id} onClick={() => setRejecting(c.id)}>Rechazar</RowAction>}
                    {!isAdmin && <RowAction icon={Undo2} disabled={busyId === c.id} onClick={() => onCancel(c.id)}>Cancelar</RowAction>}
                  </RowActions>
                )}
              </td>
            </tr>
          );
        })}
      </DeskTable>
    );
  }

  const modal = (
    <Modal open={!!rejecting} onClose={() => { if (busyId !== rejecting) { setRejecting(null); setNote(''); } }} title="Rechazar corrección">
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); confirmReject(); }}>
        <p className={styles.hint}>La persona recibirá un aviso. Dile por qué, para que pueda pedirla de nuevo bien.</p>
        <Textarea label="Motivo del rechazo" value={note} onChange={setNote} rows={3} maxLength={500} />
        <div className={styles.formActions}>
          <Button variant="ghost" onClick={() => { setRejecting(null); setNote(''); }} disabled={busyId === rejecting}>Cancelar</Button>
          <Button type="submit" variant="danger" icon={X} loading={busyId === rejecting}>Rechazar</Button>
        </div>
      </form>
    </Modal>
  );

  if (touch) {
    return (
      <section className={styles.page} aria-label={title}>
        <div className={styles.sectionBar}><p>{title}</p></div>
        {body}
        {modal}
      </section>
    );
  }
  return (
    <>
      <DeskPanel flush title={title}>{body}</DeskPanel>
      {modal}
    </>
  );
}
