import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Clock, UsersRound, CalendarClock, PenLine, ChevronLeft } from 'lucide-react';
import { useAuth, useNotifs, usePersonalDays } from '../context';
import { Button } from '../components/ui';
import { DeskHeader } from '../components/Desk';
import { Masthead, TabStrip, TouchButton, useTouch } from '../components/Touch';
import { ActiveIndicator, IndicatorGroup } from '../motion/ActiveIndicator';
import { haptic } from '../utils/haptics';
import { supabase } from '../utils/supabase';
import {
  CLOCK_KINDS, FALLBACK_SCHEDULE, clockEvent, fetchTimeEntries, fetchTimeCorrections, fetchWorkSchedules,
  reviewTimeCorrection, cancelTimeCorrection, resolveSchedule, madridDayKey, madridTime, monthStart, monthEnd, weekStart,
} from '../../shared/services/timeTracking.js';
import { toUserMessage } from '../../shared/utils/errors.js';
import ClockCard from './fichaje/ClockCard';
import TodayCard from './fichaje/TodayCard';
import MonthHistory from './fichaje/MonthHistory';
import CorrectionsList from './fichaje/CorrectionsList';
import CorrectionModal from './fichaje/CorrectionModal';
import TeamPanel, { daysOffOf } from './fichaje/TeamPanel';
import SchedulesPanel from './fichaje/SchedulesPanel';
import styles from './fichaje/Fichaje.module.scss';

const VIEWS = [
  { value: 'mine', label: 'Mi jornada', icon: Clock },
  { value: 'team', label: 'Equipo', icon: UsersRound },
  { value: 'schedules', label: 'Horarios', icon: CalendarClock },
];

/**
 * Fichaje: the daily record of working time (art. 34.9 ET). Everyone clocks in and out, takes
 * breaks, sees their day, week and month against their schedule, and asks for a correction when
 * something was forgotten. RR. HH. also sees the team, reviews corrections, sets the schedules and
 * downloads the monthly record. Times are always the server's; nothing is ever deleted.
 */
export default function FichajePage() {
  const { user, employees = [], refreshEmployees } = useAuth();
  const { personalDays = [] } = usePersonalDays() || {};
  const { announce } = useNotifs();
  const touch = useTouch();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const view = isAdmin && ['team', 'schedules'].includes(params.get('vista')) ? params.get('vista') : 'mine';
  const setView = (v) => setParams(v === 'mine' ? {} : { vista: v }, { replace: true });

  const today = madridDayKey();
  const [schedules, setSchedules] = useState([FALLBACK_SCHEDULE]);
  const [recent, setRecent] = useState({ rows: [], state: 'loading', missing: false });
  const [month, setMonthState] = useState(monthStart(today));
  const [monthData, setMonthData] = useState({ rows: [], state: 'loading' });
  const [corrections, setCorrections] = useState({ rows: [], state: 'loading' });
  const [person, setPerson] = useState(null); // RR. HH. looking at someone's month
  const [correcting, setCorrecting] = useState(null); // { dayKey, employeeId }
  const [busy, setBusy] = useState(null);
  const [clockError, setClockError] = useState('');
  const [reviewBusy, setReviewBusy] = useState(null);

  const subject = person || user;
  const setMonth = (key) => setMonthState(monthStart(key > today ? today : key));

  const loadSchedules = useCallback(async () => {
    const list = await fetchWorkSchedules(supabase);
    if (list?.length) setSchedules(list);
  }, []);

  const loadRecent = useCallback(async () => {
    if (!user?.id) return;
    const res = await fetchTimeEntries(supabase, { employeeId: user.id, from: weekStart(today), to: today });
    setRecent(res.error ? (prev) => ({ ...prev, state: 'error', missing: !!res.missing }) : { rows: res.rows, state: 'ready', missing: false });
  }, [user?.id, today]);

  const loadMonth = useCallback(async () => {
    if (!subject?.id) return;
    setMonthData((prev) => ({ ...prev, state: 'loading' }));
    const res = await fetchTimeEntries(supabase, { employeeId: subject.id, from: month, to: monthEnd(month) });
    setMonthData(res.error ? { rows: [], state: 'error' } : { rows: res.rows, state: 'ready' });
  }, [subject?.id, month]);

  const loadCorrections = useCallback(async () => {
    if (!user?.id) return;
    // RR. HH. in the team view: everyone's (the person's, when one is open); otherwise their own
    const scope = view === 'team' && isAdmin ? (person ? { employeeId: person.id } : {}) : { employeeId: user.id };
    const res = await fetchTimeCorrections(supabase, scope);
    setCorrections(res.error ? { rows: [], state: 'error' } : { rows: res.rows, state: 'ready' });
  }, [user?.id, view, isAdmin, person]);

  // Pending corrections for RR. HH.'s tab badge
  const [pendingCount, setPendingCount] = useState(0);
  const loadPending = useCallback(async () => {
    if (!isAdmin) return;
    const res = await fetchTimeCorrections(supabase, { status: 'pending' });
    if (!res.error) setPendingCount(res.rows.length);
  }, [isAdmin]);

  useEffect(() => { loadSchedules(); loadRecent(); loadPending(); }, [loadSchedules, loadRecent, loadPending]);
  useEffect(() => { loadMonth(); }, [loadMonth]);
  useEffect(() => { setCorrections((c) => ({ ...c, state: 'loading' })); loadCorrections(); }, [loadCorrections]);
  useEffect(() => { if (view !== 'team') setPerson(null); }, [view]);
  useEffect(() => { setMonthState(monthStart(today)); }, [person?.id, today]);

  // Clocked from the app or another tab: catch up when this one comes back
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      loadRecent(); loadMonth(); loadCorrections(); loadPending();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadRecent, loadMonth, loadCorrections, loadPending]);

  const mySchedule = useMemo(() => resolveSchedule(schedules, user), [schedules, user]);
  const subjectSchedule = useMemo(() => resolveSchedule(schedules, subject), [schedules, subject]);
  const myDaysOff = useMemo(() => daysOffOf(personalDays, user?.id), [personalDays, user?.id]);
  const subjectDaysOff = useMemo(() => daysOffOf(personalDays, subject?.id), [personalDays, subject?.id]);

  const onClock = async (kind, note) => {
    if (busy) return null;
    setBusy(kind);
    setClockError('');
    const res = await clockEvent(supabase, kind, { source: 'web', note });
    setBusy(null);
    if (res.error) {
      haptic('error');
      setClockError(toUserMessage(res.error));
      loadRecent(); // another device may have clocked meanwhile
      return null;
    }
    haptic('success');
    announce('✅', `${CLOCK_KINDS[kind].past} a las ${madridTime(res.entry.at)}.`);
    setRecent((prev) => ({ ...prev, rows: [...prev.rows, res.entry], state: 'ready' }));
    if (!person && month === monthStart(today)) loadMonth();
    return res.entry;
  };

  const onReview = async (id, approve, note) => {
    setReviewBusy(id);
    const res = await reviewTimeCorrection(supabase, id, approve, note);
    setReviewBusy(null);
    if (res.error) { announce('❌', toUserMessage(res.error), 7000); return false; }
    announce(approve ? '✅' : '❌', approve ? 'Corrección aprobada y aplicada.' : 'Corrección rechazada. Se ha avisado a la persona.');
    loadCorrections(); loadPending(); loadMonth(); loadRecent();
    return true;
  };

  const onCancel = async (id) => {
    setReviewBusy(id);
    const res = await cancelTimeCorrection(supabase, id);
    setReviewBusy(null);
    if (res.error) { announce('❌', toUserMessage(res.error), 7000); return; }
    announce('↩️', 'Corrección cancelada.');
    loadCorrections();
  };

  const afterCorrection = (msg) => {
    announce(isAdmin ? '✅' : '📨', msg);
    loadCorrections(); loadPending(); loadMonth(); loadRecent();
  };

  const desc = view === 'team'
    ? 'Quién está trabajando, quién no ha fichado y qué fichajes hay que corregir.'
    : view === 'schedules'
      ? 'El horario de cada persona: con él se calculan las horas extra y las que faltan.'
      : 'Ficha tu entrada, tus descansos y tu salida, y consulta tus horas frente a tu horario.';

  const views = VIEWS.map((v) => (v.value === 'team' ? { ...v, count: pendingCount || undefined } : v));
  const correctButton = view === 'mine' && (touch
    ? <TouchButton icon={PenLine} onClick={() => setCorrecting({ dayKey: today, employeeId: user.id })}>Solicitar corrección</TouchButton>
    : <Button variant="secondary" icon={PenLine} onClick={() => setCorrecting({ dayKey: today, employeeId: user.id })}>Solicitar corrección</Button>);

  const deskSwitch = isAdmin && (
    <IndicatorGroup>
      <div className={styles.views} role="tablist" aria-label="Vista">
        {views.map((v) => (
          <button key={v.value} type="button" role="tab" aria-selected={view === v.value}
            className={clsx(styles.viewBtn, view === v.value && styles.viewOn)} onClick={() => setView(v.value)}>
            {view === v.value && <ActiveIndicator className={styles.viewIndicator} radius={999} />}
            <v.icon size={15} aria-hidden="true" /> {v.label}
            {v.count ? <span className={styles.viewCount} aria-label={`${v.count} correcciones pendientes`}>{v.count}</span> : null}
          </button>
        ))}
      </div>
    </IndicatorGroup>
  );

  const mine = (
    <>
      <div className={styles.clockGrid}>
        <ClockCard entries={recent.rows} schedule={mySchedule} onClock={onClock} busy={busy}
          error={clockError || (recent.state === 'error' && !recent.missing ? 'No se han podido cargar tus fichajes de hoy. Comprueba la conexión.' : '')}
          unavailable={recent.missing} />
        <TodayCard entries={recent.rows} schedule={mySchedule} daysOff={myDaysOff}
          onCorrect={(dayKey) => setCorrecting({ dayKey, employeeId: user.id })} />
      </div>
      <MonthHistory touch={touch} month={month} setMonth={setMonth} entries={monthData.rows} state={monthData.state} onRetry={loadMonth}
        schedule={mySchedule} daysOff={myDaysOff} personName={user?.name}
        onCorrect={(dayKey) => setCorrecting({ dayKey, employeeId: user.id })} correctLabel="Solicitar corrección" />
      <CorrectionsList touch={touch} title="Tus correcciones" rows={corrections.rows} state={corrections.state} onRetry={loadCorrections}
        onCancel={onCancel} busyId={reviewBusy}
        emptyText="Si olvidas fichar o fichas a una hora equivocada, pide aquí la corrección: RR. HH. la revisará." />
    </>
  );

  const team = person ? (
    <>
      <div className={styles.sectionBar}>
        {touch
          ? <TouchButton icon={ChevronLeft} onClick={() => setPerson(null)}>Equipo</TouchButton>
          : <Button variant="ghost" icon={ChevronLeft} onClick={() => setPerson(null)}>Volver al equipo</Button>}
        <p><strong>{person.name}</strong>{person.dept ? ` · ${person.dept}` : ''} · horario «{subjectSchedule.name}»</p>
      </div>
      <MonthHistory touch={touch} month={month} setMonth={setMonth} entries={monthData.rows} state={monthData.state} onRetry={loadMonth}
        schedule={subjectSchedule} daysOff={subjectDaysOff} personName={person.name}
        onCorrect={(dayKey) => setCorrecting({ dayKey, employeeId: person.id })} />
      <CorrectionsList touch={touch} isAdmin title={`Correcciones de ${person.name}`} rows={corrections.rows} state={corrections.state} onRetry={loadCorrections}
        employees={employees} onReview={onReview} busyId={reviewBusy} emptyText="Esta persona no ha pedido correcciones." />
    </>
  ) : (
    <>
      <CorrectionsList touch={touch} isAdmin title="Correcciones pendientes" rows={corrections.rows.filter((c) => c.status === 'pending')}
        state={corrections.state} onRetry={loadCorrections} employees={employees} onReview={onReview} busyId={reviewBusy}
        emptyText="No hay correcciones por revisar." />
      <TeamPanel touch={touch} employees={employees} schedules={schedules} personalDays={personalDays} announce={announce}
        onOpenPerson={setPerson} onCorrect={(dayKey, employeeId) => setCorrecting({ dayKey, employeeId })} />
    </>
  );

  return (
    <div className={styles.page}>
      {touch ? (
        <>
          <Masthead icon={Clock} title="Fichaje" desc={desc} />
          {isAdmin && <TabStrip label="Vista" value={view} onChange={setView} options={views} />}
          {correctButton && <div className={styles.sectionBar}><p>¿Olvidaste fichar?</p>{correctButton}</div>}
        </>
      ) : (
        <DeskHeader icon={Clock} kicker="Registro de jornada" title="Fichaje" desc={desc}
          actions={<>{deskSwitch}{correctButton}</>} />
      )}

      {view === 'mine' && mine}
      {view === 'team' && isAdmin && team}
      {view === 'schedules' && isAdmin && (
        <SchedulesPanel touch={touch} schedules={schedules} employees={employees} announce={announce}
          onChanged={loadSchedules} onEmployeesChanged={refreshEmployees} />
      )}

      <p className={styles.legal}>
        Registro diario de jornada (art. 34.9 del Estatuto de los Trabajadores). La hora de cada fichaje la pone el servidor;
        los registros se conservan cuatro años y ninguno se borra: una corrección deja constancia del original.
      </p>

      <CorrectionModal open={!!correcting} onClose={() => setCorrecting(null)}
        dayKey={correcting?.dayKey} employeeId={correcting?.employeeId} isAdmin={isAdmin}
        employees={isAdmin ? employees : undefined} onDone={afterCorrection} />
    </div>
  );
}
