import { useEffect, useState } from 'react';

/**
 * Recharts on demand. The library and its d3 dependencies weigh about 340 kB; imported statically,
 * every page that shows a chart waited for all of it before painting anything. Here the page paints
 * its text and cards at once and the chart joins as soon as the library arrives (its box keeps its
 * height in CSS, so nothing shifts). The module is shared: once loaded, later charts render at once.
 *
 *   <Recharts>{({ ResponsiveContainer, BarChart, Bar }) => (...)}</Recharts>
 */
let loaded = null;
let loading = null;
const load = () => {
  if (!loading) loading = import('recharts').then((m) => { loaded = m; return m; });
  return loading;
};

export function Recharts({ children, fallback = null }) {
  const [lib, setLib] = useState(loaded);
  useEffect(() => {
    if (lib) return undefined;
    let alive = true;
    load().then((m) => { if (alive) setLib(m); });
    return () => { alive = false; };
  }, [lib]);
  return lib ? children(lib) : fallback;
}
