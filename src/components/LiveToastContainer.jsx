import { motion, AnimatePresence } from 'framer-motion';

export function LiveToastContainer({ liveNotifs }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        bottom: 'calc(24px + env(safe-area-inset-bottom))',
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
            layout
            initial={{ opacity: 0, y: 24, scale: 0.94, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            exit={{ opacity: 0, x: 48, scale: 0.96, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.9 }}
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px 16px 10px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: 'var(--shadow-xl), var(--glass-highlight-sm)',
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
