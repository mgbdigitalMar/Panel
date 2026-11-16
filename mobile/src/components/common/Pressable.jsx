import { useState } from 'react';
import { Animated, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SPRING } from '../../theme/motion';
import { NATIVE_GLASS } from './LiquidGlass';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HAPTIC = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  selection: () => Haptics.selectionAsync(),
};

/** A plain Pressable (no scale feedback) that also fires the haptic on every press. Same `haptic` option as PressScale. */
export function HapticPressable({ haptic = 'light', onPress, ...rest }) {
  return <Pressable {...rest} onPress={(e) => { if (haptic) HAPTIC[haptic]?.().catch(() => {}); onPress?.(e); }} />;
}

/**
 * Pressable with the design's press feedback: scale 0.97 on a spring
 * (damping 15 · stiffness 250), run on the native driver.
 * Every press fires a haptic: `haptic` picks the intensity ('light' by default, or
 * 'medium' | 'heavy' | 'selection'); pass `haptic={null}` when the caller already fires one.
 * `style` goes on the pressable itself, so flex, width, alignSelf and absolute
 * positioning size and place the touch target, not an inner wrapper.
 */
export function PressScale({ style, children, disabled, scaleTo = 0.97, haptic = 'light', nativeGlass, onPressIn, onPressOut, onPress, ...rest }) {
  const [scale] = useState(() => new Animated.Value(1));
  // `nativeGlass`: a control made of interactive system glass. On iOS 26 the glass answers the touch
  // itself, so this does not scale it as well; elsewhere it keeps the spring.
  const native = nativeGlass && NATIVE_GLASS;
  const to = (v) => { if (!native) Animated.spring(scale, { toValue: v, ...SPRING.press, useNativeDriver: true }).start(); };
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => { to(scaleTo); onPressIn?.(e); }}
      onPressOut={(e) => { to(1); onPressOut?.(e); }}
      onPress={(e) => { if (haptic) HAPTIC[haptic]?.().catch(() => {}); onPress?.(e); }}
      {...rest}
      style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
