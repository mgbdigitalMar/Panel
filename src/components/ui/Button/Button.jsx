import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import styles from './Button.module.scss';
import { Spinner } from '../Loader/Loader';
import { SPRING } from '../../../motion/tokens';
import { lazy, Suspense } from 'react';

// react-aria (≈200 kB with its date library) loads only for buttons that show a tooltip
const Tip = lazy(() => import('../Tip/Tip').then((m) => ({ default: m.Tip })));

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon: IconComponent,
  disabled,
  loading = false,
  className,
  type = 'button',
  iconOnly = false,
  title,
  ...props
}) {
  const reduceMotion = useReducedMotion();
  const Component = props.href ? motion.a : motion.button;
  const interactive = !disabled && !loading;
  // An icon-only button names itself with aria-label and shows its title in a BoardUI tooltip
  // instead of the browser's native one (which is slow, unstyled and never shows on touch)
  // (only while it can take focus: react-aria needs a focusable trigger; disabled, it keeps the title)
  const tip = iconOnly && title && interactive;

  const button = (
    <Component
      type={props.href ? undefined : type}
      title={tip ? undefined : title}
      whileTap={interactive && !reduceMotion ? { scaleX: 0.96, scaleY: 1.015 } : undefined}
      transition={SPRING.press}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={iconOnly && title ? title : undefined}
      {...props}
      className={clsx(
        styles.button,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        iconOnly && styles.iconOnly,
        loading && styles.isLoading,
        className
      )}
    >
      {/* Icon slot swaps to the spinner with a quick scale-fade */}
      {(loading || IconComponent) && (
        <span className={styles.iconSlot}>
          <AnimatePresence mode="popLayout" initial={false}>
            {loading ? (
              <motion.span
                key="spinner"
                className={styles.iconSwap}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                <Spinner size={16} />
              </motion.span>
            ) : (
              <motion.span
                key="icon"
                className={styles.iconSwap}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                <IconComponent size={16} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      )}

      {children && !iconOnly && <span className={styles.label}>{children}</span>}
    </Component>
  );
  return tip ? <Suspense fallback={button}><Tip label={title}>{button}</Tip></Suspense> : button;
}
