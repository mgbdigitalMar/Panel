/**
 * cn — Class Name utility
 * Wraps clsx for ergonomic conditional class merging
 *
 * Usage:
 *   cn('base', isActive && 'active', { 'error': hasError })
 *   cn(styles.card, { [styles.large]: size === 'lg' })
 */
import clsx from 'clsx';

export const cn = clsx;
export default cn;
