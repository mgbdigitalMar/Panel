import clsx from 'clsx';
import styles from './Input.module.scss';
import { motion, AnimatePresence } from 'framer-motion';

export function Input({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  placeholder, 
  required, 
  disabled, 
  hint,
  error,
  className,
  rightElement,   // ← e.g. an eye-toggle <button>
  autoFocus,
  id,
  ...props
}) {
  return (
    <div className={clsx(styles.container, className)}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label} {required && <span className={styles.asterisk}>*</span>}
        </label>
      )}
      <div className={clsx(styles.inputWrap, { [styles.hasRight]: !!rightElement })}>
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={clsx(styles.input, {
            [styles.hasError]: !!error,
            [styles.withRight]: !!rightElement,
          })}
          {...props}
        />
        {rightElement && (
          <span className={styles.rightElement}>{rightElement}</span>
        )}
      </div>
      <AnimatePresence>
        {(hint || error) && (
          <motion.p 
            id={error ? `${id}-error` : `${id}-hint`}
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -5 }}
            className={clsx(styles.hint, { [styles.hintError]: !!error })}
          >
            {error || hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
