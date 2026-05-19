import { useState, useEffect } from 'react';

/**
 * useBreakpoint — Returns current responsive breakpoint
 * Matches the project's breakpoint system:
 *   xs: 0-374 | sm: 375-479 | md: 480-767 | lg: 768-1023 | xl: 1024-1279 | 2xl: 1280+
 */

const BREAKPOINTS = {
  xs:  0,
  sm:  375,
  md:  480,
  lg:  768,
  xl:  1024,
  '2xl': 1280,
};

function getCurrentBreakpoint(width) {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl)    return 'xl';
  if (width >= BREAKPOINTS.lg)    return 'lg';
  if (width >= BREAKPOINTS.md)    return 'md';
  if (width >= BREAKPOINTS.sm)    return 'sm';
  return 'xs';
}

export function useBreakpoint() {
  const [bp, setBp] = useState(() => getCurrentBreakpoint(window.innerWidth));
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    let raf;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = window.innerWidth;
        setWidth(w);
        setBp(getCurrentBreakpoint(w));
      });
    };

    window.addEventListener('resize', handler, { passive: true });
    return () => {
      window.removeEventListener('resize', handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  return {
    bp,
    width,
    isMobile:  width < BREAKPOINTS.lg,    // < 768px
    isTablet:  width >= BREAKPOINTS.lg && width < BREAKPOINTS.xl, // 768-1023
    isDesktop: width >= BREAKPOINTS.xl,    // >= 1024px
    isXs:      bp === 'xs',
    isSm:      bp === 'sm',
    isMd:      bp === 'md',
    isLg:      bp === 'lg',
    isXl:      bp === 'xl',
    is2xl:     bp === '2xl',
    /** Returns true if current bp is >= the given bp */
    gte: (target) => width >= BREAKPOINTS[target],
    /** Returns true if current bp is <= the given bp */
    lte: (target) => width <  BREAKPOINTS[target],
  };
}
