import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number from 0 to `target` over `duration` milliseconds.
 * Uses an easeOutCubic curve for a premium feel.
 *
 * @param {number} target   - The final value to count up to
 * @param {number} duration - Animation duration in ms (default 800)
 * @returns {number}        - The current animated count value
 */
export function useCountUp(target, duration = 800) {
  const [count, setCount] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    let startTime = null;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * ease));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}
