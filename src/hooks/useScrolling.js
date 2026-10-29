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
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [idle]);
  return scrolling;
}
