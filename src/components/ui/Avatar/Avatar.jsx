import clsx from 'clsx';
import styles from './Avatar.module.scss';
import { useMemo } from 'react';

const AVATAR_COLORS = [
  '#6366F1', '#EC4899', '#14B8A6', '#F97316', 
  '#8B5CF6', '#EF4444', '#10B981', '#3B82F6'
];

export function Avatar({ initials, size = 36, className }) {
  const bg = useMemo(() => {
    if (!initials) return AVATAR_COLORS[0];
    const code = initials.charCodeAt(0);
    return AVATAR_COLORS[code % AVATAR_COLORS.length];
  }, [initials]);

  return (
    <div 
      className={clsx(styles.avatar, className)} 
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: size * 0.35,
      }}
    >
      {initials}
    </div>
  );
}
