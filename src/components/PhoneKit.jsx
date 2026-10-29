import clsx from 'clsx';
import { useMediaQuery, PHONE_QUERY } from '../hooks/useMediaQuery';
import styles from './PhoneKit.module.scss';

/**
 * Pieces of the phone layout of the glass appearance, the mobile app's screens on the web
 * (mobile/src/components/common/UI.jsx). Pages switch to them with usePhoneApp().
 */

/** Phones: the width where the web shows the bottom dock and the app's screens. */
export function usePhoneApp() {
  return useMediaQuery(PHONE_QUERY);
}

/** Large title with the screen's actions on the right. */
export function PhoneHeader({ title, children }) {
  return (
    <div className={styles.header}>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

/** Round liquid-glass icon button (CSV, back…). */
export function RoundButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" className={styles.round} onClick={onClick} aria-label={label} title={label}>
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

/** Pill button: `primary` is the brand gradient, otherwise liquid glass. */
export function PillButton({ icon: Icon, children, onClick, primary, className }) {
  return (
    <button type="button" className={clsx(styles.pill, primary && styles.pillPrimary, className)} onClick={onClick}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Two or three options in a track; the chosen one is a glass thumb. */
export function Segmented({ value, onChange, options, label }) {
  return (
    <div className={styles.segmented} role="tablist" aria-label={label} style={{ '--seg-count': options.length }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
          className={clsx(value === o.value && styles.segOn)} onClick={() => onChange(o.value)} disabled={o.disabled}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Text tabs with a count; the open one is blue and underlined. */
export function CountTabs({ value, onChange, options, label }) {
  return (
    <div className={styles.countTabs} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
          className={clsx(value === o.value && styles.countOn)} onClick={() => onChange(o.value)}>
          {o.label} <span>{o.count}</span>
        </button>
      ))}
    </div>
  );
}

/** Horizontal rail of filter chips. */
export function ChipRail({ value, onChange, options, label }) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value}
          className={clsx(value === o.value && styles.chipOn)} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Round icon on a tinted disc: accent, teal, amber, purple, danger, success, neutral. */
export function IconDisc({ icon: Icon, tone = 'accent', size = 42 }) {
  return (
    <span className={styles.disc} data-tone={tone} style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.45)} />
    </span>
  );
}

/** Status pill: amber (pending), green (approved), red (rejected), or neutral. */
export function StatusPill({ tone, children }) {
  return <span className={styles.status} data-tone={tone}>{children}</span>;
}

/** Glass card row: icon, title and subtitle, and something on the right. */
export function Row({ left, title, subtitle, right, onClick, children, className }) {
  const body = (
    <>
      <span className={styles.rowMain}>
        {left}
        <span className={styles.rowText}>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </span>
        {right}
      </span>
      {children}
    </>
  );
  return onClick
    ? <button type="button" className={clsx(styles.card, styles.row, className)} onClick={onClick}>{body}</button>
    : <div className={clsx(styles.card, styles.row, className)}>{body}</div>;
}

/** Plain glass card. */
export function PhoneCard({ children, className, ...rest }) {
  return <div className={clsx(styles.card, className)} {...rest}>{children}</div>;
}

/** Section heading, 15 px semibold. */
export function PhoneSectionTitle({ children, upper }) {
  return <h2 className={clsx(styles.sectionTitle, upper && styles.sectionUpper)}>{children}</h2>;
}

export const STATUS_TONE = { pending: 'amber', approved: 'success', confirmed: 'success', rejected: 'danger', cancelled: 'danger' };
export const STATUS_TEXT = { pending: 'Pendiente', approved: 'Aprobada', confirmed: 'Confirmada', rejected: 'Rechazada', cancelled: 'Cancelada' };
