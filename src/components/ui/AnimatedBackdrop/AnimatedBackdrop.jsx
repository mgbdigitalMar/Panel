import clsx from 'clsx';
import styles from './AnimatedBackdrop.module.scss';

/**
 * AnimatedBackdrop — two drifting brand glows over a breathing dot grid.
 * Pure CSS: radial gradients (no filter: blur), and only transform/opacity
 * animate, so every layer stays on the compositor. Still under reduced motion.
 */
export function AnimatedBackdrop({ className }) {
  return (
    <div className={clsx(styles.backdrop, className)} aria-hidden="true">
      <span className={styles.glowA} />
      <span className={styles.glowB} />
      <span className={styles.dots} />
    </div>
  );
}
