import { useState } from 'react';
import { Animated, Pressable } from 'react-native';

/**
 * Pressable with the design's press feedback: scale 0.97 on a spring
 * (damping 15 · stiffness 250), run on the native driver.
 */
export function PressScale({ style, children, disabled, scaleTo = 0.97, onPressIn, onPressOut, ...rest }) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v) => Animated.spring(scale, { toValue: v, damping: 15, stiffness: 250, mass: 0.6, useNativeDriver: true }).start();
  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => { to(scaleTo); onPressIn?.(e); }}
      onPressOut={(e) => { to(1); onPressOut?.(e); }}
      {...rest}
    >
      {(state) => (
        <Animated.View style={[{ transform: [{ scale }] }, typeof style === 'function' ? style(state) : style, disabled && { opacity: 0.5 }]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
