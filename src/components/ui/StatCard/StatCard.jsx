import clsx from 'clsx';
import { Card } from '../Card/Card';
import styles from './StatCard.module.scss';
import * as Icons from 'lucide-react';

export function StatCard({ label, value, icon, color, sub, className }) {
  const IconComponent = Icons[icon] || Icons.HelpCircle;

  return (
    <Card className={clsx(styles.statCard, className)}>
      <div 
        className={styles.iconWrapper} 
        style={{ 
          backgroundColor: `${color}1A`, // 1A is ~10% opacity in hex
          color: color 
        }}
      >
        <IconComponent size={24} />
      </div>
      <div className={styles.content}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>
    </Card>
  );
}
