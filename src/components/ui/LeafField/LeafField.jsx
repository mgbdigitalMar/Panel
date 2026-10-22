import clsx from 'clsx';
import { LEAF_PATH, VEIN_PATH } from '../Loader/Loader';
import styles from './LeafField.module.scss';

// Seeded, so the layout is the same on every visit
function makeLeaves(count, seed) {
  let t = seed;
  const rand = () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => {
    const depth = rand();
    const fall = 46 - depth * 22;
    return {
      x: ((i + rand()) / count) * 100,
      depth,
      size: Math.round(14 + depth * 50),
      fall,
      sway: 5 + rand() * 4,
      flip: 3.2 + rand() * 3.4,
      delay: -rand() * fall,
      turn: Math.round(-40 + rand() * 80),
      opacity: 0.35 + depth * 0.6,
      solid: rand() > 0.35,
      drift: rand() > 0.5 ? 'a' : 'b',
      optional: i % 3 === 1,
    };
  }).sort((a, b) => a.depth - b.depth);
}

const SETS = {
  page: makeLeaves(24, 7),
  panel: makeLeaves(14, 31),
};

/** Margube leaves falling, swaying and turning over. `variant="panel"` fills a dark brand panel. */
export function LeafField({ variant = 'page', className }) {
  const gradient = `mg-leaf-${variant}`;
  return (
    <div className={clsx(styles.field, variant === 'panel' && styles.panel, className)} aria-hidden="true">
      <svg width="0" height="0" className={styles.defs}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" className={styles.stopA} />
            <stop offset="1" className={styles.stopB} />
          </linearGradient>
        </defs>
      </svg>
      {SETS[variant].map((l, i) => (
        <span
          key={i}
          className={clsx(styles.leaf, l.drift === 'b' && styles.driftB, l.optional && styles.optional)}
          style={{
            left: `${l.x}%`,
            animationDuration: `${l.fall}s`,
            animationDelay: `${l.delay}s`,
            '--rest-y': `${Math.round((-l.delay / l.fall) * 100)}%`,
          }}
        >
          <span className={styles.sway} style={{ animationDuration: `${l.sway}s`, animationDelay: `${l.delay}s` }}>
            <span className={styles.flip} style={{ animationDuration: `${l.flip}s`, animationDelay: `${l.delay}s` }}>
              <svg
                width={l.size}
                height={l.size}
                viewBox="0 0 48 48"
                className={styles.mark}
                style={{ opacity: l.opacity, transform: `rotate(${l.turn}deg)` }}
              >
                <path d={LEAF_PATH} fill={l.solid ? `url(#${gradient})` : 'none'} />
                <path d={VEIN_PATH} fill="none" className={styles.vein} />
              </svg>
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
