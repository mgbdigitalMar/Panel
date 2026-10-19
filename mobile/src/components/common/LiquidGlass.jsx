// Liquid glass for floating controls (tab bar, icon buttons, segmented tabs, quick actions).
//   iOS 26+  → native Liquid Glass (expo-glass-effect)
//   older iOS → system material blur (expo-blur)
//   Android  → frosted translucent fill (a real blur there needs a BlurTargetView behind every
//              screen, which costs more than it gives on a tab bar over several mounted screens)
// Every variant gets the same hairline edge and bright top rim, and none casts a shadow.
// With "Reduce transparency" on, it falls back to a solid surface.
import { memo, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { FILL } from './Brand';

function detectNativeGlass() {
  if (Platform.OS !== 'ios') return false;
  try {
    // Some iOS 26 betas report the SDK but lack the API and crash — check both.
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

export const NATIVE_GLASS = detectNativeGlass();

/** True while the user has iOS "Reduce transparency" on (always false on Android). */
export function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => sub?.remove();
  }, []);
  return reduce;
}

/** Soft white sheen across the top half — the light catching the glass. */
const Sheen = memo(function Sheen({ radius, opacity }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[`rgba(255,255,255,${opacity})`, 'rgba(255,255,255,0)']}
      locations={[0, 0.55]}
      style={[FILL, { borderRadius: radius }]}
    />
  );
});

/**
 * Glass background layer: put it as the first child of any container with the same radius.
 * It fills the container absolutely, so the container keeps its own layout and press feedback.
 * `tint` colours the glass (selected states); `sheen` can be turned off on very small controls.
 */
export const GlassFill = memo(function GlassFill({ radius = 22, tint, sheen = true }) {
  const { colors, theme } = useTheme();
  const reduce = useReduceTransparency();
  const shape = { ...FILL, borderRadius: radius, overflow: 'hidden' };
  const edge = (
    <View
      pointerEvents="none"
      style={[FILL, { borderRadius: radius, borderWidth: 1, borderColor: colors.glassBorder, borderTopColor: colors.glassRim }]}
    />
  );

  if (reduce) {
    return (
      <View pointerEvents="none" style={[shape, { backgroundColor: tint || colors.raised }]}>
        {edge}
      </View>
    );
  }

  if (NATIVE_GLASS) {
    return (
      <GlassView
        pointerEvents="none"
        style={shape}
        glassEffectStyle="regular"
        colorScheme={theme}
        tintColor={tint}
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <View pointerEvents="none" style={shape}>
        <BlurView style={FILL} tint={colors.glassTint} intensity={80} />
        {tint ? <View style={[FILL, { backgroundColor: tint }]} /> : null}
        {sheen ? <Sheen radius={radius} opacity={colors.glassSheen} /> : null}
        {edge}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[shape, { backgroundColor: tint || colors.glassFill }]}>
      {sheen ? <Sheen radius={radius} opacity={colors.glassSheen} /> : null}
      {edge}
    </View>
  );
});
