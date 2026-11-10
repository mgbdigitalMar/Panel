import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import styles from './LiveToastContainer.module.scss';

export function LiveToastContainer({ liveNotifs }) {
  const reduce = useReducedMotion();
  return (
    <div
      className="glass-scope"
      aria-live="polite"
      aria-relevant="additions"
      style={{
        position: 'fixed',
        // --toast-bottom: lifted above the glass dock on phones (global.scss)
        bottom: 'calc(var(--toast-bottom, 24px) + env(safe-area-inset-bottom))',
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 'var(--z-toast)',
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 48px)',
      }}
    >
      <AnimatePresence initial={false}>
        {liveNotifs.map(n => (
          <motion.div
            key={n.id}
            className={styles.toast}
            layout={!reduce}
            initial={{ opacity: 0, transform: reduce ? 'none' : 'translateY(16px) scale(0.97)' }}
            animate={{ opacity: 1, transform: reduce ? 'none' : 'translateY(0px) scale(1)' }}
            exit={{ opacity: 0, transform: reduce ? 'none' : 'translateY(16px) scale(0.97)', transition: { duration: reduce ? 0.1 : 0.18 } }}
            transition={{ duration: reduce ? 0.12 : 0.25, ease: [0.23, 1, 0.32, 1] }}
            style={{
              borderRadius: 'var(--radius-lg)',
              padding: '10px 16px 10px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: 'min(360px, calc(100vw - 48px))',
              pointerEvents: 'all',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 36, height: 36, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-bg)',
                fontSize: 18, lineHeight: 1,
              }}
            >
              {n.icon}
            </span>
            <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13.5, flex: 1, lineHeight: 1.4 }}>
              {n.msg}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
