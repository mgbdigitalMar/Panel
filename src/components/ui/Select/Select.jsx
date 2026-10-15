import clsx from 'clsx';
import inputStyles from '../Input/Input.module.scss';

export function Select({ label, value, onChange, options, required, className, loading, disabled, ...props }) {
  return (
    <div className={clsx(inputStyles.container, className)}>
      {label && (
        <label className={inputStyles.label} htmlFor={props.id}>
          {label} {required && <span className={inputStyles.asterisk}>*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputStyles.input}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
