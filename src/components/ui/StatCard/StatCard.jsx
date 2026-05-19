import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Card } from '../Card/Card';
import styles from './StatCard.module.scss';
import * as Icons from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

/**
 * StatCard — Premium animated KPI card
 * Features: count-up animation, gradient icon, hover lift, trend badge
 */
export function StatCard({ label, value, icon, color, sub, trend, trendUp, className }) {
  const IconComponent = Icons[icon] || Icons.HelpCircle;

  /* ── Count-up animation ─────────────────────────────────────── */
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);
  const displayRef = useRef(null);

  useEffect(() => {
    // Only animate numeric values
    if (typeof value !== 'number') return;
    const controls = animate(count, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [value, count]);

  return (
    <Card className={clsx(styles.statCard, className)}>
      {/* Top row: icon + trend */}
      <div className={styles.topRow}>
        {/* Icon with color glow */}
        <div
          className={styles.iconWrapper}
          style={{ backgroundColor: `${color}18`, color }}
          aria-hidden="true"
        >
          <IconComponent size={22} strokeWidth={2} />
        </div>

        {/* Trend badge */}
        {trend && (
          <span
            className={clsx(
              styles.trend,
              trendUp === false ? styles.trendDown : styles.trendUp
            )}
            aria-label={`Tendencia: ${trend}`}
          >
            {trendUp === false
              ? <TrendingDown size={11} aria-hidden="true" />
              : <TrendingUp   size={11} aria-hidden="true" />
            }
            {trend}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className={styles.content}>
        {/* Animated number */}
        <p className={styles.value} aria-label={`${label}: ${value}`}>
          {typeof value === 'number'
            ? <motion.span ref={displayRef}>{rounded}</motion.span>
            : value
          }
        </p>
        <p className={styles.label}>{label}</p>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>

      {/* Bottom color accent bar */}
      <div className={styles.accentBar} style={{ background: color }} aria-hidden="true" />
    </Card>
  );
}
