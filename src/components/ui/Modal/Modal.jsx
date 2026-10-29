import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import styles from './Modal.module.scss';
import clsx from 'clsx';
import { Portal, useInertApp } from '../Portal/Portal';

const EASE_OUT = [0.16, 1, 0.3, 1];

// Open dialogs, newest last: Escape closes only the one on top (a confirm over an edit form)
const openStack = [];

export function Modal({ open, onClose, title, ariaLabel, children, className, bare = false }) {
  // The app behind (sidebar included) can't be clicked, focused or scrolled
  useInertApp(open);

  const panelRef = useRef(null);
  const tokenRef = useRef(null);
  if (!tokenRef.current) tokenRef.current = {};

  // Focus moves into the dialog when it opens and back to what opened it when it closes:
  // with the app inert behind, keyboard and screen-reader users were left nowhere.
  // The panel itself takes focus (not the first field), so phones don't pop the keyboard.
  useEffect(() => {
    if (!open) return undefined;
    const token = tokenRef.current;
    openStack.push(token);
    const opener = document.activeElement;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      const i = openStack.indexOf(token);
      if (i !== -1) openStack.splice(i, 1);
      // After useInertApp's cleanup (declared first), so the opener is focusable again
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open]);

  // Escape closes the dialog on top
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape' || openStack[openStack.length - 1] !== tokenRef.current) return;
      onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <div className={styles.overlay}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.24, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            className={styles.backdrop}
            data-scrim
            onClick={onClose}
          />
          {/* Panel rises out of focus: blur + scale settle on a spring */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || (typeof title === 'string' && title ? title : undefined)}
            initial={{ opacity: 0, scale: 0.96, y: 14, filter: 'blur(8px)' }}
            animate={{
              opacity: 1, scale: 1, y: 0, filter: 'blur(0px)',
              transition: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9, opacity: { duration: 0.2 }, filter: { duration: 0.22 } },
              transitionEnd: { filter: 'none' },
            }}
            exit={{ opacity: 0, scale: 0.97, y: 8, filter: 'blur(4px)', transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
            className={clsx(styles.modal, className)}
          >
            {/* `bare`: the content brings its own title and buttons (the liquid confirmations) */}
            {!bare && (
              <div className={styles.header}>
                {/* No empty heading when the content brings its own title */}
                {title ? <h2 className={styles.title}>{title}</h2> : <span aria-hidden="true" />}
                <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Cerrar">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            )}
            <div className={bare ? undefined : styles.content}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </Portal>
  );
}
