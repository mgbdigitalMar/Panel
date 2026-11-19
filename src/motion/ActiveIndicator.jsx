import { useId } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { SPRING } from './tokens';

/**
 * Scope for one control's indicator. Wrap each tab strip, segmented control or rail in it:
 * the layoutId inside is namespaced, so two controls on the same page never trade indicators.
 */
export function IndicatorGroup({ children }) {
  const id = useId();
  return <LayoutGroup id={id}>{children}</LayoutGroup>;
}

/**
 * The surface of the selected option, rendered inside the selected button only. When the
 * selection changes, Framer Motion glides it from the old button to the new one on a spring
 * (interruptible: a second click mid-flight retargets from where it is). With reduced motion
 * (MotionConfig reducedMotion="user" in App) it simply appears on the new option.
 *
 * The button needs `position: relative; isolation: isolate` and the indicator `z-index: -1`, so
 * it sits behind the label without covering it.
 *
 * `radius` (px): pass it when the corners are fixed. Framer Motion only corrects the corners for
 * the stretch of the glide when the radius is set inline; from a stylesheet they would smear while
 * the indicator travels between options of different widths.
 */
export function ActiveIndicator({ className, layoutId = 'active-indicator', radius }) {
  return (
    <motion.span
      layoutId={layoutId}
      className={className}
      style={radius != null ? { borderRadius: radius } : undefined}
      transition={SPRING.indicator}
      initial={false}
      aria-hidden="true"
    />
  );
}
