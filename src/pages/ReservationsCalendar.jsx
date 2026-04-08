import { useState, useMemo } from 'react';
import { useData } from '../context';
import { Building, Car, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './ReservationsCalendar.module.scss';
import clsx from 'clsx';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const HOURS     = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2,'0')}:00`);

function parseH(t) { const [h, m] = t.split(':').map(Number); return h + m / 60; }

function getMonthMatrix(year, month) {
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (first + 6) % 7; // Monday-based
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function getWeekDays(baseDate) {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateString(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function ReservationsCalendar() {
  const { reservations } = useData();
  const [viewMode, setViewMode] = useState('month');
  const [base, setBase] = useState(new Date(2025, 0, 1));

  const year = base.getFullYear();
  const month = base.getMonth();

  const prev = () => {
    const d = new Date(base);
    if (viewMode === 'month') d.setMonth(month - 1);
    else d.setDate(base.getDate() - 7);
    setBase(d);
  };
  const next = () => {
    const d = new Date(base);
    if (viewMode === 'month') d.setMonth(month + 1);
    else d.setDate(base.getDate() + 7);
    setBase(d);
  };

  // ── Monthly ──────────────────────────────────────────────
  const monthMatrix = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const resByDay = useMemo(() => {
    const map = {};
    reservations.forEach(r => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [reservations]);

  // ── Weekly ───────────────────────────────────────────────
  const weekDays = useMemo(() => getWeekDays(base), [base]);

  const weekLabel = `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTHS_ES[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  function resByDayHour(day) {
    const ds = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
    return (resByDay[ds] || []);
  }

  return (
    <div className={styles.calendar}>
      {/* Header */}
      <div className={styles.calHeader}>
        <div className={styles.viewToggle}>
          <button onClick={() => setViewMode('month')} className={clsx(styles.viewBtn, { [styles.viewBtnActive]: viewMode === 'month' })}>Mes</button>
          <button onClick={() => setViewMode('week')} className={clsx(styles.viewBtn, { [styles.viewBtnActive]: viewMode === 'week' })}>Semana</button>
        </div>
        <div className={styles.navRow}>
          <button className={styles.navBtn} onClick={prev}><ChevronLeft size={16} /></button>
          <span className={styles.periodLabel}>
            {viewMode === 'month' ? `${MONTHS_ES[month]} ${year}` : weekLabel}
          </span>
          <button className={styles.navBtn} onClick={next}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Month view */}
      {viewMode === 'month' && (
        <div className={styles.monthGrid}>
          {DAYS_ES.map(d => <div key={d} className={styles.dayHeader}>{d}</div>)}
          {monthMatrix.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className={styles.emptyCell} />;
            const ds = dateString(year, month, day);
            const dayRes = resByDay[ds] || [];
            return (
              <div key={ds} className={clsx(styles.dayCell, { [styles.dayCellHasRes]: dayRes.length > 0 })}>
                <span className={styles.dayNum}>{day}</span>
                <div className={styles.dayChips}>
                  {dayRes.slice(0, 3).map(r => (
                    <div
                      key={r.id}
                      className={styles.chip}
                      style={{
                        background: r.type === 'room' ? 'var(--accent-bg)' : 'var(--warning-bg)',
                        color: r.type === 'room' ? 'var(--accent)' : 'var(--warning)',
                      }}
                      title={`${r.resourceName} — ${r.timeStart}–${r.timeEnd}`}
                    >
                      {r.type === 'room' ? <Building size={10} /> : <Car size={10} />}
                      <span>{r.resourceName.split(' ')[1] || r.resourceName}</span>
                    </div>
                  ))}
                  {dayRes.length > 3 && (
                    <div className={styles.chip} style={{ background: 'var(--border)', color: 'var(--text-mut)' }}>
                      +{dayRes.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Week view */}
      {viewMode === 'week' && (
        <div className={styles.weekGrid}>
          {/* Column headers */}
          <div className={styles.hourAxisEmpty} />
          {weekDays.map((d, i) => (
            <div key={i} className={styles.weekDayHeader}>
              <span className={styles.weekDayName}>{DAYS_ES[i]}</span>
              <span className={styles.weekDayNum}>{d.getDate()}</span>
            </div>
          ))}

          {/* Hour rows */}
          {HOURS.map(hour => (
            <>
              <div key={`h-${hour}`} className={styles.hourLabel}>{hour}</div>
              {weekDays.map((d, di) => {
                const dayRes = resByDayHour(d).filter(r => {
                  const start = parseH(r.timeStart);
                  const thisH = parseInt(hour);
                  const end = parseH(r.timeEnd);
                  return start <= thisH && thisH < end;
                });
                return (
                  <div key={`${di}-${hour}`} className={styles.weekCell}>
                    {dayRes.map(r => (
                      <div
                        key={r.id}
                        className={styles.weekEvent}
                        style={{
                          background: r.type === 'room' ? 'var(--accent-bg)' : 'var(--warning-bg)',
                          borderLeftColor: r.type === 'room' ? 'var(--accent)' : 'var(--warning)',
                          color: r.type === 'room' ? 'var(--accent)' : 'var(--warning)',
                        }}
                        title={`${r.resourceName} — ${r.employeeName}`}
                      >
                        <span className={styles.eventName}>{r.resourceName.split(' ')[0]} {r.resourceName.split(' ')[1]}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      )}
    </div>
  );
}
