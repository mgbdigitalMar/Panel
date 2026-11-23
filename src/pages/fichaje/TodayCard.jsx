import { useMemo } from 'react';
import { PenLine } from 'lucide-react';
import { Button } from '../../components/ui';
import {
  CLOCK_KINDS, WEEKDAYS, summarizeRange, formatMinutes, madridDayKey, madridTime, weekStart, addDays,
} from '../../../shared/services/timeTracking.js';
import styles from './Fichaje.module.scss';

const SOURCE = { web: 'web', app: 'app', correction: 'corregido' };

/**
 * Today's clock events as a timeline (corrected ones struck through, never hidden) and this week
 * as bars: time worked against the schedule's line, so a short or long day is seen at a glance.
 */
export default function TodayCard({ entries, schedule, daysOff, onCorrect }) {
  const today = madridDayKey();
  const monday = weekStart(today);
  const todays = (entries || []).filter((e) => madridDayKey(e.at) === today).sort((a, b) => new Date(a.at) - new Date(b.at));
  const { days, totals } = useMemo(
    () => summarizeRange(entries || [], { from: monday, to: addDays(monday, 6), schedule, daysOff }),
    [entries, monday, schedule, daysOff],
  );
  const scale = Math.max(60, ...days.map((d) => Math.max(d.workedMinutes, d.expectedMinutes)));

  return (
    <section className={styles.card} aria-labelledby="today-title">
      <div className={styles.cardHead}>
        <div>
          <h2 id="today-title">Hoy</h2>
          <p>{todays.length ? `${todays.filter((e) => !e.voided).length} fichajes` : 'Aún no has fichado hoy'}</p>
        </div>
        {onCorrect && <Button variant="ghost" size="sm" icon={PenLine} onClick={() => onCorrect(today)}>Corregir</Button>}
      </div>

      {todays.length > 0 && (
        <ol className={styles.timeline}>
          {todays.map((e) => (
            <li key={e.id} data-kind={e.kind} data-voided={e.voided || undefined}>
              <time dateTime={e.at}>{madridTime(e.at)}</time>
              <i aria-hidden="true" />
              <span>
                {CLOCK_KINDS[e.kind]?.label}
                <small>{e.voided ? 'anulado por una corrección' : SOURCE[e.source] || e.source}{e.note ? ` · ${e.note}` : ''}</small>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.cardHead}>
        <div>
          <h2>Esta semana</h2>
          <p>{formatMinutes(totals.worked)} trabajadas · horario {formatMinutes(days.reduce((s, d) => s + d.expectedMinutes, 0))}</p>
        </div>
      </div>
      <div className={styles.week} role="list" aria-label="Horas por día de esta semana">
        {days.map((d, i) => {
          const tone = d.incomplete ? 'danger' : d.diffMinutes < 0 ? 'warning' : undefined;
          return (
            <div key={d.dayKey} role="listitem" className={styles.weekDay} data-today={d.dayKey === today || undefined}
              aria-label={`${WEEKDAYS[i].label}: ${formatMinutes(d.workedMinutes)} de ${formatMinutes(d.expectedMinutes)}${d.incomplete ? ', incompleto' : ''}`}>
              <strong aria-hidden="true">{d.workedMinutes ? `${Math.floor(d.workedMinutes / 60)}:${String(d.workedMinutes % 60).padStart(2, '0')}` : '–'}</strong>
              <div className={styles.bar} data-tone={tone} aria-hidden="true">
                <span style={{ height: `${(d.workedMinutes / scale) * 100}%` }} />
                {d.expectedMinutes > 0 && <em style={{ bottom: `${(d.expectedMinutes / scale) * 100}%` }} />}
              </div>
              <span aria-hidden="true">{WEEKDAYS[i].short}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
