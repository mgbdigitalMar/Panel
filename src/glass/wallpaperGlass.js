/**
 * Liquid Glass in every browser: a transparent WebGL canvas behind the shell (Wallpaper.jsx) that samples
 * the room and draws only under the glass panes like a thick lens. The
 * DOM panes stay where they are, above it, with their own tint; what shows through them is the
 * refracted room drawn here.
 *
 * Which elements: the cards (`data-motion-panel`, wide screens only, like liquidRefraction.js) when
 * `panes` is set, and the chrome matched by the `chrome` selector (browsers without the SVG
 * refraction). At most MAX_GLASS_SHAPES at once: the chrome first, then the cards on screen.
 *
 * Cost: one full-screen draw, and only while something moves. Positions are measured on scroll,
 * resize, DOM changes and running animations, then the loop goes idle.
 */
import { GlassScene, MAX_GLASS_SHAPES, PRESETS } from './liquid-glass-renderer';
import { LIQUID_PAUSE_EVENT } from './liquidRefraction';

const PANES = '[data-motion-panel]';
const PANES_FROM = '(min-width: 1024px)';
const IDLE_MS = 700;
const MAX_SOURCE_SIDE = 2560;

import { supportsWebGLGlass } from './webglSupport';

export { supportsWebGLGlass };

/** The room as Wallpaper.module.scss paints it: .photo filter and .veilPhoto, per theme and width. */
function roomLook(dark) {
  const phone = matchMedia('(max-width: 767px)').matches;
  const narrow = matchMedia('(max-width: 1023px)').matches;
  if (phone) {
    return dark
      ? { filter: 'blur(2px) brightness(0.7) contrast(0.86) saturate(1.08)', veil: ['rgba(17,24,34,0.78)', 'rgba(17,24,34,0.66)', 'rgba(11,15,22,0.62)'] }
      : { filter: 'blur(2px) brightness(1.08) contrast(0.78) saturate(1.02)', veil: ['rgba(237,242,245,0.82)', 'rgba(237,242,245,0.62)', 'rgba(237,242,245,0.5)'] };
  }
  const veil = dark
    ? ['rgba(9,10,16,0.72)', 'rgba(9,10,16,0.46)', 'rgba(9,10,16,0.4)']
    : ['rgba(240,243,250,0.9)', 'rgba(240,243,250,0.7)', 'rgba(240,243,250,0.64)'];
  const blur = narrow ? 'blur(22px) ' : '';
  return dark
    ? { filter: `${blur}brightness(${narrow ? 0.6 : 0.62}) contrast(0.86) saturate(${narrow ? 1.12 : 1.1})`, veil }
    : { filter: `${blur}brightness(1.14) contrast(0.72) saturate(${narrow ? 1.05 : 1.02})`, veil };
}

/** Paints photo + veil at the canvas size, so the shader's cover fit maps it one to one. */
function paintRoom(photo, width, height, dark) {
  const scale = Math.min(window.devicePixelRatio || 1, MAX_SOURCE_SIDE / Math.max(width, height, 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const { filter, veil } = roomLook(dark);

  // .photo: inset -24px, background-size cover, centred. Filter lengths are in canvas pixels.
  const pad = 24 * scale;
  const boxW = w + pad * 2;
  const boxH = h + pad * 2;
  const fit = Math.max(boxW / photo.naturalWidth, boxH / photo.naturalHeight);
  const dw = photo.naturalWidth * fit;
  const dh = photo.naturalHeight * fit;
  ctx.filter = filter.replace(/blur\((\d+(?:\.\d+)?)px\)/, (_, px) => `blur(${px * scale}px)`);
  ctx.drawImage(photo, -pad + (boxW - dw) / 2, -pad + (boxH - dh) / 2, dw, dh);
  ctx.filter = 'none';

  // .veilPhoto: three stops, the middle one 240px from the top
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, veil[0]);
  gradient.addColorStop(Math.min(1, (240 * scale) / h), veil[1]);
  gradient.addColorStop(1, veil[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

function radiusOf(el, width, height) {
  const value = getComputedStyle(el).borderTopLeftRadius;
  const n = parseFloat(value) || 0;
  return value.endsWith('%') ? (Math.min(width, height) * n) / 100 : n;
}

/**
 * Starts the canvas inside `host`. Returns a stop function that removes it; the DOM room under it
 * shows again. Does nothing (and returns a no-op) without WebGL2 or with nothing to put glass on.
 */
export function startWallpaperGlass({ host, photo, theme, panes = false, chrome = null }) {
  if (!host || !photo?.naturalWidth || (!panes && !chrome) || !supportsWebGLGlass()) return () => {};
  const dark = theme === 'dark';

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block',
    opacity: '0', transition: 'opacity 0.3s ease',
  });
  host.appendChild(canvas);

  const scene = new GlassScene(canvas, {
    ...PRESETS.apple,
    appearance: dark ? 'dark' : 'light',
    // Keep the DOM wallpaper unchanged; only draw inside the glass surfaces.
    surfaceOnly: true,
    blur: 4,
    shadow: 0.18,
    // «Intenso» (panes): no specular rim. Under every card it read as a bright outline; the cards
    // keep the same CSS edge as at «Normal»
    ...(panes ? { specular: 0 } : {}),
    merge: 0,
  });
  // The shader links in the background (GlassScene.ready): the DOM room shows until it is done
  if (!scene.available && !scene.pending) {
    canvas.remove();
    return () => {};
  }

  const wide = matchMedia(PANES_FROM);
  let stopped = false;
  let frame = 0;
  let idleUntil = 0;
  let last = null;
  let shown = false;
  let candidates = [];
  const radii = new WeakMap();

  // Which elements may carry glass: rescanned when the DOM changes, measured every active frame
  const scan = () => {
    const list = chrome ? [...document.querySelectorAll(chrome)] : [];
    if (panes && wide.matches) {
      for (const el of document.querySelectorAll(PANES)) {
        // A card inside chrome (a dialog) or inside another card would be a lens within a lens
        if (chrome && el.closest('[data-liquid]')) continue;
        if (el.parentElement?.closest(PANES)) continue;
        list.push(el);
      }
    }
    candidates = list;
  };

  const measure = (origin) => {
    const shapes = [];
    for (const el of candidates) {
      if (shapes.length >= MAX_GLASS_SHAPES) break;
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
      let cached = radii.get(el);
      if (cached?.key !== key) {
        cached = { key, radius: radiusOf(el, r.width, r.height) };
        radii.set(el, cached);
      }
      shapes.push({
        x: r.left - origin.left + r.width / 2,
        y: r.top - origin.top + r.height / 2,
        width: r.width,
        height: r.height,
        radius: cached.radius,
      });
    }
    return shapes;
  };

  const tick = (now) => {
    frame = 0;
    if (stopped || !scene.available || !scene.source) return;
    const shapes = measure(canvas.getBoundingClientRect());
    const sig = shapes.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)},${s.width.toFixed(1)},${s.height.toFixed(1)},${s.radius}`).join('|');
    if (sig !== last) {
      last = sig;
      scene.setShapes(shapes);
      scene.render();
      idleUntil = Math.max(idleUntil, now + IDLE_MS);
      if (!shown) { shown = true; canvas.style.opacity = '1'; }
    }
    if (now < idleUntil && !document.hidden) frame = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (stopped) return;
    idleUntil = Math.max(idleUntil, performance.now() + IDLE_MS);
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  };

  let resizeTimer = 0;
  const setRoom = () => {
    if (!scene.available) return;
    const box = canvas.getBoundingClientRect();
    scene.setSource(paintRoom(photo, box.width || innerWidth, box.height || innerHeight, dark));
    last = null; // force a redraw with the new texture
    wake();
  };
  const onResize = () => {
    wake();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setRoom, 120);
  };
  const onWide = () => { scan(); last = null; wake(); };
  const onLost = () => stop();

  // Rescan only when the set of glass elements can have changed: nodes added or removed, or the
  // attributes that make something glass. Class and style changes (Framer Motion writes `style`
  // on every frame of every animation) only wake the loop: it measures the elements it already
  // has, instead of walking the whole document once per frame.
  const RESCAN = new Set(['hidden', 'open', 'data-liquid', 'data-motion-panel']);
  const mutations = new MutationObserver((list) => {
    if (list.some((m) => m.type === 'childList' || RESCAN.has(m.attributeName))) scan();
    wake();
  });
  mutations.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'open', 'data-liquid', 'data-motion-panel'],
  });
  const opts = { capture: true, passive: true };
  document.addEventListener('scroll', wake, opts);
  document.addEventListener('transitionrun', wake, opts);
  document.addEventListener('animationstart', wake, opts);
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('resize', onResize);
  window.addEventListener(LIQUID_PAUSE_EVENT, wake);
  wide.addEventListener?.('change', onWide);
  canvas.addEventListener('glassfallback', onLost);

  scan();
  scene.ready.then((ok) => {
    if (stopped) return;
    if (ok) setRoom();
    else stop();
  });

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(resizeTimer);
    mutations.disconnect();
    document.removeEventListener('scroll', wake, opts);
    document.removeEventListener('transitionrun', wake, opts);
    document.removeEventListener('animationstart', wake, opts);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('resize', onResize);
    window.removeEventListener(LIQUID_PAUSE_EVENT, wake);
    wide.removeEventListener?.('change', onWide);
    canvas.removeEventListener('glassfallback', onLost);
    const gl = scene.gl;
    scene.destroy();
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  }
  return stop;
}
