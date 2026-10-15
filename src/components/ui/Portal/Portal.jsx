import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Mounts overlays (modals, viewers) on <body>, outside the app shell.
 * Inside the shell they inherit its stacking contexts, so the sidebar
 * could paint above them and stay clickable.
 */
export function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

// Several overlays can be open at once (a confirm on top of an edit form)
let openOverlays = 0;

/**
 * While `active`, the app behind the overlay is inert: no clicks, no
 * keyboard focus, hidden from screen readers. Overlays live in a Portal,
 * so they stay interactive.
 */
export function useInertApp(active) {
  useEffect(() => {
    if (!active) return undefined;
    const roots = () => document.querySelectorAll('#root');
    openOverlays += 1;
    roots().forEach(el => el.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';
    return () => {
      openOverlays -= 1;
      if (openOverlays === 0) {
        roots().forEach(el => el.removeAttribute('inert'));
        document.body.style.overflow = '';
      }
    };
  }, [active]);
}
