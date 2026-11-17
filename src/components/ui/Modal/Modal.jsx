import { motion, AnimatePresence, animate, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import styles from './Modal.module.scss';
import clsx from 'clsx';
import { Portal, useInertApp } from '../Portal/Portal';
import { useMediaQuery, PHONE_QUERY } from '../../../hooks/useMediaQuery';

import { DUR, EASE } from '../../../motion/tokens';
import {
  SHEET_DRAG_THRESHOLD, SHEET_SPRING, sheetDragOffset, shouldDismissSheet,
} from '../../../../shared/config/sheet.js';

const EASE_OUT = EASE.out;

// Computers and tablets: a short rise keeps the dialog connected to the page.
const DIALOG_MOTION = {
  initial: { opacity: 0, transform: 'translateY(18px) scale(0.95)' },
  animate: {
    opacity: 1, transform: 'translateY(0px) scale(1)',
    transition: { duration: 0.28, ease: EASE_OUT },
  },
  exit: { opacity: 0, transform: 'translateY(18px) scale(0.95)', transition: { duration: 0.18, ease: EASE_OUT } },
};

// Phones: a sheet that slides up from the bottom edge, where the thumb is, and leaves the same way.
// It moves on springs through the `y` motion value, so a drag on its handle can take it over at any
// point and hand its velocity back to the spring on release (shared/config/sheet.js).
const spring = ({ dampingRatio, duration }) => ({ type: 'spring', bounce: 1 - dampingRatio, visualDuration: duration });

function sheetMotion(reduce, offscreen) {
  if (reduce) {
    return {
      initial: { opacity: 0, y: 0 },
      animate: { opacity: 1, transition: { duration: DUR.reduced } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    };
  }
  return {
    initial: { y: offscreen },
    animate: { y: 0, transition: spring(SHEET_SPRING.open) },
    exit: { y: offscreen, transition: spring(SHEET_SPRING.close) },
  };
}

/** Release velocity in px/s from the last 100 ms of pointer samples; 0 if the finger had stopped */
function releaseVelocity(samples, now) {
  const last = samples[samples.length - 1];
  if (!last || now - last.t > 50) return 0;
  const first = samples.find((sample) => last.t - sample.t <= 100) || last;
  const dt = last.t - first.t;
  return dt > 0 ? ((last.y - first.y) / dt) * 1000 : 0;
}

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

  // Sheet drag: `y` is the sheet's offset from its rest position; the scrim lightens as it goes down
  const y = useMotionValue(0);
  const sheetHeight = useRef(0);
  const dragRef = useRef(null);
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);
  const dim = useTransform(y, (value) => {
    const height = sheetHeight.current || window.innerHeight;
    return String(Math.min(1, Math.max(0, 1 - value / height)));
  });
  const offscreen = typeof window === 'undefined' ? 1000 : window.innerHeight;

  // Pressing the handle or header only arms the drag; it takes over after SHEET_DRAG_THRESHOLD px,
  // so a tap on the close button is still a tap. From then on the sheet follows the finger 1:1,
  // starting from wherever it is on screen (an opening sheet can be caught mid-flight).
  // A press that never became a drag gets no pointerup here when it is released outside the handle,
  // so a new press replaces it; only a drag in progress (a second finger) is left alone.
  const onGrabDown = (event) => {
    if (!sheet || event.button !== 0 || dragRef.current?.active) return;
    dragRef.current = { id: event.pointerId, startY: event.clientY, from: 0, active: false, samples: [] };
  };
  useEffect(() => { if (open) dragRef.current = null; }, [open]);
  const onGrabMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.active) {
      if (Math.abs(event.clientY - drag.startY) < SHEET_DRAG_THRESHOLD) return;
      drag.active = true;
      drag.startY = event.clientY;
      y.stop();
      drag.from = y.get();
      sheetHeight.current = panelRef.current?.offsetHeight || 0;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    }
    y.set(sheetDragOffset(drag.from + event.clientY - drag.startY, sheetHeight.current));
    drag.samples.push({ t: event.timeStamp, y: event.clientY });
    if (drag.samples.length > 8) drag.samples.shift();
  };
  const onGrabEnd = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.active) return;
    const velocity = event.type === 'pointercancel' ? 0 : releaseVelocity(drag.samples, event.timeStamp);
    if (shouldDismissSheet(y.get(), velocity, sheetHeight.current)) {
      // The exit spring starts from here and picks up the drag's velocity from `y`
      onClose?.();
      // A dialog its owner keeps open (a save in progress) comes back instead of staying half down
      window.setTimeout(() => {
        if (openRef.current) animate(y, 0, spring(SHEET_SPRING.settle));
      }, 160);
    } else {
      animate(y, 0, { ...spring(SHEET_SPRING.settle), velocity });
    }
  };
  const grabHandlers = sheet ? {
    onPointerDown: onGrabDown,
    onPointerMove: onGrabMove,
    onPointerUp: onGrabEnd,
    onPointerCancel: onGrabEnd,
  } : {};

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
            style={sheet ? { '--sheet-dim': dim } : undefined}
            data-scrim
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            data-liquid="dense"
            aria-modal="true"
            aria-label={ariaLabel || (typeof title === 'string' && title ? title : undefined)}
            {...(sheet ? sheetMotion(reduce, offscreen) : reduce ? REDUCED_MOTION : DIALOG_MOTION)}
            style={sheet ? { y } : undefined}
            className={clsx(styles.modal, className)}
          >
            {/* Phones: the handle and the header are where the sheet is dragged down from */}
            <div className={clsx(styles.top, sheet && styles.grabZone)} {...grabHandlers}>
              <div className={styles.grabber} aria-hidden="true" />
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
            </div>
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
