import clsx from 'clsx';
import styles from './Avatar.module.scss';
import { useMemo, useState } from 'react';

const AVATAR_COLORS = [
  '#6366F1', '#EC4899', '#14B8A6', '#F97316',
  '#8B5CF6', '#EF4444', '#10B981', '#3B82F6'
];

/**
 * Initials on a stable colour, or the person's photo when `src` loads.
 * A broken image falls back to the initials.
 */
export function Avatar({ initials, src, alt = '', size = 36, className }) {
  const [failed, setFailed] = useState(false);
  const bg = useMemo(() => {
    if (!initials) return AVATAR_COLORS[0];
    const code = initials.charCodeAt(0);
    return AVATAR_COLORS[code % AVATAR_COLORS.length];
  }, [initials]);

  const showImage = src && !failed;

  return (
    <div
      className={clsx(styles.avatar, className)}
      style={{
        width: size,
        height: size,
        backgroundColor: showImage ? 'var(--bg-3)' : bg,
        fontSize: size * 0.35,
      }}
    >
      {showImage
        ? <img src={src} alt={alt} className={styles.image} onError={() => setFailed(true)} />
        : initials}
    </div>
  );
}
