// Fast, crisp button and hover response without overshoot.
export const springConfig = {
  responsive: {
    type: 'spring',
    damping: 26,
    mass: 0.8,
    stiffness: 360,
    restDelta: 0.001,
  },
};
