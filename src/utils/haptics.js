// Haptic feedback for touch screens: every finger tap on a control gets a short buzz, as the
// Liquid Glass rule asks (mobile/.claude/skills/claude-liquid-glass).
//   Android browsers → Vibration API, with a pattern per intensity.
//   iPhone Safari   → it has no web vibration, but toggling a hidden <input type="checkbox" switch>
//                     plays the system haptic (iOS 18+). Intensity can't vary there: one tick per
//                     tap, two or three for success / error. On older iOS it is a silent no-op.
//   Mouse, pen and keyboard never buzz.
// Opt out with data-haptic="off" on an element or any ancestor; pick an intensity with
// data-haptic="medium" | "heavy" | "selection" (the default is "light").

const CONTROL = 'button, a[href], summary, label, input, select, [role="button"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"], [data-haptic]'
// Tapping into a field to type is not an action, and the iPhone trick would steal its focus
const TEXT_ENTRY = 'textarea, select, [contenteditable=""], [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="image"])'

const PATTERNS = {
  light: 10,
  medium: 16,
  heavy: 26,
  selection: 6,
  success: [12, 60, 12],
  warning: [18, 80, 18],
  error: [18, 50, 18, 50, 18],
}
const IOS_TICKS = { success: 2, warning: 2, error: 3 }

const hasWindow = typeof window !== 'undefined' && typeof document !== 'undefined'
const canVibrate = hasWindow && typeof navigator.vibrate === 'function'
const canSwitch = hasWindow && !canVibrate && 'switch' in HTMLInputElement.prototype

let switchLabel = null
let ticking = false
let lastAt = 0

function iosTick() {
  if (!switchLabel) {
    switchLabel = document.createElement('label')
    switchLabel.setAttribute('aria-hidden', 'true')
    switchLabel.dataset.haptic = 'off'
    switchLabel.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    switchLabel.appendChild(input)
    document.body.appendChild(switchLabel)
  }
  ticking = true
  try { switchLabel.click() } finally { ticking = false }
}

/** Buzz now. `kind`: light (default) | medium | heavy | selection | success | warning | error. */
export function haptic(kind = 'light') {
  lastAt = performance.now()
  if (canVibrate) {
    navigator.vibrate(PATTERNS[kind] ?? PATTERNS.light)
  } else if (canSwitch) {
    iosTick()
    for (let i = 1; i < (IOS_TICKS[kind] || 1); i++) setTimeout(iosTick, i * 90)
  }
}

/** Kept for existing callers: a light tap. */
export const hapticTap = () => haptic('light')

/** Listen once for finger taps on any control, so every button in the app buzzes without per-file wiring. */
export function installHaptics() {
  if (!hasWindow || (!canVibrate && !canSwitch)) return
  let touch = false
  document.addEventListener('pointerdown', (event) => { touch = event.pointerType === 'touch' }, true)
  document.addEventListener('click', (event) => {
    // A synthetic click (keyboard Enter/Space) has no pointer behind it
    if (ticking || !touch || event.detail === 0) return
    const el = event.target instanceof Element ? event.target.closest(CONTROL) : null
    if (!el || el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return
    if (el.closest('[data-haptic="off"]') || el.matches(TEXT_ENTRY)) return
    // One tap, one buzz: a <label> forwards its click to its input, and the dock buzzes itself
    if (performance.now() - lastAt < 80) return
    haptic(el.closest('[data-haptic]')?.dataset.haptic || 'light')
  }, true)
}
