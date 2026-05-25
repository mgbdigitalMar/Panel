import clsx from 'clsx';
import styles from './Input.module.scss';
import { motion, AnimatePresence } from 'framer-motion';
import { inputShake } from '../../../utils/motion';

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
      <motion.input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={clsx(styles.input, 'glass-input', { [styles.hasError]: !!error })}
        variants={inputShake}
        initial="initial"
        animate={error ? "error" : "initial"}
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
