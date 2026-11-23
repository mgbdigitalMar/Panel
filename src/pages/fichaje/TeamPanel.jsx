import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, AlertTriangle, RotateCcw, PenLine, ChevronRight, Search } from 'lucide-react';
import { Avatar, Button, Spinner } from '../../components/ui';
import {
  DeskPanel, DeskTable, CellStack, StatusPill, RowAction, RowActions, DeskEmpty, DeskMetrics, DeskSelect, DeskSearch,
} from '../../components/Desk';
import { FeedGroup, FeedItem, ItemAction, TouchEmpty, TouchButton, Ledger, Toolbar } from '../../components/Touch';
import {
  fetchTimeEntries, summarizeRange, clockState, resolveSchedule, formatMinutes, madridDayKey, madridTime,
  monthStart, monthEnd, timeReportRows, TIME_REPORT_HEADERS, CLOCK_STATES,
} from '../../../shared/services/timeTracking.js';
import { supabase } from '../../utils/supabase';
import { downloadCsv, dayFlag } from './MonthHistory';
import styles from './Fichaje.module.scss';

const fold = (v) => String(v || '').toLocaleLowerCase('es');

/** Approved personal days of a person (they expect no work), as day keys */
export const daysOffOf = (personalDays, employeeId) => (personalDays || [])
  .filter((p) => p.status === 'approved' && String(p.employeeId) === String(employeeId))
  .map((p) => p.date);

/**
 * The team's day for RR. HH.: who is working, on a break, done or not clocked in, each person's
 * time against their schedule and what needs a correction. A month of everyone goes to one CSV.
 * The data is read for the chosen day only (and the month only when exporting).
 */
export default function TeamPanel({ touch, employees, schedules, personalDays, onOpenPerson, onCorrect, announce }) {
  const today = madridDayKey();
  const [day, setDay] = useState(today);
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState('loading');
  const [dept, setDept] = useState('all');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [exportMonth, setExportMonth] = useState(today.slice(0, 7));
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchTimeEntries(supabase, { from: day, to: day });
    if (res.error) { setState('error'); return; }
    setEntries(res.rows);
    setState('ready');
  }, [day]);

  useEffect(() => {
    setState('loading');
    load();
    if (day !== today) return undefined;
    // Today's picture keeps itself current while open
    const id = setInterval(load, 60 * 1000);
    return () => clearInterval(id);
  }, [day, today, load]);

  const people = useMemo(() => employees.map((emp) => {
    const own = entries.filter((e) => String(e.employeeId) === String(emp.id));
    const schedule = resolveSchedule(schedules, emp);
    const { days } = summarizeRange(own, { from: day, to: day, schedule, daysOff: daysOffOf(personalDays, emp.id) });
    const d = days[0];
    const now = day === today ? clockState(own) : null;
    const status = now ? now.state : d.events.length ? 'done' : 'off';
    return { emp, d, status, flag: dayFlag(d), noShow: d.expectedMinutes > 0 && !d.events.length && !d.dayOff };
  }), [employees, entries, schedules, personalDays, day, today]);

  const depts = useMemo(() => [...new Set(employees.map((e) => e.dept).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [employees]);
  const count = (fn) => people.filter(fn).length;
  const counts = {
    working: count((p) => p.status === 'working'),
    break: count((p) => p.status === 'break'),
    off: count((p) => p.noShow),
    issues: count((p) => p.d.incomplete),
  };

  const rows = people
    .filter((p) => dept === 'all' || p.emp.dept === dept)
    .filter((p) => filter === 'all' || (filter === 'working' && p.status === 'working') || (filter === 'break' && p.status === 'break')
      || (filter === 'off' && p.noShow) || (filter === 'issues' && p.d.incomplete))
    .filter((p) => !query.trim() || [p.emp.name, p.emp.dept, p.emp.position].some((v) => fold(v).includes(fold(query.trim()))))
    .sort((a, b) => (a.emp.name || '').localeCompare(b.emp.name || '', 'es'));

  const toggle = (v) => setFilter((f) => (f === v ? 'all' : v));

  // Everyone's month, one row per person and day, for RR. HH.'s records and the Inspección
  const exportAll = async () => {
    if (exporting) return;
    setExporting(true);
    const from = monthStart(`${exportMonth}-01`);
    const to = monthEnd(`${exportMonth}-01`);
    const res = await fetchTimeEntries(supabase, { from, to });
    setExporting(false);
    if (res.error) { announce?.('❌', 'No se ha podido generar el informe. Inténtalo de nuevo.', 7000); return; }
    const out = [];
    [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es')).forEach((emp) => {
      const own = res.rows.filter((e) => String(e.employeeId) === String(emp.id));
      const { days } = summarizeRange(own, { from, to, schedule: resolveSchedule(schedules, emp), daysOff: daysOffOf(personalDays, emp.id) });
      out.push(...timeReportRows(days.filter((d) => !d.future), emp.name));
    });
    downloadCsv(`registro-jornada-equipo-${exportMonth}.csv`, TIME_REPORT_HEADERS, out);
    announce?.('📄', `Informe de ${exportMonth} descargado.`);
  };

  const label = (p) => (p.status === 'off' && !p.noShow ? 'Sin fichajes' : p.noShow ? 'Sin fichar' : CLOCK_STATES[p.status].label);
  const tone = (p) => (p.d.incomplete ? 'danger' : p.noShow ? 'warning' : CLOCK_STATES[p.status].tone);

  const dayPicker = (
    <label className={styles.date}>
      <span>Día</span>
      <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value || today)} />
    </label>
  );
  const exporter = (
    <span className={styles.toolbar}>
      <label className={styles.date}>
        <span>Informe</span>
        <input type="month" value={exportMonth} max={today.slice(0, 7)} onChange={(e) => setExportMonth(e.target.value || today.slice(0, 7))} />
      </label>
      {touch
        ? <TouchButton icon={Download} onClick={exportAll} disabled={exporting}>{exporting ? 'Generando…' : 'CSV del equipo'}</TouchButton>
        : <Button variant="secondary" icon={Download} onClick={exportAll} loading={exporting}>CSV del equipo</Button>}
    </span>
  );

  let body;
  if (state === 'loading') {
    body = <div className={styles.loading}><Spinner size={20} label="Cargando el equipo" /> Cargando el equipo…</div>;
  } else if (state === 'error') {
    const text = 'Si acabas de actualizar, puede que falte aplicar la migración del fichaje en Supabase.';
    body = touch
      ? <TouchEmpty compact icon={AlertTriangle} title="No se han podido cargar los fichajes" text={text} action={<TouchButton icon={RotateCcw} onClick={load}>Reintentar</TouchButton>} />
      : <DeskEmpty icon={AlertTriangle} title="No se han podido cargar los fichajes" text={text} action={<Button variant="secondary" icon={RotateCcw} onClick={load}>Reintentar</Button>} />;
  } else if (!rows.length) {
    body = touch
      ? <TouchEmpty compact icon={Search} title="Nadie con estos filtros" action={<TouchButton onClick={() => { setFilter('all'); setDept('all'); setQuery(''); }}>Quitar filtros</TouchButton>} />
      : <DeskEmpty icon={Search} title="Nadie con estos filtros" action={<Button variant="secondary" onClick={() => { setFilter('all'); setDept('all'); setQuery(''); }}>Quitar filtros</Button>} />;
  } else if (touch) {
    body = (
      <FeedGroup>
        {rows.map((p) => (
          <FeedItem key={p.emp.id}
            tone={p.d.incomplete ? 'danger' : p.noShow ? 'warning' : undefined}
            lead={<Avatar initials={p.emp.avatar} src={p.emp.avatarUrl} size={42} />}
            title={p.emp.name}
            meta={`${p.d.firstIn ? madridTime(p.d.firstIn) : '—'} – ${p.d.lastOut ? madridTime(p.d.lastOut) : p.d.open ? 'ahora' : '—'} · ${formatMinutes(p.d.workedMinutes)}`}
            status={{ tone: tone(p), text: p.d.incomplete ? 'Incompleto' : label(p) }}
            details={[
              { label: 'Departamento', value: p.emp.dept || '—' },
              { label: 'Horario de hoy', value: formatMinutes(p.d.expectedMinutes) },
              { label: 'Descansos', value: formatMinutes(p.d.breakMinutes) },
              { label: 'Diferencia', value: formatMinutes(p.d.diffMinutes, { signed: true }) },
            ]}
            actions={(
              <>
                <ItemAction icon={ChevronRight} tone="accent" onClick={() => onOpenPerson(p.emp)}>Ver su mes</ItemAction>
                <ItemAction icon={PenLine} onClick={() => onCorrect(day, p.emp.id)}>Corregir</ItemAction>
              </>
            )}
          />
        ))}
      </FeedGroup>
    );
  } else {
    body = (
      <DeskTable label="Fichajes del equipo" head={[
        { label: 'Persona' }, { label: 'Estado' }, { label: 'Entrada' }, { label: 'Salida' }, { label: 'Trabajado' },
        { label: 'Horario' }, { label: 'Diferencia' }, { label: 'Acciones', end: true },
      ]}>
        {rows.map((p) => (
          <tr key={p.emp.id} data-attention={p.d.incomplete || p.noShow || undefined}>
            <td><CellStack lead={<Avatar initials={p.emp.avatar} src={p.emp.avatarUrl} size={30} />} title={p.emp.name} sub={p.emp.dept} /></td>
            <td><StatusPill tone={tone(p)}>{p.d.incomplete ? 'Incompleto' : label(p)}</StatusPill></td>
            <td className={styles.num}>{p.d.firstIn ? madridTime(p.d.firstIn) : '—'}</td>
            <td className={styles.num}>{p.d.lastOut ? madridTime(p.d.lastOut) : p.d.open ? 'ahora' : '—'}</td>
            <td className={styles.num}><strong>{formatMinutes(p.d.workedMinutes)}</strong></td>
            <td className={styles.num}>{formatMinutes(p.d.expectedMinutes)}</td>
            <td className={`${styles.num} ${p.d.diffMinutes > 0 ? styles.pos : p.d.diffMinutes < 0 ? styles.neg : ''}`}>{p.d.diffMinutes ? formatMinutes(p.d.diffMinutes, { signed: true }) : '—'}</td>
            <td>
              <RowActions>
                <RowAction iconOnly icon={PenLine} onClick={() => onCorrect(day, p.emp.id)} label={`Corregir fichajes de ${p.emp.name}`} />
                <RowAction icon={ChevronRight} tone="accent" onClick={() => onOpenPerson(p.emp)}>Su mes</RowAction>
              </RowActions>
            </td>
          </tr>
        ))}
      </DeskTable>
    );
  }

  const metricItems = [
    { key: 'working', label: 'Trabajando', value: counts.working, tone: 'success', hint: day === today ? 'Ahora mismo' : 'Ese día' },
    { key: 'break', label: 'En descanso', value: counts.break, tone: 'warning', hint: day === today ? 'Ahora mismo' : '—' },
    { key: 'off', label: 'Sin fichar', value: counts.off, tone: 'warning', hint: 'Debían trabajar' },
    { key: 'issues', label: 'Incompletos', value: counts.issues, tone: 'danger', hint: 'Necesitan corrección' },
  ];

  if (touch) {
    return (
      <section className={styles.page} aria-label="Fichajes del equipo">
        <Ledger label="El equipo" items={metricItems.map((m) => ({
          label: m.label, value: m.value, hint: m.hint, tone: m.value && m.tone !== 'success' ? m.tone : undefined, toggle: true, active: filter === m.key, onClick: () => toggle(m.key),
        }))} />
        <div className={styles.toolbar}>{dayPicker}</div>
        <Toolbar
          search={{ label: 'Buscar personas', icon: Search, value: query, onChange: setQuery, placeholder: 'Buscar' }}
          groups={[{ id: 'dept', label: 'Departamento', value: dept, all: 'all', onChange: setDept, options: [{ value: 'all', label: 'Todos' }, ...depts.map((d) => ({ value: d, label: d }))] }]}
        />
        {body}
        <div className={styles.sectionBar}><p>Informe mensual de todo el equipo</p>{exporter}</div>
      </section>
    );
  }
  return (
    <>
      <DeskMetrics label="El equipo (pulsa para filtrar)" items={metricItems.map((m) => ({
        label: m.label, value: m.value, tone: m.tone, hint: m.hint, onClick: () => toggle(m.key), active: filter === m.key,
      }))} />
      <DeskPanel flush title={day === today ? 'Equipo hoy' : 'Equipo ese día'}
        sub={`${rows.length} ${rows.length === 1 ? 'persona' : 'personas'} · se actualiza cada minuto`}
        tools={(
          <>
            <DeskSearch label="Buscar personas" value={query} onChange={setQuery} placeholder="Buscar" />
            <DeskSelect label="Departamento" value={dept} onChange={setDept} options={[{ value: 'all', label: 'Todos los departamentos' }, ...depts.map((d) => ({ value: d, label: d }))]} />
            {dayPicker}
          </>
        )}>
        {body}
      </DeskPanel>
      <DeskPanel title="Informe mensual" sub="Entrada, salida, descansos y horas de cada persona y día (CSV)" tools={exporter} />
    </>
  );
}
