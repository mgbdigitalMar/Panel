import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import styles from './Modal.module.scss';
import clsx from 'clsx';
import { Portal, useInertApp } from '../Portal/Portal';
import { useMediaQuery, PHONE_QUERY } from '../../../hooks/useMediaQuery';

const EASE_OUT = [0.23, 1, 0.32, 1];

// Computers and tablets: a short rise keeps the dialog connected to the page.
const DIALOG_MOTION = {
  initial: { opacity: 0, transform: 'translateY(18px) scale(0.95)' },
  animate: {
    opacity: 1, transform: 'translateY(0px) scale(1)',
    transition: { duration: 0.28, ease: EASE_OUT },
  },
  exit: { opacity: 0, transform: 'translateY(18px) scale(0.95)', transition: { duration: 0.18, ease: EASE_OUT } },
};

// Phones: a sheet that slides up from the bottom edge, where the thumb is, and leaves the same way
const SHEET_MOTION = {
  initial: { opacity: 0, transform: 'translateY(100%)' },
  animate: { opacity: 1, transform: 'translateY(0%)', transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1], opacity: { duration: 0.15 } } },
  exit: { opacity: 0, transform: 'translateY(100%)', transition: { duration: 0.22, ease: EASE_OUT } },
};

const REDUCED_MOTION = {
  initial: { opacity: 0, transform: 'none' },
  animate: { opacity: 1, transform: 'none', transition: { duration: 0.12 } },
  exit: { opacity: 0, transform: 'none', transition: { duration: 0.1 } },
};

// Open dialogs, newest last: Escape closes only the one on top (a confirm over an edit form)
const openStack = [];

export function Modal({ open, onClose, title, ariaLabel, children, className, bare = false }) {
  // The app behind (sidebar included) can't be clicked, focused or scrolled
  useInertApp(open);

  const sheet = useMediaQuery(PHONE_QUERY);
  const reduce = useReducedMotion();
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
        <div className={clsx(styles.overlay, 'glass-scope')}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reduce ? 0.12 : 0.24, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0.1 : 0.16 } }}
            className={styles.backdrop}
            data-scrim
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || (typeof title === 'string' && title ? title : undefined)}
            {...(reduce ? REDUCED_MOTION : sheet ? SHEET_MOTION : DIALOG_MOTION)}
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
