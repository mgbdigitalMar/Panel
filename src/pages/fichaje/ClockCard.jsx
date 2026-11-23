import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LogIn, LogOut, Coffee, Play, CheckCircle2 } from 'lucide-react';
import {
  CLOCK_KINDS, CLOCK_STATES, clockState, summarizeDay, expectedMinutes, formatMinutes, madridDayKey, madridTime,
} from '../../../shared/services/timeTracking.js';
import styles from './Fichaje.module.scss';

const ICONS = { in: LogIn, break_start: Coffee, break_end: Play, out: LogOut };
const dateLine = (now) => now.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' });

/** Ticks every second while mounted (only this card re-renders). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return now;
}

/**
 * The clock panel: Spain's time, where the day stands (not clocked in, working, on a break, done),
 * the first entry, time worked and breaks counted live, progress against the schedule, and the one
 * or two actions that make sense now. The time of each event is the server's, never this device's.
 */
export default function ClockCard({ entries, schedule, onClock, busy, error, unavailable }) {
  const now = useNow();
  const reduce = useReducedMotion();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(null); // kind just recorded, for the confirmation

  const today = madridDayKey(now);
  const status = clockState(entries, now);
  const day = summarizeDay((entries || []).filter((e) => madridDayKey(e.at) === today), { now, dayKey: today });
  const expected = expectedMinutes(schedule, today);
  const pct = expected ? Math.min(100, Math.round((day.workedMinutes / expected) * 100)) : 0;
  const state = CLOCK_STATES[status.state];

  // onClock resolves to the recorded entry (with the server's time) or null
  const press = async (kind) => {
    const entry = await onClock(kind, noteOpen ? note : '');
    if (entry) {
      setNote('');
      setNoteOpen(false);
      setDone({ kind, at: entry.at });
      setTimeout(() => setDone(null), reduce ? 900 : 1600);
    }
  };

  // Primary action first: entry, back from the break, or the break when working
  const actions = status.allowed;

  return (
    <section className={styles.clock} aria-labelledby="clock-title" data-haptic="medium">
      <div className={styles.clockTop}>
        <p className={styles.clockDate}>{dateLine(now)}</p>
        <span className={styles.statePill} data-state={status.state} role="status" aria-live="polite">
          <i aria-hidden="true" />{state.label}
        </span>
      </div>

      <h2 id="clock-title" className={styles.sr}>Fichaje de hoy</h2>
      <p className={styles.time} aria-label={`Son las ${madridTime(now)}`}>
        {madridTime(now)}<small>{String(now.getSeconds()).padStart(2, '0')}</small>
      </p>

      <dl className={styles.figures}>
        <div><dt>Entrada</dt><dd>{status.firstIn ? madridTime(status.firstIn.at) : '—'}</dd></div>
        <div><dt>Trabajado</dt><dd>{formatMinutes(day.workedMinutes)}</dd></div>
        <div><dt>Descansos</dt><dd>{formatMinutes(day.breakMinutes)}</dd></div>
      </dl>

      {expected > 0 && (
        <>
          <div className={styles.progress} role="progressbar" aria-label="Jornada de hoy" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className={styles.progressText}>
            {day.workedMinutes >= expected
              ? `Jornada de hoy cumplida (${formatMinutes(expected)}).`
              : `Te quedan ${formatMinutes(expected - day.workedMinutes)} de ${formatMinutes(expected)} según tu horario.`}
          </p>
        </>
      )}

      {unavailable ? (
        <p className={styles.clockError} role="alert">El fichaje aún no está activado: falta aplicar su migración en Supabase.</p>
      ) : (
        <>
          <div className={styles.actions}>
            {actions.map((kind, i) => {
              const Icon = ICONS[kind];
              return (
                <button key={kind} type="button" disabled={busy}
                  className={`${styles.clockBtn} ${i === 0 ? styles.clockBtnPrimary : ''}`}
                  onClick={() => press(kind)}>
                  <Icon size={20} aria-hidden="true" />
                  {busy === kind ? 'Registrando…' : CLOCK_KINDS[kind].action}
                </button>
              );
            })}
          </div>

          {noteOpen ? (
            <div className={styles.note}>
              <label htmlFor="clock-note">Observación (opcional)</label>
              <input id="clock-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)}
                placeholder="Por ejemplo: visita a cliente" autoComplete="off" />
            </div>
          ) : (
            <button type="button" className={styles.noteToggle} onClick={() => setNoteOpen(true)}>Añadir una observación</button>
          )}

          {error && <p className={styles.clockError} role="alert">{error}</p>}
        </>
      )}

      <AnimatePresence>
        {done && (
          <motion.div className={styles.done} role="status"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.1 : 0.2 }}>
            <motion.span initial={reduce ? false : { scale: 0.6 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.45, visualDuration: 0.35 }}>
              <CheckCircle2 size={48} aria-hidden="true" />
            </motion.span>
            {CLOCK_KINDS[done.kind].past} a las {madridTime(done.at)}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
