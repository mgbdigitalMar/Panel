import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download, PenLine, AlertTriangle, CalendarDays, RotateCcw } from 'lucide-react';
import { Button, Spinner } from '../../components/ui';
import { DeskPanel, DeskTable, RowAction, DeskEmpty, StatusPill } from '../../components/Desk';
import { FeedGroup, FeedItem, ItemAction, TouchEmpty, TouchButton, DateStamp } from '../../components/Touch';
import {
  summarizeRange, formatMinutes, formatClock, madridTime, madridDayKey, monthStart, monthEnd, addDays,
  timeReportRows, TIME_REPORT_HEADERS, CLOCK_KINDS,
} from '../../../shared/services/timeTracking.js';
import styles from './Fichaje.module.scss';

const monthTitle = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayTitle = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

/** CSV with semicolons and a UTF-8 BOM, like the rest of the intranet's exports */
export function downloadCsv(filename, headers, rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const text = [headers.map(q).join(';'), ...rows.map((r) => r.map(q).join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** What a day needs attention for, in words (never colour alone) */
export function dayFlag(d) {
  if (d.incomplete) return { tone: 'danger', text: 'Incompleto' };
  if (d.open) return { tone: 'accent', text: 'En curso' };
  if (d.missing) return { tone: 'warning', text: 'Sin fichar' };
  if (d.dayOff) return { tone: 'neutral', text: 'Día libre' };
  return null;
}

/**
 * A month of one person's working days: entry, exit, breaks, time worked against the schedule and
 * what needs a correction. Totals on top, each day opens the correction form, and the month goes
 * to a CSV (the record a person can ask for, and the one RR. HH. keeps for the Inspección).
 */
export default function MonthHistory({
  touch, month, setMonth, entries, state, onRetry, schedule, daysOff, personName, onCorrect, correctLabel = 'Corregir',
}) {
  const today = madridDayKey();
  const from = monthStart(month);
  const to = monthEnd(month);
  const { days, totals } = useMemo(
    () => summarizeRange(entries || [], { from, to, schedule, daysOff }),
    [entries, from, to, schedule, daysOff],
  );
  // Newest first, and nothing after today
  const shown = days.filter((d) => !d.future).reverse();
  const isCurrent = from === monthStart(today);
  const name = personName || 'registro';

  const exportMonth = () => downloadCsv(
    `jornada-${name.toLocaleLowerCase('es').replace(/\s+/g, '-')}-${from.slice(0, 7)}.csv`,
    TIME_REPORT_HEADERS,
    timeReportRows(days.filter((d) => !d.future), personName || ''),
  );

  const nav = (
    <div className={styles.monthNav}>
      <button type="button" className={styles.iconBtn} onClick={() => setMonth(addDays(from, -1))} aria-label="Mes anterior">
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <strong aria-live="polite">{monthTitle(from)}</strong>
      <button type="button" className={styles.iconBtn} onClick={() => setMonth(addDays(to, 1))} disabled={isCurrent} aria-label="Mes siguiente">
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );

  const totalsBlock = (
    <dl className={styles.totals}>
      <div><dt>Trabajado</dt><dd>{formatMinutes(totals.worked)}</dd></div>
      <div><dt>Según horario</dt><dd>{formatMinutes(totals.expected)}</dd></div>
      <div>
        <dt>Diferencia</dt>
        <dd className={totals.balance > 0 ? styles.pos : totals.balance < 0 ? styles.neg : undefined}>{formatMinutes(totals.balance, { signed: true })}</dd>
      </div>
      <div><dt>Horas extra</dt><dd>{formatMinutes(totals.overtime)}</dd></div>
      <div>
        <dt>Por revisar</dt>
        <dd className={totals.incompleteDays + totals.missingDays ? styles.neg : undefined}>{totals.incompleteDays + totals.missingDays} {totals.incompleteDays + totals.missingDays === 1 ? 'día' : 'días'}</dd>
      </div>
    </dl>
  );

  let body;
  if (state === 'loading') {
    body = <div className={styles.loading}><Spinner size={20} label="Cargando registro" /> Cargando registro…</div>;
  } else if (state === 'error') {
    const text = 'Comprueba la conexión e inténtalo de nuevo.';
    body = touch
      ? <TouchEmpty compact icon={AlertTriangle} title="No se ha podido cargar el registro" text={text} action={<TouchButton icon={RotateCcw} onClick={onRetry}>Reintentar</TouchButton>} />
      : <DeskEmpty icon={AlertTriangle} title="No se ha podido cargar el registro" text={text} action={<Button variant="secondary" icon={RotateCcw} onClick={onRetry}>Reintentar</Button>} />;
  } else if (shown.length === 0 || shown.every((d) => !d.events.length && !d.expectedMinutes)) {
    body = touch
      ? <TouchEmpty compact icon={CalendarDays} title="Sin fichajes este mes" text="Cuando fiches, cada día aparecerá aquí con sus horas." />
      : <DeskEmpty icon={CalendarDays} title="Sin fichajes este mes" text="Cuando fiches, cada día aparecerá aquí con sus horas." />;
  } else if (touch) {
    body = (
      <FeedGroup>
        {shown.filter((d) => d.events.length || d.expectedMinutes).map((d) => {
          const flag = dayFlag(d);
          return (
            <FeedItem key={d.dayKey}
              tone={flag?.tone === 'danger' ? 'danger' : flag?.tone === 'warning' ? 'warning' : undefined}
              lead={<DateStamp iso={d.dayKey} tone={flag?.tone === 'danger' ? 'danger' : flag ? 'warning' : 'accent'} />}
              title={d.events.length ? `${d.firstIn ? madridTime(d.firstIn) : '—'} – ${d.lastOut ? madridTime(d.lastOut) : '…'}` : 'Sin fichajes'}
              meta={`${formatMinutes(d.workedMinutes)} de ${formatMinutes(d.expectedMinutes)}${d.diffMinutes ? ` · ${formatMinutes(d.diffMinutes, { signed: true })}` : ''}`}
              status={flag || undefined}
              details={[
                { label: 'Descansos', value: formatMinutes(d.breakMinutes) },
                { label: 'Diferencia', value: formatMinutes(d.diffMinutes, { signed: true }) },
                ...d.events.map((e, i) => ({ label: `${i + 1}. ${CLOCK_KINDS[e.kind]?.label}`, value: `${madridTime(e.at)}${e.source === 'correction' ? ' (corregido)' : ''}${e.note ? ` · ${e.note}` : ''}`, wide: true })),
              ]}
              actions={onCorrect && <ItemAction icon={PenLine} tone="accent" onClick={() => onCorrect(d.dayKey)}>{correctLabel}</ItemAction>}
            />
          );
        })}
      </FeedGroup>
    );
  } else {
    body = (
      <DeskTable label={`Registro de jornada de ${monthTitle(from)}`} head={[
        { label: 'Día' }, { label: 'Entrada' }, { label: 'Salida' }, { label: 'Descansos' }, { label: 'Trabajado' },
        { label: 'Horario' }, { label: 'Diferencia' }, { label: 'Estado' }, ...(onCorrect ? [{ label: 'Acciones', end: true }] : []),
      ]}>
        {shown.filter((d) => d.events.length || d.expectedMinutes).map((d) => {
          const flag = dayFlag(d);
          return (
            <tr key={d.dayKey} data-attention={flag && flag.tone !== 'neutral' && flag.tone !== 'accent' ? true : undefined}>
              <td className={styles.nowrap} style={{ textTransform: 'capitalize' }}>{dayTitle(d.dayKey)}</td>
              <td className={styles.num}>{d.firstIn ? madridTime(d.firstIn) : '—'}</td>
              <td className={styles.num}>{d.lastOut ? madridTime(d.lastOut) : '—'}</td>
              <td className={styles.num}>{formatClock(d.breakMinutes)}</td>
              <td className={styles.num}><strong>{formatClock(d.workedMinutes)}</strong></td>
              <td className={styles.num}>{formatClock(d.expectedMinutes)}</td>
              <td className={`${styles.num} ${d.diffMinutes > 0 ? styles.pos : d.diffMinutes < 0 ? styles.neg : ''}`}>{d.diffMinutes ? formatMinutes(d.diffMinutes, { signed: true }) : '—'}</td>
              <td>{flag ? <StatusPill tone={flag.tone}>{flag.text}</StatusPill> : <span className={styles.muted}>—</span>}</td>
              {onCorrect && (
                <td><RowAction icon={PenLine} onClick={() => onCorrect(d.dayKey)}>{correctLabel}</RowAction></td>
              )}
            </tr>
          );
        })}
      </DeskTable>
    );
  }

  const tools = (
    <>
      {nav}
      {state === 'ready' && totals.workedDays > 0 && (
        touch
          ? <TouchButton icon={Download} onClick={exportMonth}>CSV</TouchButton>
          : <Button variant="ghost" icon={Download} onClick={exportMonth}>Descargar CSV</Button>
      )}
    </>
  );

  if (touch) {
    return (
      <section className={styles.page} aria-label="Registro mensual">
        <div className={styles.sectionBar}><p>Registro de {monthTitle(from)}</p>{tools}</div>
        {state === 'ready' && totalsBlock}
        {body}
      </section>
    );
  }
  return (
    <DeskPanel flush title="Registro mensual" sub={personName ? `${personName} · horas trabajadas frente a su horario` : 'Tus horas trabajadas frente a tu horario'} tools={tools}>
      {state === 'ready' && <div style={{ padding: '0 20px 16px' }}>{totalsBlock}</div>}
      {body}
    </DeskPanel>
  );
}
