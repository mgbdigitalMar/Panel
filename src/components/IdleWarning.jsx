import { motion, AnimatePresence } from 'framer-motion';
import { TimerReset } from 'lucide-react';
import { useIdle } from '../context';
import { Portal } from './ui';
import styles from './IdleWarning.module.scss';

/**
 * Announces the idle logout before it happens, so a half-written form is not lost by surprise.
 * Any activity (moving the mouse, a key, a tap) also keeps the session; the button says so.
 * Not modal: the person can keep working, which is exactly what dismisses it.
 */
export function IdleWarning() {
  const { secondsLeft, stayActive } = useIdle();
  const open = secondsLeft != null;

  // On <body>: an open dialog makes the app inert, and the button must stay reachable
  return (
    <Portal>
    <div className={styles.anchor}>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          >
            <span className={styles.count} aria-hidden="true">{secondsLeft}</span>
            {/* Read once when it appears; the countdown itself is not re-announced every second.
                Focus is not moved here: the next key pressed in a field must not be lost. */}
            <div className={styles.text} role="alert">
              <strong>Tu sesión se cerrará en unos segundos</strong>
              <span>
                Por seguridad se cierra tras un minuto sin actividad. Mueve el ratón o pulsa una tecla para seguir; lo que no hayas guardado se perdería.
              </span>
            </div>
            <button type="button" className={styles.stay} onClick={stayActive}>
              <TimerReset size={16} aria-hidden="true" />
              Seguir conectado
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </Portal>
  );
}
