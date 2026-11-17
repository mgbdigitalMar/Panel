/**
 * Bottom sheet physics, shared by the web (ui/Modal on phones) and the app (common/UI Sheet).
 *
 * A sheet follows the finger 1:1 down from its grab handle, resists when pulled up past its rest
 * position, and on release is thrown to where the gesture was heading, not to where the finger
 * stopped: a quick flick closes it from a few pixels, a slow drag must pass half its height.
 * The release velocity is handed to the spring, so there is no seam between dragging and moving.
 *
 * The functions carry the 'worklet' directive so Reanimated can run them on the UI thread; on the
 * web the directive is an inert string.
 */

/** Movement before a press on the handle becomes a drag, so a tap on the close button stays a tap */
export const SHEET_DRAG_THRESHOLD = 10;

/** Decay rate for the projection: the normal scroll feel. A 1000 px/s flick lands about 500 px further on,
    so a light flick closes a sheet; a slow release (under ~200 px/s) barely projects at all. */
export const SHEET_DECELERATION = 0.998;

/** Share of the sheet's height the projected position must pass for the sheet to close */
export const SHEET_DISMISS_FRACTION = 0.5;

/** Springs as damping ratio + perceptual duration (s). Opening and closing are tapped: no overshoot.
    Returning after a throw carries the finger's momentum, so it may overshoot a little. */
export const SHEET_SPRING = {
  open: { dampingRatio: 1, duration: 0.4 },
  close: { dampingRatio: 1, duration: 0.3 },
  settle: { dampingRatio: 0.8, duration: 0.3 },
};

/**
 * Distance a release velocity (px/s) carries the sheet before coming to rest, using the
 * exponential decay of scrolling (Apple's Designing Fluid Interfaces sample), not v²/2a.
 */
export function projectDistance(velocity, deceleration = SHEET_DECELERATION) {
  'worklet';
  return ((velocity / 1000) * deceleration) / (1 - deceleration);
}

/**
 * Offset shown for a drag past a boundary: it follows less the further it goes and never stops
 * dead. `dimension` is the size the resistance is measured against (the sheet's height).
 */
export function rubberband(overshoot, dimension, constant = 0.55) {
  'worklet';
  if (!dimension) return 0;
  const sign = overshoot < 0 ? -1 : 1;
  const distance = Math.abs(overshoot);
  return (sign * distance * dimension * constant) / (dimension + constant * distance);
}

/** Visible offset of the sheet for a raw drag offset: 1:1 downwards, rubber-banded upwards */
export function sheetDragOffset(dragY, height) {
  'worklet';
  return dragY >= 0 ? dragY : rubberband(dragY, height);
}

/** On release: true closes the sheet, false sends it back to its rest position */
export function shouldDismissSheet(offset, velocity, height) {
  'worklet';
  if (!height) return false;
  // A flick back up always keeps the sheet open, wherever it was let go
  if (velocity < -50) return false;
  return offset + projectDistance(velocity) > height * SHEET_DISMISS_FRACTION;
}
