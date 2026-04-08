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
  className
}) {
  return (
    <div className={clsx(styles.container, className)}>
      {label && (
        <label className={styles.label}>
          {label} {required && <span className={styles.asterisk}>*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={clsx(styles.input, { [styles.hasError]: !!error })}
      />
      <AnimatePresence>
        {(hint || error) && (
          <motion.p 
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
