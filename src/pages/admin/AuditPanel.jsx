import { useEffect, useRef, useState } from 'react';
import { History, Download, RotateCcw, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Spinner } from '../../components/ui';
import {
  DeskPanel, DeskTable, CellStack, StatusPill, RowAction, DeskEmpty, DeskSelect, optionalCol,
} from '../../components/Desk';
import { FeedGroup, FeedItem, Toolbar, ToolButton, TouchEmpty, TouchButton, LeafIcon } from '../../components/Touch';
import {
  fetchAuditLog, auditChangeLines, auditTitle, AUDIT_ENTITIES, AUDIT_ACTIONS, AUDIT_PAGE_SIZE,
} from '../../../shared/services/hrAudit.js';
import { supabase } from '../../utils/supabase';
import styles from './AdminHr.module.scss';

const ACTION_TONE = { insert: 'success', update: 'accent', delete: 'danger', purge: 'warning' };
const fmtWhen = (iso) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const lineText = (l) => (l.from !== undefined ? `${l.label}: ${l.from} → ${l.to}` : `${l.label}: ${l.to}`);

/**
 * Historial (Administración): who changed what and when in employee records, DNI, departments,
 * documents, requests, personal days and the hours bank. Read from the database page by page (the
 * log is never loaded for anyone but RR. HH., and never whole). Computer table or touch list.
 */
export default function AuditPanel({ touch, employees }) {
  const [filters, setFilters] = useState({ entityType: '', subjectId: '', from: '', to: '' });
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState('loading'); // loading · ready · error · more
  const [open, setOpen] = useState(() => new Set());
  const request = useRef(0);

  const load = async (append = false) => {
    const id = ++request.current;
    setState(append ? 'more' : 'loading');
    const res = await fetchAuditLog(supabase, { ...filters, before: append ? rows[rows.length - 1]?.id : undefined });
    if (id !== request.current) return; // a newer filter already asked
    if (res.error) { setState('error'); return; }
    setRows((prev) => (append ? [...prev, ...res.rows] : res.rows));
    setHasMore(res.hasMore);
    setState('ready');
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(false); }, [filters]);

  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const filtering = Object.values(filters).some(Boolean);
  const clear = () => setFilters({ entityType: '', subjectId: '', from: '', to: '' });
  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const people = [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  const entityOptions = [{ value: '', label: 'Todo' }, ...Object.entries(AUDIT_ENTITIES).map(([value, label]) => ({ value, label }))];
  const personOptions = [{ value: '', label: 'Todo el equipo' }, ...people.map((e) => ({ value: String(e.id), label: e.name }))];

  // What is on screen, as a CSV for an inspection or a report (semicolons, UTF-8 BOM, like the rest)
  const exportCsv = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Fecha', 'Acción', 'Elemento', 'Realizado por', 'Persona afectada', 'Cambios'].join(';'),
      ...rows.map((r) => [
        q(new Date(r.occurred_at).toLocaleString('es-ES')), q(AUDIT_ACTIONS[r.action] || r.action),
        q(AUDIT_ENTITIES[r.entity_type] || r.entity_type), q(r.actor_name || 'Sistema'), q(r.subject_name || ''),
        q(auditChangeLines(r).map(lineText).join(' | ')),
      ].join(';')),
    ];
    const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-rrhh-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sub = state === 'loading' ? 'Cargando…'
    : `${rows.length}${hasMore ? '+' : ''} ${rows.length === 1 ? 'cambio' : 'cambios'}${filtering ? ' con estos filtros' : ''} · solo lo ve RR. HH.`;

  const empty = filtering
    ? { title: 'Nada con estos filtros', text: 'Cambia el elemento, la persona o las fechas.' }
    : { title: 'Aún no hay cambios registrados', text: 'Cada alta, cambio o baja en fichas, documentos y solicitudes aparecerá aquí.' };

  let body;
  if (state === 'loading') {
    body = <div className={styles.loading}><Spinner size={20} label="Cargando historial" /> Cargando historial…</div>;
  } else if (state === 'error' && rows.length === 0) {
    const text = 'Si acabas de actualizar, puede que falte aplicar la migración del historial en Supabase.';
    body = touch
      ? <TouchEmpty compact icon={AlertTriangle} title="No se ha podido cargar el historial" text={text} action={<TouchButton icon={RotateCcw} onClick={() => load(false)}>Reintentar</TouchButton>} />
      : <DeskEmpty icon={AlertTriangle} title="No se ha podido cargar el historial" text={text} action={<Button variant="secondary" icon={RotateCcw} onClick={() => load(false)}>Reintentar</Button>} />;
  } else if (rows.length === 0) {
    body = touch
      ? <TouchEmpty compact icon={History} {...empty} action={filtering && <TouchButton onClick={clear}>Quitar filtros</TouchButton>} />
      : <DeskEmpty icon={History} {...empty} action={filtering && <Button variant="secondary" onClick={clear}>Quitar filtros</Button>} />;
  } else if (touch) {
    body = (
      <FeedGroup>
        {rows.map((r) => {
          const lines = auditChangeLines(r);
          return (
            <FeedItem key={r.id}
              lead={<LeafIcon icon={History} tone={ACTION_TONE[r.action] || 'accent'} />}
              title={auditTitle(r)}
              meta={`${fmtWhen(r.occurred_at)} · ${r.actor_name || 'Sistema'}`}
              details={[
                { label: 'Realizado por', value: r.actor_name || 'Sistema' },
                { label: 'Persona afectada', value: r.subject_name || '—' },
                ...lines.map((l) => ({ label: l.label, value: l.from !== undefined ? `${l.from} → ${l.to}` : l.to, wide: true })),
              ]}
            />
          );
        })}
      </FeedGroup>
    );
  } else {
    body = (
      <DeskTable label="Historial de cambios" head={[
        { label: 'Cuándo' }, { label: 'Qué' }, { label: 'Persona afectada' }, { label: 'Realizado por', optional: true }, { label: 'Cambios' },
      ]}>
        {rows.map((r) => {
          const lines = auditChangeLines(r);
          const expanded = open.has(r.id);
          const shown = expanded ? lines : lines.slice(0, 3);
          return (
            <tr key={r.id}>
              <td className={styles.nowrap}>{fmtWhen(r.occurred_at)}</td>
              <td><StatusPill tone={ACTION_TONE[r.action] || 'accent'}>{auditTitle(r)}</StatusPill></td>
              <td><CellStack title={r.subject_name || '—'} /></td>
              <td className={optionalCol}>{r.actor_name || 'Sistema'}</td>
              <td>
                <ul className={styles.changes}>
                  {shown.map((l) => (
                    <li key={l.field}>
                      <span>{l.label}</span>
                      {l.from !== undefined && <><s>{l.from}</s><em aria-hidden="true">→</em><span className={styles.sr}>pasa a</span></>}
                      <strong>{l.to}</strong>
                    </li>
                  ))}
                </ul>
                {lines.length > 3 && (
                  <RowAction icon={expanded ? ChevronUp : ChevronDown} onClick={() => toggle(r.id)} aria-expanded={expanded}>
                    {expanded ? 'Ver menos' : `Ver ${lines.length - 3} más`}
                  </RowAction>
                )}
              </td>
            </tr>
          );
        })}
      </DeskTable>
    );
  }

  const more = rows.length > 0 && hasMore && (
    <div className={styles.more}>
      {touch
        ? <TouchButton onClick={() => load(true)} disabled={state === 'more'}>{state === 'more' ? 'Cargando…' : `Cargar ${AUDIT_PAGE_SIZE} más`}</TouchButton>
        : <Button variant="secondary" onClick={() => load(true)} loading={state === 'more'}>Cargar {AUDIT_PAGE_SIZE} más</Button>}
      {state === 'error' && <span className={styles.errorText} role="alert">No se ha podido cargar más. Inténtalo de nuevo.</span>}
    </div>
  );

  const dates = (
    <>
      <label className={styles.date}>
        <span>Desde</span>
        <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set('from')(e.target.value)} />
      </label>
      <label className={styles.date}>
        <span>Hasta</span>
        <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set('to')(e.target.value)} />
      </label>
    </>
  );

  if (touch) {
    return (
      <>
        <div className={styles.sectionBar}><p>{sub}</p></div>
        <Toolbar
          groups={[
            { id: 'entity', label: 'Elemento', value: filters.entityType, all: '', onChange: set('entityType'), options: entityOptions },
            { id: 'person', label: 'Persona', value: filters.subjectId, all: '', onChange: set('subjectId'), options: personOptions },
          ]}
          tools={rows.length > 0 ? <ToolButton icon={Download} label="Descargar historial (CSV)" onClick={exportCsv} /> : undefined}
        />
        <div className={styles.dateRow}>{dates}</div>
        {body}
        {more}
      </>
    );
  }

  return (
    <DeskPanel flush title="Historial de cambios" sub={sub}
      tools={(
        <>
          <DeskSelect label="Elemento" value={filters.entityType} onChange={set('entityType')} options={entityOptions} />
          <DeskSelect label="Persona afectada" value={filters.subjectId} onChange={set('subjectId')} options={personOptions} />
          {dates}
          {filtering && <RowAction icon={X} onClick={clear}>Limpiar</RowAction>}
          {rows.length > 0 && <Button variant="ghost" icon={Download} onClick={exportCsv}>CSV</Button>}
        </>
      )}>
      {body}
      {more}
    </DeskPanel>
  );
}
