import { useId } from 'react';
import clsx from 'clsx';
import inputStyles from '../Input/Input.module.scss';

export function Select({ label, value, onChange, options, required, className, loading, disabled, id: idProp, ...props }) {
  // The label names the field (and focuses it when pressed) even when no id is passed
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <div className={clsx(inputStyles.container, className)}>
      {label && (
        <label className={inputStyles.label} htmlFor={id}>
          {label} {required && <span className={inputStyles.asterisk} aria-hidden="true">*</span>}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputStyles.input}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-required={required || undefined}
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
