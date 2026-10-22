import clsx from 'clsx';
import { motion } from 'framer-motion';
import styles from './Loader.module.scss';

/* Leaf geometry — traced from the Margube mark (48×48 box) */
export const LEAF_PATH = 'M9.5 39.5C9.5 22 14.5 10 25 9.2L39.5 8.8V24C39.5 34 33 39.5 24 39.5Z';
export const VEIN_PATH = 'M10.5 38.5C12.5 31 16.5 26.8 22 24';

/**
 * LeafMark — the Margube leaf drawing itself inside the brand tile.
 * Loops draw → fill → sheen while `animate` is on.
 */
export function LeafMark({ size = 56, animate = true, className }) {
  return (
    <span
      className={clsx(styles.mark, animate && styles.markAnimate, className)}
      style={{ '--mark-size': `${size}px` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <rect className={styles.tile} x="0" y="0" width="48" height="48" rx="12" />
        <path className={styles.leafFill} d={LEAF_PATH} />
        <path className={styles.leafStroke} d={LEAF_PATH} pathLength="1" />
        <path className={styles.vein} d={VEIN_PATH} pathLength="1" />
      </svg>
      <span className={styles.sheen} />
    </span>
  );
}

/** Full-screen loader while the session is restored. */
export function BootLoader({ label = 'Cargando sesión…' }) {
  return (
    <motion.div
      className={styles.boot}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(6px)' }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <LeafMark size={64} />
      <div className={styles.bootTrack} aria-hidden="true">
        <span className={styles.bootBar} />
      </div>
      <p className={styles.bootLabel}>{label}</p>
    </motion.div>
  );
}

/**
 * Spinner — a single arc that stretches and contracts while it turns.
 * Inherits currentColor so it works inside any button variant.
 */
export function Spinner({ size = 16, className, label }) {
  return (
    <span
      className={clsx(styles.spinner, className)}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <circle className={styles.spinnerTrack} cx="12" cy="12" r="9.5" />
        <circle className={styles.spinnerArc} cx="12" cy="12" r="9.5" pathLength="100" />
      </svg>
    </span>
  );
}

/** Indeterminate hairline pinned to the top of its container. */
export function TopProgress({ active, className }) {
  return (
    <div
      className={clsx(styles.topProgress, active && styles.topProgressActive, className)}
      role="progressbar"
      aria-hidden={!active}
      aria-label="Cargando"
      aria-busy={active}
    >
      <span className={styles.topProgressBar} />
    </div>
  );
}

/**
 * PageLoader — in-shell placeholder shaped like a typical page:
 * heading, a row of summary tiles, and two content panels.
 */
export function PageLoader({ label = 'Cargando contenido…' }) {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <span className={styles.srOnly}>{label}</span>
      <div className={styles.pageHead} aria-hidden="true">
        <span className={clsx(styles.block, styles.blockTitle)} />
        <span className={clsx(styles.block, styles.blockSub)} />
      </div>
      <div className={styles.pageTiles} aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className={clsx(styles.block, styles.pageTile)} style={{ '--i': i }} />
        ))}
      </div>
      <div className={styles.pagePanels} aria-hidden="true">
        <span className={clsx(styles.block, styles.panel)} style={{ '--i': 4 }} />
        <span className={clsx(styles.block, styles.panel)} style={{ '--i': 5 }} />
      </div>
    </div>
  );
}
