import { useEffect, useRef, useState } from 'react';

/**
 * useScrollReveal — Scroll-triggered reveal animation hook
 * Uses IntersectionObserver for performance (no scroll event listeners)
 *
 * @param {Object} options - IntersectionObserver options
 * @param {number} options.threshold - 0-1, how much of element must be visible (default 0.1)
 * @param {string} options.rootMargin - CSS margin string (default '-40px')
 * @param {boolean} options.once - Only trigger once (default true)
 * @returns {{ ref, isVisible }} - ref to attach to element, isVisible boolean
 */
export function useScrollReveal({
  threshold  = 0.12,
  rootMargin = '-40px',
  once       = true,
} = {}) {
  const ref       = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}

/**
 * useScrollRevealList — Returns refs + isVisible for a list of elements
 * Each item gets its own observer with a stagger delay
 *
 * @param {number} count - Number of items to observe
 * @param {Object} options - Same options as useScrollReveal
 */
export function useScrollRevealList(count, options = {}) {
  const refs = useRef([]);
  const [visibleItems, setVisibleItems] = useState(() => new Array(count).fill(false));

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleItems(new Array(count).fill(true));
      return;
    }

    const observers = refs.current.map((el, i) => {
      if (!el) return null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              setVisibleItems(prev => {
                const next = [...prev];
                next[i] = true;
                return next;
              });
            }, i * 60); // 60ms stagger per item
            observer.disconnect();
          }
        },
        { threshold: options.threshold ?? 0.1, rootMargin: options.rootMargin ?? '-20px' }
      );
      observer.observe(el);
      return observer;
    });

    return () => observers.forEach(o => o?.disconnect());
  }, [count, options.threshold, options.rootMargin]);

  return {
    getRef: (i) => (el) => { refs.current[i] = el; },
    visibleItems,
  };
}
