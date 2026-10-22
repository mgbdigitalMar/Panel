import clsx from 'clsx';
import styles from './AnimatedBackdrop.module.scss';

/** Two drifting brand glows over a dot grid. Only transform and opacity animate, so every
 * layer stays on the compositor; still under reduced motion. */
export function AnimatedBackdrop({ className }) {
  return (
    <div className={clsx(styles.backdrop, className)} aria-hidden="true">
      <span className={styles.glowA} />
      <span className={styles.glowB} />
      <span className={styles.dots} />
    </div>
  );
}
