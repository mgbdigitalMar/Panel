import { useMemo, useState } from 'react';
import { Download, Check, X, Trash2, FileText, Sun, Home, Briefcase, ShoppingCart, Inbox, Plus, Paperclip } from 'lucide-react';
import {
  Masthead, Ledger, Spotlight, SpotButton, ActionTiles, BlockHead, Toolbar, ToolButton, FeedGroup, FeedItem, ItemAction,
  TouchEmpty, TouchButton, LeafIcon, STATUS,
} from '../components/Touch';
import { todayKey, fmtDate } from '../utils/format';
import { PERSONAL_DAYS_PER_YEAR } from '../../shared/config/constants.js';
import styles from './RequestsTouch.module.scss';

const TYPE = {
  asuntos_propios: { icon: Sun,          tone: 'warning', label: 'Asuntos propios' },
  remoto:          { icon: Home,         tone: 'info',    label: 'Trabajo en remoto' },
  external:        { icon: Briefcase,    tone: 'purple',  label: 'Trabajo externo' },
  purchase:        { icon: ShoppingCart, tone: 'accent',  label: 'Compra' },
};
const DAYS = ['L', 'M', 'X', 'J', 'V'];
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthKey = (iso) => String(iso || '').slice(0, 7);
const monthTitle = (key) => new Date(`${key}-01T00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

/**
 * Solicitudes on phones and tablets: your personal days and this week's telework on the brand
 * panel, one tile per kind of request (each opens the form on that kind), the states as figures
 * that filter, and the requests by month, each opening in place with its details and actions.
 * Tablets keep the allowance and the tiles in a column beside the list. The forms stay in RequestsPage.
 */
export default function RequestsTouch({ allItems, user, requestDetail, rowKey, onExport, onNew, onApprove, onReject, onDelete }) {
  const isAdmin = user?.role === 'admin';
  const [scope, setScope] = useState('all');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');

  const mine = useMemo(() => allItems.filter((r) => r.employeeId === user?.id), [allItems, user?.id]);
  // Employees only receive their own requests, so the scope filter is for admins
  const scoped = isAdmin && scope === 'mine' ? mine : allItems;
  const typed = scoped.filter((r) => type === 'all' || r.type === type);
  const filtered = typed.filter((r) => status === 'all' || r.status === status);
  const count = (s) => typed.filter((r) => r.status === s).length;

  const groups = useMemo(() => {
    const out = [];
    [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((r) => {
      const key = monthKey(r.createdAt);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else out.push({ key, rows: [r] });
    });
    return out;
  }, [filtered]);

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
  const awayDays = week.filter((d) => d.away).length;

  const toggleStatus = (s) => setStatus((cur) => (cur === s ? 'all' : s));

  const filters = [
    ...(isAdmin ? [{ id: 'scope', label: 'De quién', value: scope, all: 'all', onChange: setScope, options: [
      { value: 'all', label: 'Todo el equipo', count: allItems.length }, { value: 'mine', label: 'Mis solicitudes', count: mine.length },
    ] }] : []),
    { id: 'type', label: 'Tipo', value: type, all: 'all', onChange: setType, options: [
      { value: 'all', label: 'Todos los tipos' },
      ...Object.entries(TYPE).map(([value, t]) => ({ value, label: t.label, count: scoped.filter((r) => r.type === value).length })),
    ] },
    { id: 'status', label: 'Estado', value: status, all: 'all', onChange: setStatus, options: [
      { value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendientes' }, { value: 'approved', label: 'Aprobadas' }, { value: 'rejected', label: 'Rechazadas' },
    ] },
  ];

  return (
    <div className={styles.page}>
      <Masthead
        icon={Inbox}
        eyebrow="Solicitudes"
        title={isAdmin ? 'Solicitudes' : 'Tus solicitudes'}
        desc={isAdmin ? 'Asuntos propios, remoto, trabajo externo y compras de todo el equipo.' : 'Asuntos propios, trabajo en remoto o externo y compras.'}
      />

      <div className={styles.layout}>
        <aside className={styles.side}>
          {/* Your allowance and this week, on the brand panel */}
          <Spotlight icon={Sun} label={`Tus días · ${year}`}
            foot={(
              <div className={styles.week}>
                <span className={styles.weekLabel}>
                  Esta semana fuera de la oficina <strong>{awayDays} {awayDays === 1 ? 'día' : 'días'}</strong>
                </span>
                <ol aria-label="Días fuera de la oficina esta semana">
                  {week.map((d) => (
                    <li key={d.iso} data-away={d.away || undefined} data-today={d.today || undefined}
                      aria-label={`${d.name}: ${d.away === 'remoto' ? 'en remoto' : d.away === 'external' ? 'trabajo externo' : 'en la oficina'}`}>
                      {d.letter}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            actions={<SpotButton primary icon={Plus} onClick={() => onNew('asuntos_propios')}>Pedir un día propio</SpotButton>}>
            <p className={styles.days}>
              <strong>{daysLeft}</strong>
              <span>de {PERSONAL_DAYS_PER_YEAR} días de asuntos propios disponibles</span>
            </p>
            <span className={styles.pips} aria-hidden="true">
              {Array.from({ length: PERSONAL_DAYS_PER_YEAR }, (_, i) => <i key={i} data-used={i >= daysLeft || undefined} />)}
            </span>
          </Spotlight>

          <section aria-labelledby="touch-new-request">
            <span id="touch-new-request"><BlockHead title="Nueva solicitud" meta="Elige qué necesitas" /></span>
            <ActionTiles className={styles.kinds} items={Object.entries(TYPE).map(([value, t]) => ({
              icon: t.icon, tone: t.tone, label: t.label,
              hint: { asuntos_propios: daysLeft ? `Te quedan ${daysLeft}` : 'No te quedan días', remoto: 'Desde casa', external: 'Fuera de la oficina', purchase: 'Artículo o servicio' }[value],
              onClick: () => onNew(value),
            }))} />
          </section>
        </aside>

        <section className={styles.main} aria-labelledby="touch-requests">
          <span id="touch-requests" className={styles.srOnly}>Historial de solicitudes</span>
          <Ledger label="Por estado" items={[
            { label: 'Pendientes', value: count('pending'), tone: count('pending') ? 'warning' : undefined, onClick: () => toggleStatus('pending'), active: status === 'pending', toggle: true },
            { label: 'Aprobadas', value: count('approved'), tone: 'success', onClick: () => toggleStatus('approved'), active: status === 'approved', toggle: true },
            { label: 'Rechazadas', value: count('rejected'), tone: count('rejected') ? 'danger' : undefined, onClick: () => toggleStatus('rejected'), active: status === 'rejected', toggle: true },
          ]} />

          <Toolbar groups={filters}
            tools={filtered.length > 0 ? <ToolButton icon={Download} label="Descargar Excel" onClick={() => onExport(filtered)} /> : undefined} />

          {filtered.length === 0 ? (
            <TouchEmpty icon={FileText}
              title={scoped.length === 0 ? 'Aún no hay solicitudes' : 'Nada con estos filtros'}
              text={scoped.length === 0 ? 'Cuando pidas un día, trabajo en remoto o una compra, la verás aquí con su estado.' : 'Cambia o quita los filtros para ver más solicitudes.'}
              action={scoped.length === 0
                ? <TouchButton primary icon={Plus} onClick={() => onNew()}>Nueva solicitud</TouchButton>
                : <TouchButton onClick={() => { setStatus('all'); setType('all'); setScope('all'); }}>Quitar filtros</TouchButton>} />
          ) : groups.map((g) => (
            <FeedGroup key={g.key} title={monthTitle(g.key)} meta={`${g.rows.length} ${g.rows.length === 1 ? 'solicitud' : 'solicitudes'}`}>
              {g.rows.map((r) => {
                const t = TYPE[r.type] || TYPE.purchase;
                const own = r.employeeId === user?.id;
                const review = isAdmin && r.status === 'pending';
                return (
                  <FeedItem
                    key={rowKey(r)}
                    tone={r.status === 'pending' ? 'warning' : undefined}
                    lead={<LeafIcon icon={t.icon} tone={t.tone} />}
                    title={own || !isAdmin ? t.label : r.employeeName || '—'}
                    meta={own || !isAdmin ? requestDetail(r) : `${t.label} · ${requestDetail(r)}`}
                    status={STATUS[r.status]}
                    details={[
                      { label: 'Solicitante', value: own ? `${r.employeeName || user?.name} (tú)` : r.employeeName || '—' },
                      { label: 'Tipo', value: t.label },
                      { label: r.type === 'purchase' ? 'Artículo' : 'Fecha', value: requestDetail(r) },
                      { label: 'Enviada', value: r.createdAt ? fmtDate(r.createdAt) : '—' },
                      { label: 'Motivo', value: r.reason, wide: true },
                    ]}
                    actions={(review || isAdmin || r.fileUrl) ? (
                      <>
                        {r.fileUrl && <ItemAction icon={Paperclip} tone="accent" href={r.fileUrl} download="justificante">Justificante</ItemAction>}
                        {review && <ItemAction icon={Check} tone="success" onClick={() => onApprove(r)}>Aprobar</ItemAction>}
                        {review && <ItemAction icon={X} tone="danger" onClick={() => onReject(r)}>Rechazar</ItemAction>}
                        {isAdmin && <ItemAction icon={Trash2} tone="danger" onClick={() => onDelete(r)}>Eliminar</ItemAction>}
                      </>
                    ) : undefined}
                  />
                );
              })}
            </FeedGroup>
          ))}
        </section>
      </div>
    </div>
  );
}

