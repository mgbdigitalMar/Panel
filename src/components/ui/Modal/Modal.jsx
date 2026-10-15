import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import styles from './Modal.module.scss';
import clsx from 'clsx';

const EASE_OUT = [0.16, 1, 0.3, 1];

export function Modal({ open, onClose, title, children, className }) {
  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
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
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 14, filter: 'blur(8px)' }}
            animate={{
              opacity: 1, scale: 1, y: 0, filter: 'blur(0px)',
              transition: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9, opacity: { duration: 0.2 }, filter: { duration: 0.22 } },
              transitionEnd: { filter: 'none' },
            }}
            exit={{ opacity: 0, scale: 0.97, y: 8, filter: 'blur(4px)', transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
            className={clsx(styles.modal, className)}
          >
            <div className={styles.header}>
              <h2 className={styles.title}>{title}</h2>
              <button onClick={onClose} className={styles.closeBtn} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <div className={styles.content}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
