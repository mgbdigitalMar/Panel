import { useId } from 'react';
import clsx from 'clsx';
import inputStyles from '../Input/Input.module.scss';

export function Textarea({ label, value, onChange, placeholder, rows = 3, required, className, id: idProp, ...props }) {
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
      <textarea
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-required={required || undefined}
        className={clsx(inputStyles.input)}
        style={{ resize: 'vertical' }}
        {...props}
      />
    </div>
  );
}
