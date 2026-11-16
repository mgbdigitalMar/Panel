/* Standalone glass light/dark theme toggle: opaque pill track, squircle thumb, pixel moon and sun. MIT. */

const css = `
.glass-theme-toggle {
  --gtt-width: 192px; --gtt-height: 84px; --gtt-thumb: 74px;
  --gtt-inset: 5px; --gtt-radius: 21px; --gtt-travel: calc(var(--gtt-width) - var(--gtt-thumb) - var(--gtt-inset) * 2);
  position: relative; display: block; width: var(--gtt-width); height: var(--gtt-height);
  border: 0; padding: var(--gtt-inset); background: transparent; cursor: pointer;
  touch-action: none; -webkit-tap-highlight-color: transparent;
}
.glass-theme-toggle:active { cursor: grabbing; }
.glass-theme-toggle .theme-track {
  position: absolute; inset: 0; border-radius: calc(var(--gtt-height) * .36);
  background: #e6e4df;
  box-shadow: inset 0 1px 2px rgb(255 255 255 / .65), inset 0 -2px 6px rgb(22 26 36 / .10),
    0 16px 36px rgb(12 16 28 / .22);
}
.glass-theme-toggle[aria-checked="true"] .theme-track {
  background: #16171a;
  box-shadow: inset 0 1px 2px rgb(255 255 255 / .10), inset 0 -2px 8px rgb(0 0 0 / .55),
    0 16px 36px rgb(0 0 0 / .45);
}
.glass-theme-toggle .theme-thumb {
  position: relative; z-index: 1; display: grid; place-items: center;
  width: var(--gtt-thumb); height: var(--gtt-thumb); border-radius: var(--gtt-radius);
  background: rgb(255 255 255 / .58);
  backdrop-filter: blur(18px) saturate(1.6); -webkit-backdrop-filter: blur(18px) saturate(1.6);
  box-shadow: 0 4px 14px rgb(15 20 30 / .28), inset 0 0 0 1px rgb(255 255 255 / .62), inset 0 1px 1px rgb(255 255 255 / .8);
  translate: 0 0; transition: scale 700ms cubic-bezier(.3,.7,.3,1);
}
.glass-theme-toggle:not([data-bare]):active .theme-thumb { scale: .88 1.05; transition: scale 260ms cubic-bezier(.3,.7,.3,1); }
.glass-theme-toggle[aria-checked="true"] .theme-thumb {
  background: rgb(33 36 42 / .92);
  box-shadow: 0 4px 16px rgb(0 0 0 / .5), inset 0 0 0 1px rgb(255 255 255 / .22), inset 0 1px 1px rgb(255 255 255 / .3);
}
.glass-theme-toggle[aria-checked="false"] .theme-thumb { translate: var(--gtt-travel) 0; }
.glass-theme-toggle[data-dragging] .theme-thumb { transition: none; }
.glass-theme-toggle .theme-glow {
  position: absolute; inset: -5px; border-radius: calc(var(--gtt-radius) + 5px);
  border: 5px solid transparent; border-bottom-color: var(--glow-color);
  pointer-events: none;
  filter: blur(1.4px) drop-shadow(0 0 8px var(--glow-color)) drop-shadow(0 0 24px var(--glow-color)) drop-shadow(0 0 58px var(--glow-color));
  rotate: var(--glow-rot, 0deg);
}
.glass-theme-toggle .theme-glow::before {
  content: ""; position: absolute; inset: -1px; border-radius: inherit;
  border: 2px solid transparent; border-bottom-color: rgb(255 255 255 / .85);
  filter: blur(.5px);
}
.glass-theme-toggle .theme-icon {
  grid-area: 1 / 1; width: 44px; height: 44px;
  color: var(--icon-color, #fff3e2);
  filter: drop-shadow(0 0 3px var(--icon-halo, rgb(255 225 190 / .7)));
}
/* The bare variant leaves the glass surfaces to a host scene canvas, but keeps
   the edge shadows: they read over the host backdrop and give the track depth. */
.glass-theme-toggle[data-bare] .theme-track {
  background: transparent;
  box-shadow: inset 0 1px 2px rgb(255 255 255 / .65), inset 0 -2px 6px rgb(22 26 36 / .12),
    0 16px 36px rgb(12 16 28 / .22), 0 4px 12px rgb(12 16 28 / .12);
}
.glass-theme-toggle[data-bare][aria-checked="true"] .theme-track {
  box-shadow: inset 0 1px 2px rgb(255 255 255 / .10), inset 0 -3px 10px rgb(0 0 0 / .45),
    0 16px 36px rgb(0 0 0 / .45), 0 4px 12px rgb(0 0 0 / .3);
}
.glass-theme-toggle[data-bare] .theme-thumb {
  background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none;
  box-shadow: 0 10px 26px rgb(8 12 22 / .32), 0 2px 8px rgb(8 12 22 / .2);
}
@media (prefers-reduced-motion: reduce) {
  .glass-theme-toggle .theme-thumb { transition: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .glass-theme-toggle .theme-thumb { backdrop-filter: none; -webkit-backdrop-filter: none; background: #faf9f6; }
  .glass-theme-toggle[aria-checked="true"] .theme-thumb { background: #21252a; }
}
@supports not (backdrop-filter: blur(1px)) {
  .glass-theme-toggle .theme-thumb { background: #faf9f6; }
  .glass-theme-toggle[aria-checked="true"] .theme-thumb { background: #21252a; }
}
@media (forced-colors: active) {
  .glass-theme-toggle .theme-track { background: Canvas; box-shadow: inset 0 0 0 1px ButtonText; }
  .glass-theme-toggle .theme-thumb { background: ButtonFace; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
  .glass-theme-toggle .theme-glow { display: none; }
  .glass-theme-toggle .theme-icon { color: ButtonText; filter: none; }
}
`;

/* Original pixel art (20x20): dithered crescent moon with a sparkle, rayed sun.
   '#' full pixel, '+' half-lit dither, 'o' bright sparkle. */
const moonBitmap = [
  '....................',
  '..........o...o.....',
  '..............o.....',
  '............ooooo...',
  '......##+.....o.....',
  '....###+......o.....',
  '...####.+.+.....o...',
  '...####+.+..........',
  '..#####.+...........',
  '..#####+............',
  '..#####.+.+.........',
  '..######.+..........',
  '..#######.+.+.......',
  '..#######+.+.+.+....',
  '..#########.+.+.....',
  '...############.....',
  '....##########......',
  '.....########.......',
  '........##..........',
  '....................',
];
const sunBitmap = [
  '....................',
  '....................',
  '.........##.........',
  '...##....##....##...',
  '...##....##....##...',
  '....................',
  '......########......',
  '......########......',
  '......########......',
  '..##..########..##..',
  '..##..########..##..',
  '..##..########..##..',
  '......########......',
  '......########......',
  '....................',
  '...##....##....##...',
  '...##....##....##...',
  '.........##.........',
  '....................',
  '....................',
];

function pixels(rows) {
  return rows.flatMap((row, y) => [...row].flatMap((cell, x) => cell === '.' ? [] : [{
    x: x + .5, y: y + .5, opacity: cell === '+' ? .24 : cell === 'o' ? .63 : 1,
  }])).sort((a, b) => Math.atan2(a.y - 10, a.x - 10) - Math.atan2(b.y - 10, b.x - 10));
}

const mix = (a, b, p) => a + (b - a) * p;
const clampUnit = p => Math.max(0, Math.min(1, p));
const travelTimeScale = 1.85;
const arcResponseMs = 145;
const moonPixels = pixels(moonBitmap);
const sunPixels = pixels(sunBitmap);
const pixelCount = Math.max(moonPixels.length, sunPixels.length);
function distributePixels(icon) {
  const slots = Array(pixelCount).fill(null);
  icon.forEach((pixel, index) => {
    slots[Math.floor(index * pixelCount / icon.length)] = pixel;
  });
  return slots;
}
const moonSlots = distributePixels(moonPixels);
const sunSlots = distributePixels(sunPixels);
const pixelPairs = moonSlots.map((moon, i) => {
  const sun = sunSlots[i];
  const point = moon ?? sun;
  const ghost = { x: mix(10, point.x, .35), y: mix(10, point.y, .35), opacity: 0 };
  return { from: moon ?? ghost, to: sun ?? ghost, delay: ((i * 29) % 97) / 97 * .30 };
});

export function createGlassThemeToggle(target, config = {}) {
  const doc = target.ownerDocument;
  const root = target.getRootNode();
  if (!root.querySelector?.('[data-glass-theme-toggle-style]')) {
    const style = doc.createElement('style');
    style.setAttribute('data-glass-theme-toggle-style', '');
    style.textContent = css;
    (root === doc ? doc.head : root).append(style);
  }
  const scope = config.scope ?? doc.documentElement;
  const storageKey = config.storageKey ?? 'liquid-glass-theme';
  const readStored = () => {
    try { return scope.ownerDocument?.defaultView?.localStorage?.getItem(storageKey); }
    catch { return null; }
  };
  const initial = config.theme ?? (readStored() === 'dark' ? 'dark' : 'light');
  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.className = 'glass-theme-toggle';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(initial === 'dark'));
  if (config.ariaLabel) toggle.setAttribute('aria-label', config.ariaLabel);
  if (config.bare) toggle.dataset.bare = '';
  toggle.innerHTML = `<span class="theme-track" aria-hidden="true"></span>`
    + `<span class="theme-thumb" aria-hidden="true"><span class="theme-glow"></span>`
    + `<svg class="theme-icon" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">`
    + '<rect/>'.repeat(pixelCount) + '</svg></span>';
  const thumb = toggle.querySelector('.theme-thumb');
  const glow = toggle.querySelector('.theme-glow');
  const dots = [...toggle.querySelectorAll('.theme-icon rect')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let theme = initial;
  let gesture;
  let skipPointerClick = false;

  // Follow the pointer during a drag. On release the arc trails the spring
  // and finishes its half turn after the thumb arrives.
  let glowTurns = initial === 'light' ? 1 : 0;
  let sweepTheme = theme;     // theme at the moment the open sweep began
  let arcTurns = glowTurns;
  let arcTime;
  let glowFrame = 0;
  let lastRot = initial === 'light' ? -180 : 0;
  let glowProgressValue = initial === 'light' ? 1 : 0;
  let glowColor;
  let renderedProgress;
  let posX = null;            // live thumb translate X in px, JS-animated
  let springState = null;     // { x, v, target, last } while travelling
  let elasticDy = 0;          // vertical elastic pull while held
  let dragVel = 0;            // drag velocity in px/s, carried into release
  const anchorOf = t => t === 'dark' ? 0 : 1;
  const travel = () => {
    // The toggle may be measured before insertion: never let geometry go NaN.
    if (!toggle.isConnected) return 1;
    const pad = parseFloat(getComputedStyle(toggle).paddingLeft) || 0;
    return Math.max(1, toggle.clientWidth - thumb.offsetWidth - pad * 2);
  };
  const setThumbTranslate = () => {
    thumb.style.translate = posX + 'px ' + elasticDy.toFixed(1) + 'px';
  };

  function liveProgress() {
    if (posX == null) return anchorOf(theme);
    const p = posX / travel();
    return Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : anchorOf(theme);
  }
  function renderColor(p) {
    if (p === renderedProgress) return;
    renderedProgress = p;
    const night = [100, 133, 255];
    const neutral = [255, 212, 219];
    const day = [255, 171, 53];
    const start = p < .5 ? night : neutral;
    const end = p < .5 ? neutral : day;
    const blend = p < .5 ? p * 2 : p * 2 - 1;
    const rgb = start.map((value, i) => Math.round(mix(value, end[i], blend)));
    glowColor = rgb.map(value => value / 255);
    toggle.style.setProperty('--glow-color', `rgb(${rgb.join(' ')} / .95)`);
    const ink = [255, 243, 226].map((value, i) => Math.round(mix(value, [61, 53, 39][i], p)));
    toggle.style.setProperty('--icon-color', `rgb(${ink.join(' ')})`);
    toggle.style.setProperty('--icon-halo', `rgb(255 225 190 / ${mix(.74, .12, p)})`);
    pixelPairs.forEach(({ from, to, delay }, i) => {
      const t = clampUnit((p - delay) / .70);
      const eased = t * t * (3 - 2 * t);
      const swirl = Math.sin(t * Math.PI) * .84;
      const x = mix(from.x, to.x, eased) - 10;
      const y = mix(from.y, to.y, eased) - 10;
      const size = mix(.89, .54, Math.sin(t * Math.PI));
      const dot = dots[i];
      dot.setAttribute('x', (10 + x * Math.cos(swirl) - y * Math.sin(swirl) - size / 2).toFixed(2));
      dot.setAttribute('y', (10 + x * Math.sin(swirl) + y * Math.cos(swirl) - size / 2).toFixed(2));
      dot.setAttribute('width', size.toFixed(2));
      dot.setAttribute('height', size.toFixed(2));
      dot.setAttribute('opacity', mix(from.opacity, to.opacity, eased).toFixed(2));
    });
  }
  function anchorSweep() {
    // Start the next half turn from the committed endpoint, even if the light
    // is still catching up to that endpoint from the previous switch.
    if (theme === sweepTheme) return;
    glowTurns += 1;
    sweepTheme = theme;
  }

  function glowRender(now = performance.now()) {
    if (posX == null && toggle.isConnected) posX = anchorOf(theme) ? travel() : 0;
    const p = liveProgress();
    const targetTurns = glowTurns + Math.abs(p - anchorOf(sweepTheme));
    const elapsed = Math.min(64, now - (arcTime ?? now));
    arcTime = now;
    if (gesture) {
      // A new grab can interrupt the arc before it has caught up with the thumb.
      gesture.arcOffset *= Math.exp(-elapsed / 65);
      arcTurns = reduced.matches ? targetTurns : targetTurns + gesture.arcOffset;
    } else {
      arcTurns = reduced.matches ? targetTurns : mix(arcTurns, targetTurns, 1 - Math.exp(-elapsed / arcResponseMs));
    }
    if (Math.abs(arcTurns - targetTurns) < .006) arcTurns = targetTurns;
    lastRot = -180 * arcTurns;
    glowProgressValue = p;
    glow.style.setProperty('--glow-rot', lastRot.toFixed(2) + 'deg');
    toggle.style.setProperty('--glow-progress', p.toFixed(3));
    renderColor(p);
    config.onGlowFrame?.();
    return arcTurns !== targetTurns;
  }
  // Integrates the travel spring and applies the thumb translate. Called from
  // the host's draw path so the glass shape and the DOM icon share one position
  // per frame; later calls within the same frame are no-ops.
  function advanceTravel(now) {
    if (!springState) return;
    if (now - springState.last < 2) return;
    const dt = Math.min(.034, (now - springState.last) / 1000) / travelTimeScale;
    springState.last = now;
    let { x, v, target } = springState;
    for (let i = 0; i < 3; i++) {
      const h = dt / 3;
      v += (380 * (target - x) - 22 * v) * h;
      x += v * h;
    }
    if (Math.abs(x - target) < .4 && Math.abs(v) < 12) { x = target; v = 0; springState = null; }
    else springState = { x, v, target, last: now };
    posX = x;
    elasticDy *= Math.exp(-dt / .06);
    setThumbTranslate();
  }
  function glowTick() {
    glowFrame = 0;
    const now = performance.now();
    advanceTravel(now);
    const arcMoving = glowRender(now);
    if (gesture || springState || arcMoving) { startGlow(); return; }
    const rest = anchorOf(theme);
    if (Math.abs(liveProgress() - rest) >= .004) {
      // The thumb is still travelling toward its rest position — and if it was
      // ever left stranded mid-track with no spring, send it to the anchor.
      travelTo(rest * travel(), 0, false);
      return;
    }
    anchorSweep();
  }
  function startGlow() {
    if (!glowFrame) glowFrame = requestAnimationFrame(glowTick);
  }

  const apply = next => {
    scope.dataset.theme = next;
  };
  // Spring the thumb to an end. An anticipation kick (initial velocity away from
  // the target) matches the reference's pull-back-then-shoot travel.
  function travelTo(target, v0, anticipate) {
    if (posX == null) posX = anchorOf(theme) ? travel() : 0;
    if (reduced.matches) {
      posX = target;
      springState = null;
      elasticDy = 0;
      setThumbTranslate();
      startGlow();
      return;
    }
    const dir = Math.sign(target - posX) || 1;
    const v = anticipate ? -dir * 750 : v0;
    // Pin the current position inline BEFORE the theme class flips, or the
    // class's rest translate would snap the thumb instantly.
    setThumbTranslate();
    springState = { x: posX, v, target, last: performance.now() };
    startGlow();
  }
  const commit = (next, travel) => {
    if (next === theme) return;
    anchorSweep();
    if (travel) travelTo(travel.target, travel.v, travel.anticipate);
    theme = next;
    apply(theme);
    toggle.setAttribute('aria-checked', String(theme === 'dark'));
    if (config.persist !== false) {
      try { scope.ownerDocument?.defaultView?.localStorage?.setItem(storageKey, theme); } catch { /* storage unavailable */ }
    }
    toggle.dispatchEvent(new CustomEvent('glassthemechange', { bubbles: true, detail: { theme } }));
    startGlow();
  };
  apply(initial);
  glowRender();

  // Elastic pull: the thumb stretches away from the track while held.
  toggle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || gesture) return;
    skipPointerClick = false;
    springState = null;
    anchorSweep();
    posX ??= anchorOf(theme) * travel();
    const start = liveProgress() * travel();
    const arcOffset = arcTurns - (glowTurns + Math.abs(liveProgress() - anchorOf(sweepTheme)));
    gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, initial: start, shift: start, moved: false, arcOffset };
    try { toggle.setPointerCapture(event.pointerId); } catch { /* the pointer may already be gone */ }
    toggle.dataset.dragging = '';
    startGlow();
  });
  toggle.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    if (!gesture.moved && Math.abs(dx) < 4) return;
    gesture.moved = true;
    const now = performance.now();
    gesture.shift = Math.max(0, Math.min(travel(), gesture.initial + dx));
    const dt = Math.max(8, now - (gesture.lastT ?? event.timeStamp));
    dragVel = dragVel * .5 + (gesture.shift - (gesture.lastShift ?? gesture.initial)) / dt * 1000 * .5;
    gesture.lastShift = gesture.shift;
    gesture.lastT = now;
    elasticDy = Math.max(-7, Math.min(7, (event.clientY - gesture.startY) * .08));
    posX = gesture.shift;
    setThumbTranslate();
    startGlow();
  });
  function finish(event, cancelled) {
    if (gesture?.id !== event.pointerId) return;
    delete toggle.dataset.dragging;
    if (gesture.moved) {
      skipPointerClick = true;
      const far = Math.abs(gesture.shift - gesture.initial) >= travel() * .4;
      const next = cancelled || !far ? theme : gesture.shift > gesture.initial ? 'light' : 'dark';
      const target = next === 'dark' ? 0 : travel();
      // The drag's momentum carries into the spring; no anticipation here.
      const pause = performance.now() - gesture.lastT;
      const limit = travel() * 5;
      const velocity = cancelled ? 0 : Math.max(-limit, Math.min(limit, dragVel)) * Math.exp(-pause / 85);
      if (next === theme) travelTo(target, velocity, false);
      else commit(next, { target, v: velocity, anticipate: false });
      dragVel = 0;
    }
    gesture = null;
    // The vertical pull is a held-gesture effect: always level out on release.
    elasticDy = 0;
    setThumbTranslate();
    startGlow();
  }
  toggle.addEventListener('pointerup', event => finish(event, false));
  toggle.addEventListener('pointercancel', event => finish(event, true));
  toggle.addEventListener('lostpointercapture', event => finish(event, true));
  toggle.addEventListener('click', event => {
    if (event.detail && skipPointerClick) {
      skipPointerClick = false;
      return;
    }
    commit(theme === 'dark' ? 'light' : 'dark', { target: theme === 'dark' ? travel() : 0, v: 0, anticipate: true });
    skipPointerClick = false;
  });
  toggle.setGlassTheme = next => {
    if (next !== theme) {
      commit(next, { target: next === 'dark' ? 0 : travel(), v: 0, anticipate: true });
    }
  };
  toggle.setGlassThemeLabel = label => {
    if (label) toggle.setAttribute('aria-label', label);
  };
  Object.defineProperty(toggle, 'theme', { get: () => theme });
  // Current arc angle in degrees, cumulative; 0 rests at the bottom (dark) edge.
  Object.defineProperty(toggle, 'glowRotation', { get: () => lastRot });
  // Live position of the thumb across the track, 0 dark .. 1 light.
  Object.defineProperty(toggle, 'glowProgress', { get: () => glowProgressValue });
  Object.defineProperty(toggle, 'glowColor', { get: () => glowColor });
  toggle.advanceTravel = advanceTravel;
  target.append(toggle);
  return toggle;
}
