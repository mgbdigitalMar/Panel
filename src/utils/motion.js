export const EASING = {
  natural: [0.16, 1, 0.3, 1], // Smooth, natural spring-like feel without bounce
  spring: { type: 'spring', damping: 25, stiffness: 350 }, // For pop-ins
  bouncy: { type: 'spring', damping: 15, stiffness: 400 }, // For errors/shakes
};

export const pageTransitions = {
  initial: { opacity: 0, filter: 'blur(8px)', scale: 0.98, y: 12 },
  animate: { opacity: 1, filter: 'blur(0px)', scale: 1, y: 0, transition: { duration: 0.4, ease: EASING.natural } },
  exit: { opacity: 0, filter: 'blur(4px)', scale: 0.99, y: -8, transition: { duration: 0.25, ease: EASING.natural } },
};

export const slideInPage = {
  initial: { opacity: 0, x: -20, filter: 'blur(4px)' },
  animate: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: EASING.natural } },
  exit: { opacity: 0, x: 20, filter: 'blur(4px)', transition: { duration: 0.25, ease: EASING.natural } },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: EASING.natural } },
};

export const hoverLift = {
  rest: { y: 0, boxShadow: 'var(--shadow-md)', scale: 1 },
  hover: { 
    y: -4, 
    boxShadow: 'var(--shadow-xl)', 
    scale: 1.005,
    transition: { duration: 0.3, ease: EASING.natural }
  },
  tap: {
    y: -2,
    scale: 0.99,
    boxShadow: 'var(--shadow-sm)',
    transition: { duration: 0.15, ease: EASING.natural }
  }
};

export const buttonPress = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2, ease: EASING.natural } },
  tap: { scale: 0.96, transition: { duration: 0.1, ease: EASING.natural } },
};

export const inputShake = {
  initial: { x: 0 },
  error: {
    x: [0, -6, 6, -6, 6, -3, 3, 0],
    transition: { duration: 0.5, ease: 'easeInOut' }
  }
};
