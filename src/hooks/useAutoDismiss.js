import { useEffect } from 'react';

/**
 * Automatically clears `value` (calls `setter('')`) after `delay` ms
 * whenever `value` is a non-empty string.
 *
 * @param {string}   value  - The current message/state value
 * @param {Function} setter - The state setter to call with '' after delay
 * @param {number}   delay  - Delay in ms (default 4000)
 */
export function useAutoDismiss(value, setter, delay = 4000) {
  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => setter(''), delay);
    return () => clearTimeout(timer);
  }, [value, setter, delay]);
}
