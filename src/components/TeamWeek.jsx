import { useMemo, useState } from 'react';
import { Building2, Home, MapPin, Sun, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import clsx from 'clsx';
import { useRequests, usePersonalDays } from '../context';
import { AVAILABILITY, weekDates, teamWeek, dayCounts } from '../../shared/services/availability.js';
import { localISODate } from '../../shared/services/workMode.js';
import { Avatar, Card } from './ui';
import styles from './TeamWeek.module.scss';

// Same icons and colours as the work mode badges of the directory
const LOOK = {
  office:          { icon: Building2, tone: 'accent' },
  remoto:          { icon: Home,      tone: 'success' },
  externo:         { icon: MapPin,    tone: 'warning' },
  asuntos_propios: { icon: Sun,       tone: 'info' },
};

const SOURCE_NOTE = {
  live: 'ahora mismo',
  personal_day: 'día aprobado',
  request: 'solicitud aprobada',
  schedule: 'según su horario',
};

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const dayNum = (iso) => Number(iso.slice(8, 10));
const monthOf = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1];

/** Who works where each day of the week: Equipo → Semana. `employees` is the already filtered directory. */
export function TeamWeek({ employees, isAdmin }) {
  const { requests = [] } = useRequests() || {};
  const { personalDays = [] } = usePersonalDays() || {};
  const [offset, setOffset] = useState(0);
  const today = localISODate();

  const dates = useMemo(() => weekDates(offset, today), [offset, today]);
  const rows = useMemo(
    () => teamWeek(employees, dates, { requests, personalDays, today }),
    [employees, dates, requests, personalDays, today],
  );

  const first = dates[0];
  const last = dates[4];
  const range = monthOf(first) === monthOf(last)
    ? `${dayNum(first)}–${dayNum(last)} ${monthOf(last)}`
    : `${dayNum(first)} ${monthOf(first)} – ${dayNum(last)} ${monthOf(last)}`;
  const weekLabel = offset === 0 ? 'Esta semana' : offset === 1 ? 'Próxima semana' : offset === -1 ? 'Semana pasada' : range;

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <div className={styles.nav}>
          <button type="button" className={styles.navBtn} onClick={() => setOffset(o => o - 1)} aria-label="Semana anterior">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className={styles.period} aria-live="polite">
            <strong>{weekLabel}</strong>
            {offset >= -1 && offset <= 1 && <span>{range}</span>}
          </div>
          <button type="button" className={styles.navBtn} onClick={() => setOffset(o => o + 1)} aria-label="Semana siguiente">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          {offset !== 0 && (
            <button type="button" className={styles.todayBtn} onClick={() => setOffset(0)}>Hoy</button>
          )}
        </div>
        <ul className={styles.legend} aria-label="Leyenda">
          {Object.entries(AVAILABILITY).map(([key, meta]) => {
            const { icon: Icon, tone } = LOOK[key];
            return (
              <li key={key} className={clsx(styles.chip, styles[tone])}>
                <Icon size={12} aria-hidden="true" />{meta.label}
              </li>
            );
          })}
        </ul>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty} role="status">No hay personas que mostrar con este filtro.</p>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <caption className="sr-only">Dónde trabaja cada persona, {weekLabel.toLowerCase()} ({range})</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.personHead}>Persona</th>
                {dates.map((d, i) => (
                  <th
                    key={d}
                    scope="col"
                    className={clsx(styles.dayHead, { [styles.isToday]: d === today, [styles.isPast]: d < today })}
                    aria-current={d === today ? 'date' : undefined}
                  >
                    <span className={styles.wd}>{WEEKDAYS[i]}</span>
                    <span className={styles.dn}>{dayNum(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ employee, days }) => (
                <tr key={employee.id}>
                  <th scope="row" className={styles.person}>
                    <span className={styles.personInner}>
                      <Avatar initials={employee.avatar} size={30} />
                      <span className={styles.personText}>
                        <span className={styles.name}>{employee.name}</span>
                        <span className={styles.dept}>{employee.dept}</span>
                      </span>
                    </span>
                  </th>
                  {days.map((day) => {
                    const { icon: Icon, tone } = LOOK[day.status];
                    const meta = AVAILABILITY[day.status];
                    return (
                      <td key={day.date} className={clsx(styles.cell, { [styles.isToday]: day.date === today, [styles.isPast]: day.date < today })}>
                        <span className={clsx(styles.chip, styles[tone])} title={`${meta.label} · ${SOURCE_NOTE[day.source]}`}>
                          <Icon size={12} aria-hidden="true" />
                          <span className={styles.full}>{meta.label}</span>
                          <span className={styles.short} aria-hidden="true">{meta.short}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className={styles.person}>En la oficina</th>
                {dates.map((d) => (
                  <td key={d} className={clsx(styles.total, { [styles.isToday]: d === today })}>
                    {dayCounts(rows, d).office}<span className={styles.of}>/{rows.length}</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!isAdmin && (
        <p className={styles.note}>
          <Info size={14} aria-hidden="true" />
          Hoy ves dónde está cada persona ahora. Para el resto de días de tus compañeros se usa su horario de teletrabajo:
          sus solicitudes y asuntos propios solo los ven ellos y RRHH.
        </p>
      )}
    </Card>
  );
}
