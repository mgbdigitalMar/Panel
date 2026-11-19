/**
 * Motion tokens for Framer Motion. They mirror the CSS variables in styles/variables.scss
 * (--dur-*, --stagger, --ease-apple-default) and mobile/src/theme/motion.js, so a figure changes in
 * one place per platform. Durations are in seconds (Framer Motion's unit).
 *
 * Rules the values follow:
 * - Entering and leaving use EASE.out. Nothing in the UI uses ease-in.
 * - Things that move on screen (an indicator sliding between tabs) use a spring, so a second click
 *   mid-flight retargets from where the indicator is instead of restarting.
 * - Leaving is shorter than entering: the user is already looking at what comes next.
 * - Actions repeated many times a day (navigation, keyboard shortcuts) stay at or under DUR.base.
 */

export const EASE = {
  /** Strong ease-out for entrances and exits (= --ease-apple-default) */
  out: [0.23, 1, 0.32, 1],
  /** On-screen movement that is not a spring */
  inOut: [0.77, 0, 0.175, 1],
  /** iOS-like sheet and drawer curve */
  drawer: [0.32, 0.72, 0, 1],
};

export const DUR = {
  press: 0.14, // --dur-press: press feedback
  fast: 0.18, // --dur-fast: hovers, tooltips, small popovers, icon swaps
  base: 0.24, // --dur-base: panels, tabs, menus
  modal: 0.28, // dialogs and sheets opening
  enter: 0.42, // --dur-enter: a page's sections rising in
  exit: 0.16, // most exits
  reduced: 0.12, // the opacity-only fade that replaces movement under reduced motion
  tab: 0.22, // switching section from the dock (the app's DUR.tab)
};

/**
 * Rows joining, leaving or reordering in a list (a filter, a search, an approval, a sort):
 * AutoAnimate fades them in and out and slides the rest into place. Lists change tens of times a
 * day, so it stays quick, and on-screen movement takes the strong ease-in-out. AutoAnimate turns
 * itself off under prefers-reduced-motion. Rows already there when a list first renders do not
 * animate.
 */
export const LIST_MOTION = { duration: 200, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' };

/** Distance a section's content travels as it fades in, from the side of its tab in the dock (the
 * app's TAB_SHIFT, mobile/src/theme/motion.js) */
export const TAB_SHIFT = 12;

export const STAGGER = 0.045; // --stagger

export const SPRING = {
  /** Active indicator gliding between tabs, rail items and segmented options. No overshoot. */
  indicator: { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 },
  /** A count or badge popping in. Slight life, settles fast. */
  badge: { type: 'spring', stiffness: 520, damping: 24 },
  /** Button and hover response without overshoot */
  press: { type: 'spring', stiffness: 360, damping: 26, mass: 0.8, restDelta: 0.001 },
  /** Command palette highlight following the pointer */
  follow: { type: 'spring', stiffness: 700, damping: 46 },
};

/** Popover and dropdown open/close. Pass `reduce` from useReducedMotion(). */
export function popoverMotion(reduce, { y = -6 } = {}) {
  const hidden = { opacity: 0, transform: reduce ? 'none' : `translateY(${y}px) scale(0.97)` };
  return {
    initial: hidden,
    animate: {
      opacity: 1,
      transform: reduce ? 'none' : 'translateY(0px) scale(1)',
      transition: { duration: reduce ? DUR.reduced : DUR.fast, ease: EASE.out },
    },
    exit: { ...hidden, transition: { duration: reduce ? 0.1 : 0.12, ease: EASE.out } },
  };
}
