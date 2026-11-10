import { useLayoutEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

const EASE_OUT = [0.23, 1, 0.32, 1];

function format(v, decimals, signed) {
  const n = Number(v) || 0;
  return `${signed && n > 0 ? '+' : ''}${n.toLocaleString('es-ES', { maximumFractionDigits: decimals })}`;
}

/**
 * A figure that counts to its real value: from zero the first time it shows, and from the value it
 * had when the data changes (never from zero again). It writes to its own text node, so the page
 * does not re-render on every frame. Screen readers get the final value at once; with "reduce
 * motion" the figure simply appears.
 */
export function AnimatedNumber({ value, decimals = 0, signed = false, duration = 0.7, className }) {
  const ref = useRef(null);
  const shown = useRef(0);
  const reduce = useReducedMotion();
  const target = Number(value) || 0;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (reduce || shown.current === target) {
      shown.current = target;
      node.textContent = format(target, decimals, signed);
      return undefined;
    }
    const step = 10 ** decimals;
    node.textContent = format(shown.current, decimals, signed);
    const controls = animate(shown.current, target, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        shown.current = v;
        node.textContent = format(Math.round(v * step) / step, decimals, signed);
      },
      onComplete: () => { shown.current = target; },
    });
    return () => controls.stop();
  }, [target, decimals, signed, duration, reduce]);

  const label = format(target, decimals, signed);
  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">{label}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
