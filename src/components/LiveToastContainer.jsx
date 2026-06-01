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
      <AnimatePresence>
        {liveNotifs.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.92 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--glass-border)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: 'var(--radius)',
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: 'var(--shadow-xl)',
              width: 'min(360px, calc(100vw - 48px))',
              pointerEvents: 'all',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{n.icon}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13.5, flex: 1 }}>
              {n.msg}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
