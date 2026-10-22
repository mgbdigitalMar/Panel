import { useEffect } from 'react';

/** Calls `setter('')` `delay` ms after `value` becomes a non-empty string. */
export function useAutoDismiss(value, setter, delay = 4000) {
  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => setter(''), delay);
    return () => clearTimeout(timer);
  }, [value, setter, delay]);
}
