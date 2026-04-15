import clsx from 'clsx';
import { Card } from '../Card/Card';
import styles from './StatCard.module.scss';
import * as Icons from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function StatCard({ label, value, icon, color, sub, trend, trendUp, className }) {
  const IconComponent = Icons[icon] || Icons.HelpCircle;

  return (
    <Card className={clsx(styles.statCard, className)}>
      <div className={styles.topRow}>
        <div
          className={styles.iconWrapper}
          style={{
            backgroundColor: `${color}18`,
            color: color
          }}
        >
          <IconComponent size={22} />
        </div>
        {trend && (
          <span className={clsx(styles.trend, trendUp === false ? styles.trendDown : styles.trendUp)}>
            {trendUp === false
              ? <TrendingDown size={12} />
              : <TrendingUp size={12} />
            }
            {trend}
          </span>
        )}
      </div>
      <div className={styles.content}>
        <p className={styles.value}>{value}</p>
        <p className={styles.label}>{label}</p>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>
    </Card>
  );
}
