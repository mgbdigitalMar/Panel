import { useEffect, useState } from 'react';

/** True while the media query matches; follows resizes and rotation. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Phones: the width where the glass layout shows the bottom dock (GlassChrome.module.scss). */
export const PHONE_QUERY = '(max-width: 767px)';
