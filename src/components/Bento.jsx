import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localISODate } from '../../shared/services/workMode.js';
import styles from './Bento.module.scss';

/**
 * Bento pieces shared by phone and computer, the same as the app's (mobile/src/components/common/Bento.jsx):
 * big light figures, proportion pills, capsule bars, a month grid with hatched off-days and the dark ink card.
 */

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEK_HEAD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));

/** Large light figure with its unit ("+12:30 horas"). `tone`: 'danger' | 'onInk'. */
export function BigFigure({ value, unit, tone, size, className, label }) {
  return (
    <p className={clsx(styles.figure, tone && styles[`figure_${tone}`], className)} style={size ? { '--figure-size': `${size}px` } : undefined}
      aria-label={label}>
      <strong>{value}</strong>
      {unit && <span>{unit}</span>}
    </p>
  );
}

/**
 * Proportion pills with their label above; each pill's width follows its share of the total.
 * items: [{ label, value, display, tone: 'accent' | 'plate' | 'amber' | 'neutral' }]
 */
export function SplitPills({ items, className }) {
  const total = items.reduce((s, it) => s + Math.max(0, Number(it.value) || 0), 0);
  return (
    <div className={clsx(styles.split, className)}>
      {items.map((it) => {
        const share = total ? Math.max(0, Number(it.value) || 0) / total : 1 / items.length;
        return (
          <div key={it.label} className={styles.splitItem} style={{ flexGrow: Math.max(share, 0.24) }}>
            <span className={styles.splitLabel}>{it.label}</span>
            <span className={styles.splitPill} data-tone={it.tone}>{it.display}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Thin vertical capsules filled from the bottom (0–100) with the label underneath.
 * items: [{ key, label, value, highlight?, dot?, title? }]
 */
export function CapsuleBars({ items, height = 110, className, label }) {
  return (
    <ul className={clsx(styles.capsules, className)} style={{ '--capsule-h': `${height}px` }} aria-label={label}>
      {items.map((it) => {
        const pct = clamp(it.value);
        return (
          <li key={it.key || it.label} className={clsx(it.highlight && styles.capsuleOn)} title={it.title} aria-label={it.title}>
            <span className={styles.capsule} aria-hidden="true">
              {pct > 0 && <i style={{ height: `max(${pct}%, 10px)` }} />}
            </span>
            <span className={styles.capsuleLabel} aria-hidden="true">{it.label}</span>
            <span className={clsx(styles.capsuleDot, it.dot && styles.capsuleDotOn)} aria-hidden="true" />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Monday-first month grid: rounded cells, weekend headers in rose, hatched weekends and days
 * outside the month. marks: { [iso]: { tone: 'accent' | 'amber' | 'danger', label } } · onSelect(iso)
 */
export function MonthCalendar({ month, marks = {}, selected, onSelect, className }) {
  const today = localISODate(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = [];
  let d = mondayOf(first);
  do {
    for (let i = 0; i < 7; i += 1) days.push(addDays(d, i));
    d = addDays(d, 7);
  } while (d.getMonth() === month.getMonth());

  return (
    <div className={clsx(styles.calendar, className)} role="grid" aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}>
      {WEEK_HEAD.map((h, i) => (
        <span key={h} className={clsx(styles.calHead, i >= 5 && styles.calHeadWeekend)} role="columnheader">{h}</span>
      ))}
      {days.map((day) => {
        const iso = localISODate(day);
        const inMonth = day.getMonth() === month.getMonth();
        const weekend = day.getDay() === 0 || day.getDay() === 6;
        const mark = inMonth ? marks[iso] : null;
        return (
          <button
            key={iso}
            type="button"
            role="gridcell"
            className={clsx(
              styles.cell,
              !inMonth && styles.cellOut,
              weekend && !mark && styles.cellWeekend,
              iso === today && styles.cellToday,
              selected === iso && inMonth && styles.cellSelected,
            )}
            data-tone={mark?.tone}
            disabled={!inMonth || !onSelect}
            aria-selected={selected === iso}
            aria-label={`${day.getDate()} de ${MONTHS[day.getMonth()]}${iso === today ? ', hoy' : ''}${mark?.label ? `, ${mark.label}` : ''}`}
            onClick={() => onSelect?.(iso)}
          >
            <span>{day.getDate()}</span>
            {mark && <i aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

/** Glass pill "‹ Octubre ›" that moves a month cursor (first day of the month). */
export function MonthSwitcher({ value, onChange }) {
  const y = value.getFullYear();
  const m = value.getMonth();
  const name = MONTHS[m].charAt(0).toUpperCase() + MONTHS[m].slice(1);
  return (
    <div className={styles.switcher}>
      <button type="button" onClick={() => onChange(new Date(y, m - 1, 1))} aria-label="Mes anterior"><ChevronLeft size={16} aria-hidden="true" /></button>
      <span aria-live="polite">{name}{y !== new Date().getFullYear() ? ` ${y}` : ''}</span>
      <button type="button" onClick={() => onChange(new Date(y, m + 1, 1))} aria-label="Mes siguiente"><ChevronRight size={16} aria-hidden="true" /></button>
    </div>
  );
}

/** The dark brand card (Margube navy in both themes) for the one detail a page focuses on. */
export function InkCard({ title, children, className, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={clsx(styles.ink, className)} {...rest}>
      {title && <h3 className={styles.inkTitle}><i aria-hidden="true" />{title}</h3>}
      {children}
    </Tag>
  );
}

/** Dashed rule inside an ink card. */
export function InkDivider() {
  return <hr className={styles.inkDivider} />;
}
