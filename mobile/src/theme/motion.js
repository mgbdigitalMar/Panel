import { Easing } from 'react-native';

/**
 * Motion tokens for the app. Same figures as the web (src/motion/tokens.js and the --dur-* variables
 * in src/styles/variables.scss), in milliseconds.
 *
 * - Entering and leaving use EASE.out; nothing uses ease-in.
 * - Anything a finger can interrupt (the dock indicator, a press) runs on a spring, so it picks up
 *   from where it is instead of restarting.
 * - Leaving is shorter than entering.
 *
 * EASE holds React Native `Easing` functions for the Animated API. Reanimated worklets need
 * Reanimated's own Easing; build those with EASE_POINTS.
 */

export const DUR = {
  press: 140,
  fast: 180,
  base: 240,
  tab: 220, // switching tab
  modal: 280,
  enter: 420,
  exit: 160,
  reduced: 120, // the opacity-only fade that replaces movement under "reduce motion"
};

export const STAGGER = 45;

/** Bezier control points, for building an Easing in either animation library */
export const EASE_POINTS = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  drawer: [0.32, 0.72, 0, 1],
};

export const EASE = {
  out: Easing.bezier(...EASE_POINTS.out),
  inOut: Easing.bezier(...EASE_POINTS.inOut),
  drawer: Easing.bezier(...EASE_POINTS.drawer),
};

/** Spring configs. damping/stiffness/mass work in both Animated.spring and Reanimated's withSpring. */
export const SPRING = {
  /** Press feedback: scale down on touch, back on release */
  press: { damping: 15, stiffness: 250, mass: 0.6 },
  /** Something returning to rest after the user let go (the tab bar growing back) */
  settle: { damping: 14, stiffness: 220, mass: 0.8 },
  /** Reanimated: the dock's selection gliding to a tab. Clamped, so it never overshoots the tab. */
  indicator: { duration: 400, dampingRatio: 0.8, overshootClamping: true },
};

/** Distance a tab's content travels while it fades in, towards the side of its tab in the dock */
export const TAB_SHIFT = 12;
