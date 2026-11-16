import { useEffect, useState } from 'react';

/** True while the window is being scrolled; false again `idle` ms after the last scroll event. */
export function useScrolling(idle = 220) {
  const [scrolling, setScrolling] = useState(false);
  useEffect(() => {
    let timer;
    const onScroll = () => {
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), idle);
    };
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      clearTimeout(timer);
    };
  }, [idle]);
  return scrolling;
}
