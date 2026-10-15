import { useEffect } from 'react';
import clsx from 'clsx';
import styles from './StatCard.module.scss';
import {
  ArrowUpRight, Building, Calendar, Car, CheckCircle, Clock, HelpCircle, Home, Inbox,
  MapPin, Newspaper, TrendingDown, TrendingUp, Users, XCircle,
} from 'lucide-react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';

// Explicit map: `import * as Icons` pulled the whole icon set into the bundle
const ICONS = { Building, Calendar, Car, CheckCircle, Clock, Home, Inbox, MapPin, Newspaper, TrendingDown, TrendingUp, Users, XCircle };

/**
 * StatCard — compact KPI tile.
 * `icon` takes a lucide component or one of the names above.
 * Pass `onClick` to make the whole tile a button that opens the related page.
 * `trend` is optional and should only ever carry a computed value.
 */
export function StatCard({ label, value, icon, color = 'var(--accent)', sub, trend, trendUp, loading, onClick, actionLabel, className }) {
  const IconComponent = typeof icon === 'string' ? (ICONS[icon] || HelpCircle) : (icon || HelpCircle);
  const reduce = useReducedMotion();

  const count = useMotionValue(typeof value === 'number' ? value : 0);
  const rounded = useTransform(count, v => Math.round(v).toLocaleString('es-ES'));

  useEffect(() => {
    if (typeof value !== 'number') return undefined;
    if (reduce) { count.set(value); return undefined; }
    const controls = animate(count, value, { duration: 0.6, ease: [0.23, 1, 0.32, 1] });
    return () => controls.stop();
  }, [value, count, reduce]);

  const Root = onClick ? 'button' : 'div';

  return (
    <Root
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={onClick ? (actionLabel || `${label}: ${value}. Ver detalle`) : undefined}
      className={clsx(styles.statCard, onClick && styles.interactive, className)}
      style={{ '--stat-color': color }}
    >
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          <IconComponent size={17} strokeWidth={2} />
        </span>
        <span className={styles.label}>{label}</span>
        {onClick && <ArrowUpRight size={16} className={styles.go} aria-hidden="true" />}
      </div>

      {loading ? (
        <>
          <span className="skeleton-line" style={{ width: '45%', height: 30, borderRadius: 6 }} />
          <span className="skeleton-line" style={{ width: '70%', height: 12, borderRadius: 4 }} />
        </>
      ) : (
        <>
          <p className={styles.value} aria-hidden={onClick ? true : undefined}>
            {typeof value === 'number' ? <motion.span>{rounded}</motion.span> : value}
            {trend && (
              <span className={clsx(styles.trend, trendUp === false ? styles.trendDown : styles.trendUp)}>
                {trendUp === false ? <TrendingDown size={12} aria-hidden="true" /> : <TrendingUp size={12} aria-hidden="true" />}
                {trend}
              </span>
            )}
          </p>
          {sub && <p className={styles.sub}>{sub}</p>}
        </>
      )}
    </Root>
  );
}
