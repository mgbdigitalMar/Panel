import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * Floating pill that appears when the browser loses the network
 * and confirms briefly when it comes back.
 */
export function ConnectionStatus() {
  const [state, setState] = useState(() => (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'));

  useEffect(() => {
    let timer;
    const goOffline = () => { clearTimeout(timer); setState('offline'); };
    const goOnline = () => {
      setState(prev => (prev === 'offline' ? 'back' : prev));
      timer = setTimeout(() => setState('online'), 2600);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const offline = state === 'offline';

  return (
    <div
      aria-live="assertive"
      style={{ position: 'fixed', top: 'calc(12px + env(safe-area-inset-top))', left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 12px', zIndex: 'var(--z-toast)', pointerEvents: 'none' }}
    >
      <AnimatePresence>
        {state !== 'online' && (
          <motion.div
            key={state}
            role="status"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.16 } }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '9px 16px', borderRadius: 'var(--radius-full)',
              background: offline ? 'var(--warning-bg)' : 'var(--success-bg)',
              color: offline ? 'var(--warning)' : 'var(--success)',
              border: `1px solid rgba(var(${offline ? '--warning-rgb' : '--success-rgb'}), 0.3)`,
              backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
              boxShadow: 'var(--shadow-lg)',
              fontSize: 13, fontWeight: 600, pointerEvents: 'auto',
            }}
          >
            {offline ? <WifiOff size={15} aria-hidden="true" /> : <Wifi size={15} aria-hidden="true" />}
            {offline
              ? 'Sin conexión. Los cambios no se guardarán hasta que vuelva la red.'
              : 'Conexión recuperada'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
