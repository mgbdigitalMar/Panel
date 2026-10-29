import { useMemo, useState } from 'react';
import { Download, Plus, Check, X, Trash2, Paperclip, Sun, Home, Briefcase, ShoppingCart, Inbox, Layers, FileText } from 'lucide-react';
import { Avatar, Button } from '../components/ui';
import {
  DeskHeader, DeskLayout, DeskRail, DeskMetrics, DeskPanel, DeskSpotlight, SpotAction, DeskSearch, DeskSegmented,
  DeskTable, CellStack, TypeTile, StatusPill, RowAction, RowActions, DeskEmpty, ShowMore,
} from '../components/Desk';
import { todayKey, fmtDate } from '../utils/format';
import { PERSONAL_DAYS_PER_YEAR } from '../../shared/config/constants.js';
import styles from './RequestsDesk.module.scss';

const TYPE = {
  asuntos_propios: { icon: Sun,          tone: 'warning', label: 'Asuntos propios' },
  remoto:          { icon: Home,         tone: 'info',    label: 'Trabajo en remoto' },
  external:        { icon: Briefcase,    tone: 'purple',  label: 'Trabajo externo' },
  purchase:        { icon: ShoppingCart, tone: 'accent',  label: 'Compra' },
};
const STATUS = {
  pending:  { tone: 'warning', label: 'Pendiente' },
  approved: { tone: 'success', label: 'Aprobada' },
  rejected: { tone: 'danger',  label: 'Rechazada' },
};
const DAYS = ['L', 'M', 'X', 'J', 'V'];
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
const PAGE = 25;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const initialsOf = (name) => (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

/**
 * Solicitudes on a computer: the kinds of request as a side list (each with its count), your
 * personal days and this week on the brand panel, the states as figures that filter, and one table.
 * Admins see what waits for them first, with Aprobar / Rechazar named on the row.
 * The forms and confirmations stay in RequestsPage.
 */
export default function RequestsDesk({ allItems, user, requestDetail, rowKey, onExport, onNew, onApprove, onReject, onDelete, busyKey, reviewLine }) {
  const isAdmin = user?.role === 'admin';
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const mine = useMemo(() => allItems.filter((r) => r.employeeId === user?.id), [allItems, user?.id]);
  const scoped = isAdmin && scope === 'mine' ? mine : allItems;
  const typed = scoped.filter((r) => type === 'all' || r.type === type);
  const count = (s) => typed.filter((r) => r.status === s).length;

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return typed
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => !q || [r.employeeName, r.reason, r.item, TYPE[r.type]?.label, requestDetail(r)]
        .some((v) => String(v || '').toLocaleLowerCase('es').includes(q)))
      // Admins: what waits for a decision comes first
      .sort((a, b) => (isAdmin ? (b.status === 'pending') - (a.status === 'pending') : 0)
        || new Date(b.createdAt) - new Date(a.createdAt));
  }, [typed, status, query, isAdmin, requestDetail]);

  const year = String(new Date().getFullYear());
  const daysUsed = mine.filter((r) => r.type === 'asuntos_propios' && r.status !== 'rejected' && String(r.startDate || '').startsWith(year)).length;
  const daysLeft = Math.max(0, PERSONAL_DAYS_PER_YEAR - daysUsed);

  const week = useMemo(() => {
    const now = new Date();
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    const today = todayKey(now);
    return DAYS.map((letter, i) => {
      const iso = todayKey(addDays(monday, i));
      const away = mine.find((r) => (r.type === 'remoto' || r.type === 'external') && r.status === 'approved'
        && iso >= r.startDate && iso <= (r.endDate || r.startDate));
      return { iso, letter, name: DAY_NAMES[i], away: away?.type, today: iso === today };
    });
  }, [mine]);

  const toggleStatus = (s) => { setStatus((cur) => (cur === s ? 'all' : s)); setLimit(PAGE); };
  const clearFilters = () => { setType('all'); setStatus('all'); setScope('all'); setQuery(''); };
  const filtering = type !== 'all' || status !== 'all' || scope !== 'all' || query.trim();
  const pending = count('pending');

  return (
    <div className={styles.page}>
      <DeskHeader
        icon={Inbox}
        title={isAdmin ? 'Solicitudes' : 'Tus solicitudes'}
        desc={isAdmin
          ? 'Asuntos propios, remoto, trabajo externo y compras de todo el equipo. Lo que espera tu decisión aparece primero.'
          : 'Pide asuntos propios, trabajo en remoto o externo y compras, y sigue su estado.'}
        actions={(
          <>
            <Button variant="ghost" icon={Download} onClick={() => onExport(rows)} disabled={!rows.length}>Descargar Excel</Button>
            <Button icon={Plus} onClick={() => onNew()}>Nueva solicitud</Button>
          </>
        )}
      />

      <DeskLayout
        sideLabel="Tu saldo y filtros"
        side={(
          <>
            <DeskSpotlight icon={Sun} label={`Tus días · ${year}`}
              actions={<SpotAction primary icon={Plus} onClick={() => onNew('asuntos_propios')} disabled={!daysLeft}>Pedir un día</SpotAction>}>
              <p className={styles.days}>
                <strong>{daysLeft}</strong>
                <span>de {PERSONAL_DAYS_PER_YEAR} días de asuntos propios disponibles</span>
              </p>
              <span className={styles.pips} aria-hidden="true">
                {Array.from({ length: PERSONAL_DAYS_PER_YEAR }, (_, i) => <i key={i} data-used={i >= daysLeft || undefined} />)}
              </span>
              <div className={styles.week}>
                <span>Esta semana fuera de la oficina</span>
                <ol aria-label="Días fuera de la oficina esta semana">
                  {week.map((d) => (
                    <li key={d.iso} data-away={d.away || undefined} data-today={d.today || undefined}
                      aria-label={`${d.name}: ${d.away === 'remoto' ? 'en remoto' : d.away === 'external' ? 'trabajo externo' : 'en la oficina'}`}>
                      {d.letter}
                    </li>
                  ))}
                </ol>
              </div>
            </DeskSpotlight>

            <DeskRail title="Tipo" asFilter value={type} onChange={(v) => { setType(v); setLimit(PAGE); }} items={[
              { value: 'all', label: 'Todas', icon: Layers, tone: 'neutral', count: scoped.length },
              ...Object.entries(TYPE).map(([value, t]) => ({
                value, label: t.label, icon: t.icon, tone: t.tone,
                count: scoped.filter((r) => r.type === value).length,
                alert: isAdmin && scoped.some((r) => r.type === value && r.status === 'pending'),
              })),
            ]} />
          </>
        )}
      >
        <DeskMetrics label="Por estado (pulsa para filtrar)" items={[
          { label: 'Pendientes', value: pending, tone: 'warning', hint: pending ? (isAdmin ? 'Esperan tu decisión' : 'En revisión') : 'Nada pendiente', onClick: () => toggleStatus('pending'), active: status === 'pending' },
          { label: 'Aprobadas', value: count('approved'), tone: 'success', hint: 'En total', onClick: () => toggleStatus('approved'), active: status === 'approved' },
          { label: 'Rechazadas', value: count('rejected'), tone: 'danger', hint: 'En total', onClick: () => toggleStatus('rejected'), active: status === 'rejected' },
        ]} />

        <DeskPanel
          flush
          title={{ all: 'Historial', pending: 'Pendientes', approved: 'Aprobadas', rejected: 'Rechazadas' }[status]}
          sub={`${rows.length} ${rows.length === 1 ? 'solicitud' : 'solicitudes'}${filtering ? ' con estos filtros' : ''}`}
          tools={(
            <>
              <DeskSearch value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} label="Buscar solicitudes"
                placeholder={isAdmin ? 'Buscar por persona, motivo o artículo' : 'Buscar por motivo o artículo'} />
              {isAdmin && (
                <DeskSegmented label="De quién" value={scope} onChange={(v) => { setScope(v); setLimit(PAGE); }} options={[
                  { value: 'all', label: 'Equipo' }, { value: 'mine', label: 'Mías', count: mine.length },
                ]} />
              )}
            </>
          )}
        >
          {rows.length === 0 ? (
            <DeskEmpty icon={FileText}
              title={scoped.length === 0 ? 'Aún no hay solicitudes' : 'Nada con estos filtros'}
              text={scoped.length === 0 ? 'Cuando pidas un día, trabajo en remoto o una compra, aparecerá aquí con su estado.' : 'Cambia o quita los filtros para ver más solicitudes.'}
              action={scoped.length === 0
                ? <Button icon={Plus} onClick={() => onNew()}>Nueva solicitud</Button>
                : <Button variant="secondary" onClick={clearFilters}>Quitar filtros</Button>} />
          ) : (
            <>
              <DeskTable label="Solicitudes" head={[
                { label: 'Solicitud' },
                ...(isAdmin && scope === 'all' ? [{ label: 'Persona' }] : []),
                { label: 'Motivo' },
                { label: 'Enviada' },
                { label: 'Estado' },
                { label: 'Acciones', end: true },
              ]}>
                {rows.slice(0, limit).map((r) => {
                  const t = TYPE[r.type] || TYPE.purchase;
                  const st = STATUS[r.status] || STATUS.pending;
                  const busy = busyKey === rowKey(r);
                  const review = isAdmin && r.status === 'pending';
                  return (
                    <tr key={rowKey(r)} data-attention={review || undefined}>
                      <td><CellStack lead={<TypeTile icon={t.icon} tone={t.tone} />} title={t.label} sub={requestDetail(r)} /></td>
                      {isAdmin && scope === 'all' && (
                        <td>
                          <span className={styles.person}>
                            <Avatar initials={initialsOf(r.employeeName)} size={28} />
                            {r.employeeName || '—'}{r.employeeId === user?.id && <em>(tú)</em>}
                          </span>
                        </td>
                      )}
                      <td><span className={styles.reason} title={r.reason || undefined}>{r.reason || '—'}</span></td>
                      <td className={styles.nowrap}><time dateTime={r.createdAt}>{fmtDate(r.createdAt)}</time></td>
                      <td>
                        <StatusPill tone={st.tone}>{st.label}</StatusPill>
                        {reviewLine(r) && <span className={styles.reviewed}>{reviewLine(r)}</span>}
                      </td>
                      <td>
                        <RowActions>
                          {r.fileUrl && <RowAction iconOnly icon={Paperclip} tone="accent" href={r.fileUrl} download="justificante" label="Descargar justificante" />}
                          {review && (
                            <>
                              <RowAction icon={Check} tone="success" onClick={() => onApprove(r)} disabled={busy}
                                aria-label={`Aprobar solicitud de ${r.employeeName || 'empleado'}`}>{busy ? 'Guardando…' : 'Aprobar'}</RowAction>
                              <RowAction icon={X} tone="danger" onClick={() => onReject(r)} disabled={busy}
                                aria-label={`Rechazar solicitud de ${r.employeeName || 'empleado'}`}>Rechazar</RowAction>
                            </>
                          )}
                          {isAdmin && <RowAction iconOnly icon={Trash2} tone="neutral" onClick={() => onDelete(r)} label={`Eliminar solicitud de ${r.employeeName || 'empleado'}`} />}
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </DeskTable>
              <ShowMore shown={Math.min(limit, rows.length)} total={rows.length} onMore={() => setLimit((l) => l + PAGE)} noun="solicitudes" />
            </>
          )}
        </DeskPanel>
      </DeskLayout>
    </div>
  );
}
