import { useState } from 'react';
import { Animated, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable with the design's press feedback: scale 0.97 on a spring
 * (damping 15 · stiffness 250), run on the native driver.
 * `style` goes on the pressable itself, so flex, width, alignSelf and absolute
 * positioning size and place the touch target, not an inner wrapper.
 */
export function PressScale({ style, children, disabled, scaleTo = 0.97, onPressIn, onPressOut, ...rest }) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v) => Animated.spring(scale, { toValue: v, damping: 15, stiffness: 250, mass: 0.6, useNativeDriver: true }).start();
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => { to(scaleTo); onPressIn?.(e); }}
      onPressOut={(e) => { to(1); onPressOut?.(e); }}
      {...rest}
      style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
