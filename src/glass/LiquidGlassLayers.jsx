import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import LiquidGlass from 'liquid-glass-react';
import { LIQUID_PAUSE_EVENT } from './liquidRefraction';

/**
 * liquid-glass-react on every glass surface of the web, as a layer underneath each one.
 *
 * The package draws a floating glass (its own displacement filter, blur and rims) centred on a
 * point. Here each surface — the chrome marked [data-liquid] (header buttons, dock, rail…) and the
 * cards marked [data-motion-panel] — gets one, sized to it and placed inside it at z-index -1:
 * text and icons stay on top, and the surface keeps its own tint and border, which the layer
 * blurs and bends along with the page behind. Menus, dialogs and toasts (data-liquid="dense")
 * keep the plain frosted glass: paragraphs need a calm background.
 *
 * Chromium only (ThemeProvider decides): Safari and Firefox do not draw the package's
 * displacement, and keep the WebGL glass (Wallpaper.jsx). The glass level in Ajustes sets the
 * parameters (PARAMS); «Sin efecto» does not load this file at all.
 *
 * Static on purpose (no elasticity, no mouse tracking): a layer that leans towards the pointer
 * slides off its surface's edge and shows a patch of page beside it.
 *
 * While the page scrolls or changes section the bending pauses (html[data-lg-paused], global.scss)
 * and only the blur stays: the package's displacement filter is redrawn on every frame something
 * moves behind it, and with it on, a phone-sized dashboard scrolled at ~11 fps instead of ~140
 * (Chrome, 4× CPU throttling).
 */

// <html data-liquid="refract"> only tunes the tints (ThemeProvider): it is not a surface
const CONTROLS = ':not(html)[data-liquid]:not([data-liquid="dense"])';
const PANES = '[data-motion-panel]';
const TARGETS = `${CONTROLS}, ${PANES}`;
// A surface inside one of these is already behind glass (or must stay calm): no lens in a lens
const INSIDE_GLASS = `${TARGETS}, :not(html)[data-liquid="dense"]`;

/** One entry per glass level of Ajustes (blurAmount → blur of 4 + 32 × amount px) */
export const LIQUID_GLASS_PARAMS = {
  soft: { displacementScale: 30, blurAmount: 0.45, saturation: 125, aberrationIntensity: 0 },
  normal: { displacementScale: 55, blurAmount: 0.65, saturation: 145, aberrationIntensity: 1 },
  strong: { displacementScale: 85, blurAmount: 0.85, saturation: 165, aberrationIntensity: 2 },
};

const STILL = { x: 0, y: 0 };

// A stable key per surface, so a layer stays with its element when others come and go
const ids = new WeakMap();
let seq = 0;
const idOf = (el) => {
  if (!ids.has(el)) ids.set(el, ++seq);
  return ids.get(el);
};

function radiusOf(el, w, h) {
  const value = getComputedStyle(el).borderTopLeftRadius;
  const n = parseFloat(value) || 0;
  return Math.min(value.endsWith('%') ? (Math.min(w, h) * n) / 100 : n, w / 2, h / 2);
}

function Layer({ el, kind, params }) {
  const [host] = useState(() => {
    const span = document.createElement('span');
    span.className = 'lg-host';
    span.setAttribute('aria-hidden', 'true');
    return span;
  });
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    el.dataset.lg = kind;
    // The layer is placed against the surface: a static one becomes its containing block
    const madeRelative = getComputedStyle(el).position === 'static';
    if (madeRelative) el.style.position = 'relative';
    el.appendChild(host);
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h, r: radiusOf(el, w, h) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      host.remove();
      delete el.dataset.lg;
      if (madeRelative) el.style.position = '';
    };
  }, [el, kind, host]);

  if (!box || box.w < 8 || box.h < 8) return null;
  return createPortal(
    // Re-created when the surface changes size: the package measures itself only on mount
    <LiquidGlass
      key={`${box.w}x${box.h}`}
      {...params}
      elasticity={0}
      cornerRadius={box.r}
      padding="0"
      globalMousePos={STILL}
      mouseOffset={STILL}
      style={{ position: 'absolute', top: '50%', left: '50%' }}
    >
      <span style={{ display: 'block', width: box.w, height: box.h }} />
    </LiquidGlass>,
    host,
  );
}

/** The glass surfaces on the page now, outermost only */
function collect() {
  const found = [];
  for (const el of document.querySelectorAll(TARGETS)) {
    if (el.closest('.lg-host')) continue;
    if (el.parentElement?.closest(INSIDE_GLASS)) continue;
    found.push({ el, kind: el.matches(PANES) && !el.matches(CONTROLS) ? 'pane' : 'control' });
  }
  return found;
}

export default function LiquidGlassLayers({ intensity }) {
  const [targets, setTargets] = useState([]);

  useEffect(() => {
    let frame = 0;
    const rescan = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const next = collect();
        setTargets((prev) => (prev.length === next.length && prev.every((t, i) => t.el === next[i].el && t.kind === next[i].kind) ? prev : next));
      });
    };
    rescan();
    const mutations = new MutationObserver((list) => {
      // The layers' own nodes coming and going are not a change of the page
      if (list.every((m) => [...m.addedNodes, ...m.removedNodes].every((n) => n.nodeType === 1 && (n.classList?.contains('lg-host') || n.closest?.('.lg-host'))) && m.type === 'childList')) return;
      rescan();
    });
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-liquid', 'data-motion-panel'] });
    const root = document.documentElement;
    root.dataset.lgEngine = 'react';

    let idle = 0;
    const pause = (ms) => {
      if (!('lgPaused' in root.dataset)) root.dataset.lgPaused = '';
      clearTimeout(idle);
      idle = setTimeout(() => { delete root.dataset.lgPaused; }, ms);
    };
    const onScroll = () => pause(160);
    // A section change fades the old page out and raises the new one (Layout.jsx)
    const onPause = () => pause(700);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener(LIQUID_PAUSE_EVENT, onPause);

    return () => {
      mutations.disconnect();
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener(LIQUID_PAUSE_EVENT, onPause);
      clearTimeout(idle);
      delete root.dataset.lgEngine;
      delete root.dataset.lgPaused;
    };
  }, []);

  const params = LIQUID_GLASS_PARAMS[intensity] || LIQUID_GLASS_PARAMS.normal;
  return targets.map(({ el, kind }) => <Layer key={`${idOf(el)}:${kind}`} el={el} kind={kind} params={params} />);
}
