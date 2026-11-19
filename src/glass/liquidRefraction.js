// Chromium can bend the live DOM backdrop with an SVG displacement map. The map is
// sized to the control so the curved rim bends the background and the centre stays flat.
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_FILTERS = 64;
const TARGETS = '[data-liquid], [data-motion-panel]';
const PANES_FROM = '(min-width: 1024px)';
/** Fire on window when a page transition starts: the cards drop to their plain blur until it ends. */
export const LIQUID_PAUSE_EVENT = 'liquid-glass-pause';

/** Chromium (Chrome, Edge, Android browsers on Blink) is the only engine that applies url() filters in backdrop-filter. */
export function supportsLiquidRefraction() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const brands = navigator.userAgentData?.brands;
  if (!brands?.some((b) => /Chromium/i.test(b.brand))) return false;
  return CSS.supports('backdrop-filter', 'url(#a)') || CSS.supports('-webkit-backdrop-filter', 'url(#a)');
}

/**
 * Lens profile for a rounded rectangle. For each pixel inside the rim (the `bezel` px next to the
 * edge) the map stores a displacement towards the centre, strongest at the edge and fading to zero
 * where the flat top of the glass begins: R = horizontal, G = vertical, 128 = no displacement.
 */
function drawMap(w, h, r, bezel) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const cx = w / 2;
  const cy = h / 2;
  const hx = w / 2 - r;
  const hy = h / 2 - r;

  for (let y = 0; y < h; y += 1) {
    const py = y + 0.5 - cy;
    const ay = Math.abs(py) - hy;
    for (let x = 0; x < w; x += 1) {
      const px = x + 0.5 - cx;
      const ax = Math.abs(px) - hx;
      // Signed distance to the rounded rect (negative inside), and the outward normal
      let dist;
      let nx = 0;
      let ny = 0;
      if (ax > 0 && ay > 0) {
        const len = Math.hypot(ax, ay) || 1;
        dist = len - r;
        nx = (ax / len) * Math.sign(px);
        ny = (ay / len) * Math.sign(py);
      } else {
        dist = Math.max(ax, ay) - r;
        if (ax > ay) nx = Math.sign(px);
        else ny = Math.sign(py);
      }
      const inset = -dist; // distance from the edge, inwards
      let dx = 0;
      let dy = 0;
      if (inset >= 0 && inset < bezel) {
        // Steep at the rim, flat where the top of the lens starts
        const t = 1 - inset / bezel;
        const mag = t * t * (3 - 2 * t);
        dx = -nx * mag;
        dy = -ny * mag;
      }
      const i = (y * w + x) * 4;
      data[i] = Math.round(128 + dx * 127);
      data[i + 1] = Math.round(128 + dy * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function buildFilter(id, w, h, map, scale) {
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', String(w));
  filter.setAttribute('height', String(h));
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const image = document.createElementNS(SVG_NS, 'feImage');
  image.setAttribute('href', map);
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', String(w));
  image.setAttribute('height', String(h));
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('result', 'map');
  filter.appendChild(image);

  const displacement = document.createElementNS(SVG_NS, 'feDisplacementMap');
  displacement.setAttribute('in', 'SourceGraphic');
  displacement.setAttribute('in2', 'map');
  displacement.setAttribute('scale', String(scale));
  displacement.setAttribute('xChannelSelector', 'R');
  displacement.setAttribute('yChannelSelector', 'G');
  filter.appendChild(displacement);
  return filter;
}

/**
 * Starts applying refraction to every `[data-liquid]` element, now and as they mount (menus,
 * dialogs, toasts). Returns a stop function that removes every filter and inline style.
 * `finish` is appended after the refraction: a light blur and saturation keep labels readable;
 * `denseFinish` replaces it on `data-liquid="dense"` surfaces.
 */
export function startLiquidRefraction({
  finish = 'blur(5px) saturate(125%)',
  denseFinish = 'blur(20px) saturate(120%)',
  paneFinish = 'blur(10px) saturate(170%)',
  dockFinish = 'blur(6px) saturate(135%)',
  strength = 1,
  only,
} = {}) {
  if (!supportsLiquidRefraction()) return () => {};
  // `only`: refract just these elements (the dock at the softer glass levels), without the cards
  // and without marking the page as «Intenso» (data-liquid on <html>)
  const targets = only || TARGETS;
  const wide = window.matchMedia(PANES_FROM);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);

  const filters = new Map(); // key -> { id, node, users }
  const applied = new Map(); // element -> key
  let seq = 0;

  const release = (key) => {
    const f = filters.get(key);
    if (!f) return;
    f.users -= 1;
    if (f.users <= 0 && filters.size > MAX_FILTERS) {
      f.node.remove();
      filters.delete(key);
    }
  };

  const setFilter = (el, value) => {
    el.style.setProperty('backdrop-filter', value, 'important');
    el.style.setProperty('-webkit-backdrop-filter', value, 'important');
  };

  // While the page scrolls, the cards drop to their plain blur and bend again once it stops. A
  // card's refraction is redrawn on every frame something moves behind it, and a dashboard of
  // fourteen refracting cards scrolled at about 22 fps on an Intel UHD laptop (over 100 with the
  // chrome alone). The chrome keeps refracting: it is what the content scrolls under.
  let scrolling = false;
  let idleTimer = 0;
  const paneValue = (el) => {
    const f = filters.get(applied.get(el));
    return scrolling || !f ? paneFinish : `url(#${f.id}) ${paneFinish}`;
  };

  const clear = (el) => {
    const key = applied.get(el);
    if (key) release(key);
    applied.delete(el);
    el.style.removeProperty('backdrop-filter');
    el.style.removeProperty('-webkit-backdrop-filter');
  };

  // A card (data-motion-panel) that is not chrome: refracted on wide screens only, and never a
  // panel nested in another one (its parent already bends what is behind both)
  const isPane = (el) => !el.hasAttribute('data-liquid');
  const skipPane = (el) => isPane(el) && (!wide.matches || Boolean(el.parentElement?.closest('[data-motion-panel]')));

  const apply = (el) => {
    if (skipPane(el)) { clear(el); return; }
    // Layout size: unaffected by the scale of a menu or dialog that is opening
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w < 8 || h < 8) { clear(el); return; }
    const style = getComputedStyle(el);
    const r = Math.min(parseFloat(style.borderTopLeftRadius) || 0, w / 2, h / 2);
    const bezel = Math.max(6, Math.min(18, Math.min(w, h) * 0.26));
    const scale = Math.round(bezel * 2.2 * strength);
    const key = `${w}x${h}r${Math.round(r)}`;
    if (applied.get(el) === key) return;
    if (applied.has(el)) release(applied.get(el));

    let f = filters.get(key);
    if (!f) {
      seq += 1;
      const id = `lg-refract-${seq}`;
      const node = buildFilter(id, w, h, drawMap(w, h, r, bezel), scale);
      defs.appendChild(node);
      f = { id, node, users: 0 };
      filters.set(key, f);
    }
    f.users += 1;
    applied.set(el, key);
    // data-liquid="dense" (menus, dialogs, toasts: paragraphs of text) keeps a real blur behind the
    // words; the rim still refracts
    // Cards keep a medium blur so charts and text read; the rim bends all the same
    const kind = el.dataset.liquid;
    setFilter(el, isPane(el) ? paneValue(el) : `url(#${f.id}) ${kind === 'dense' ? denseFinish : kind === 'dock' ? dockFinish : finish}`);
  };

  const refreshPanes = () => applied.forEach((_, el) => { if (isPane(el)) setFilter(el, paneValue(el)); });
  const pause = (ms) => {
    if (!scrolling) { scrolling = true; refreshPanes(); }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { scrolling = false; refreshPanes(); }, ms);
  };
  const onScroll = () => pause(160);
  // A page change fades the old cards out and raises the new ones in (about 250 ms + the cascade)
  const onPause = () => pause(700);
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener(LIQUID_PAUSE_EVENT, onPause);

  let pending = new Set();
  let frame = 0;
  const schedule = (el) => {
    pending.add(el);
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        const batch = pending;
        pending = new Set();
        batch.forEach((node) => { if (node.isConnected) apply(node); });
      });
    }
  };

  // ResizeObserver also reports each element once when observation starts; a settling card waits
  const resize = new ResizeObserver((entries) => entries.forEach((e) => { if (!isPane(e.target) || applied.has(e.target)) schedule(e.target); }));
  const tracked = new Set();
  const timers = new Set();
  // A card that has just mounted is rising in with its page (glass-panel-arrive, 280 ms + its
  // stagger): it starts on the plain blur and bends once it has settled, when the browser is idle,
  // so neither the map drawing nor a refraction redrawn on every frame of the rise costs the
  // page change its smoothness.
  const SETTLE_MS = 450;
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
  const track = (el) => {
    if (tracked.has(el)) return;
    tracked.add(el);
    resize.observe(el);
    if (isPane(el)) {
      if (!skipPane(el)) setFilter(el, paneFinish);
      const t = setTimeout(() => { timers.delete(t); idle(() => { if (tracked.has(el)) schedule(el); }, { timeout: 600 }); }, SETTLE_MS);
      timers.add(t);
      return;
    }
    schedule(el);
  };
  const untrack = (el) => {
    tracked.delete(el);
    resize.unobserve(el);
    clear(el);
  };

  const scan = (root) => {
    if (root.nodeType !== 1) return;
    if (root.matches(targets)) track(root);
    root.querySelectorAll?.(targets).forEach(track);
  };
  const scanOut = (root) => {
    if (root.nodeType !== 1) return;
    if (tracked.has(root)) untrack(root);
    root.querySelectorAll?.(targets).forEach((el) => { if (tracked.has(el)) untrack(el); });
  };

  // Crossing 1024 px turns the cards' refraction on or off
  const onWide = () => tracked.forEach((el) => { if (isPane(el)) { if (applied.has(el)) release(applied.get(el)); applied.delete(el); schedule(el); } });
  wide.addEventListener?.('change', onWide);

  const mutations = new MutationObserver((list) => {
    list.forEach((m) => {
      m.addedNodes.forEach(scan);
      m.removedNodes.forEach(scanOut);
    });
  });
  mutations.observe(document.body, { childList: true, subtree: true });
  scan(document.body);
  if (!only || only === '[data-liquid]') document.documentElement.dataset.liquid = 'refract';

  return () => {
    wide.removeEventListener?.('change', onWide);
    document.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener(LIQUID_PAUSE_EVENT, onPause);
    clearTimeout(idleTimer);
    timers.forEach(clearTimeout);
    mutations.disconnect();
    resize.disconnect();
    if (frame) cancelAnimationFrame(frame);
    [...tracked].forEach(clear);
    svg.remove();
    if (!only || only === '[data-liquid]') delete document.documentElement.dataset.liquid;
  };
}
