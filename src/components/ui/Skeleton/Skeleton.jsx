import clsx from 'clsx';
import styles from './Skeleton.module.scss';

/**
 * Skeleton component for loading states
 * Shows shimmer animation while content loads
 */
export function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius)',
  className,
  count = 1,
  circle = false
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={clsx(styles.skeleton, circle && styles.circle, className)}
          style={{
            width: circle ? height : width,
            height,
            borderRadius: circle ? '50%' : borderRadius,
          }}
        />
      ))}
    </>
  );
}

/**
 * SkeletonCard - Quick skeleton for card loading states
 */
export function SkeletonCard({ count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <Skeleton height="200px" borderRadius="var(--radius-lg)" />
          <div className={styles.content}>
            <Skeleton height="18px" width="60%" />
            <Skeleton height="14px" width="80%" count={2} />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * SkeletonTable - Quick skeleton for table loading states
 */
export function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div className={styles.skeletonTable}>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className={styles.skeletonTableRow}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className={styles.skeletonTableCell}>
              <Skeleton height="16px" width="85%" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonText - Quick skeleton for text loading states
 */
export function SkeletonText({ lines = 3, lastLineWidth = '75%' }) {
  return (
    <div className={styles.skeletonText}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="14px"
          width={i === lines - 1 ? lastLineWidth : '100%'}
          className={styles.skeletonLine}
        />
      ))}
    </div>
  );
}
