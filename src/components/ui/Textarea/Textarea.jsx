import clsx from 'clsx';
import inputStyles from '../Input/Input.module.scss';

export function Textarea({ label, value, onChange, placeholder, rows = 3, required, className }) {
  return (
    <div className={clsx(inputStyles.container, className)}>
      {label && (
        <label className={inputStyles.label}>
          {label} {required && <span className={inputStyles.asterisk}>*</span>}
        </label>
      )}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={clsx(inputStyles.input)}
        style={{ resize: 'vertical' }}
      />
    </div>
  );
}
