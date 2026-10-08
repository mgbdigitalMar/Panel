import clsx from 'clsx';
import styles from './Input.module.scss';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

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
  success,
  className,
  rightElement,   // ← e.g. an eye-toggle <button>
  leftElement,
  autoFocus,
  id,
  showValidationIcon = true,
  ...props
}) {
  const hasValidation = (error || success) && showValidationIcon;
  const shouldShowRightElement = rightElement || hasValidation;

  return (
    <div className={clsx(styles.container, className)}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label} {required && <span className={styles.asterisk}>*</span>}
        </label>
      )}
      <div className={clsx(styles.inputWrap, {
        [styles.hasRight]: shouldShowRightElement,
        [styles.hasLeft]: !!leftElement,
      })}>
        {leftElement && (
          <span className={styles.leftElement}>{leftElement}</span>
        )}
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
            [styles.hasSuccess]: !!success && !error,
            [styles.withRight]: shouldShowRightElement,
            [styles.withLeft]: !!leftElement,
          })}
          {...props}
        />
        {shouldShowRightElement && (
          <span className={styles.rightElement}>
            {rightElement || (
              hasValidation && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={clsx(styles.validationIcon, {
                    [styles.errorIcon]: !!error,
                    [styles.successIcon]: !!success,
                  })}
                >
                  {error ? <X size={18} /> : <Check size={18} />}
                </motion.div>
              )
            )}
          </span>
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
