// Transitions.dev motion for the assistant (CSS in src/styles/_transitions.scss).
import { useEffect, useRef } from 'react';

const cssMs = (name, fallback) => {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
};

/**
 * 28 Thinking states: a shimmering status line that swaps to the next state every --think-hold.
 * Walks the states once and stays on the last (the answer is about to arrive), instead of
 * looping back to the first. The box is built here, outside React's children, as the recipe's
 * orchestration adds and removes the outgoing and incoming lines itself.
 */
export function ThinkingLine({ states }) {
  const box = useRef(null);
  const key = states.join('|');

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    el.textContent = '';
    const sizer = document.createElement('span');
    sizer.className = 't-think-sizer';
    sizer.setAttribute('aria-hidden', 'true');
    sizer.textContent = states.reduce((a, b) => (b.length > a.length ? b : a), '');
    el.appendChild(sizer);
    const line = (text) => {
      const span = document.createElement('span');
      span.className = 't-think-text';
      span.textContent = text;
      span.setAttribute('data-text', text);
      return span;
    };
    let live = el.appendChild(line(states[0]));
    let i = 0;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

    (function cycle() {
      if (i >= states.length - 1) return;
      later(() => {
        const swap = cssMs('--think-swap', 150);
        const gap = cssMs('--think-gap', 50);
        const leaving = live;
        i += 1;
        leaving.classList.add('is-exit');
        const next = line(states[i]);
        next.classList.add('is-enter-start');
        el.appendChild(next);
        live = next;
        const release = () => {
          void next.offsetWidth; // flush the enter-start rest state
          next.classList.remove('is-enter-start');
        };
        if (gap > 0) later(release, gap);
        else release();
        later(() => { leaving.remove(); cycle(); }, swap + gap);
      }, cssMs('--think-hold', 2000));
    })();

    return () => { timers.forEach(clearTimeout); el.textContent = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the states
  }, [key]);

  return <span ref={box} className="t-think" style={{ textAlign: 'left' }} aria-hidden="true" />;
}

/**
 * 30 Streaming text: the words resolve one by one through a soft cross-blur. All the words are
 * in the DOM from the start (screen readers get the whole reply at once); only their opacity and
 * blur animate. --stream-gap per word, but a long reply never takes more than ~1.6 s in all.
 */
export function StreamText({ text, animate }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!animate || !ref.current) return undefined;
    const spans = [...ref.current.querySelectorAll('.t-stream-w')];
    const gap = Math.min(cssMs('--stream-gap', 60), 1600 / Math.max(spans.length, 1));
    let n = 0;
    let timer;
    const next = () => {
      if (n >= spans.length) return;
      spans[n].classList.add('is-in');
      n += 1;
      timer = setTimeout(next, gap);
    };
    next();
    return () => clearTimeout(timer);
  }, [animate]);

  if (!animate) return text;
  // Split on whitespace but keep it (line breaks matter: the bubble is pre-wrap)
  return (
    <span ref={ref}>
      {text.split(/(\s+)/).map((part, i) => (/^\s*$/.test(part) ? part : <span key={i} className="t-stream-w">{part}</span>))}
    </span>
  );
}
