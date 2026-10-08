import { useMotionValue, useSpring } from 'framer-motion';

/**
 * Apple-inspired spring animations with physics-based behavior
 * All springs use damping: 1.0 (critically damped, no overshoot) by default
 * except momentum-driven interactions which use damping: 0.8
 */

export const springConfig = {
  // UI default: snappy, no bounce (critically damped)
  default: {
    type: 'spring',
    damping: 28,
    mass: 1,
    stiffness: 300,
    restDelta: 0.001,
  },

  // Responsive feedback: fast, crisp button/hover response
  responsive: {
    type: 'spring',
    damping: 26,
    mass: 0.8,
    stiffness: 360,
    restDelta: 0.001,
  },

  // Momentum interaction: gentle settle without wild bounce
  momentum: {
    type: 'spring',
    damping: 24,
    mass: 1,
    stiffness: 280,
    restDelta: 0.001,
  },

  // Page transition: smooth, deliberate entrance
  pageTransition: {
    type: 'spring',
    damping: 30,
    mass: 1.1,
    stiffness: 220,
    restDelta: 0.001,
  },

  // Drawer/sheet: controlled fluid settle
  sheet: {
    type: 'spring',
    damping: 26,
    mass: 1,
    stiffness: 260,
    restDelta: 0.001,
  },
};

/**
 * Hook for velocity handoff (momentum calculation)
 * Used to project where a flicked element will land
 */
export function useVelocityProjection() {
  return {
    /**
     * Calculate projected endpoint from initial velocity
     * @param {number} velocity - pixels per second
     * @param {number} decelerationRate - usually 0.998
     */
    project: (velocity, decelerationRate = 0.998) => {
      return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
    },

    /**
     * Calculate relative velocity for spring (velocity / remaining distance)
     */
    relativeVelocity: (velocity, distance) => {
      return Math.abs(distance) > 0 ? velocity / distance : 0;
    },
  };
}

/**
 * Hook for interruptible animations
 * Reads current on-screen transform to animate from presentation value
 */
export function useInterruptibleAnimation() {
  return {
    /**
     * Get current transform value from element for interrupt-safe animation
     */
    getCurrentTransform: (element) => {
      if (!element) return 0;
      const transform = window.getComputedStyle(element).transform;
      const match = transform.match(/matrix3d\([\d\s,]*,[\d\s,]*,[\d\s,]*,([\d.-]+)\)/) ||
                   transform.match(/matrix\([\d\s,]*,[\d\s,]*,[\d\s,]*,[\d\s,]*,([\d.-]+)/);
      return match ? parseFloat(match[1]) : 0;
    },
  };
}

/**
 * Calculate velocity from drag history
 * @param {Array} history - array of {x, y, timestamp}
 */
export function calculateDragVelocity(history) {
  if (history.length < 2) return 0;

  const latest = history[history.length - 1];
  const previous = history[Math.max(0, history.length - 5)]; // last ~5 frames

  const distance = latest.x - previous.x;
  const time = (latest.timestamp - previous.timestamp) / 1000; // to seconds

  return time > 0 ? distance / time : 0;
}

/**
 * Determine snap point based on projection
 * @param {number} projected - the projected endpoint
 * @param {Array} snapPoints - [open, closed] positions
 */
export function getSnapTarget(projected, snapPoints = [0, 300]) {
  const [closed, open] = snapPoints;
  const mid = (closed + open) / 2;

  return Math.abs(projected - open) < Math.abs(projected - closed) ? open : closed;
}
