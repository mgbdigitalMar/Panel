// Liquid glass for floating controls (tab bar, icon buttons, segmented tabs, quick actions).
//   iOS 26+  → native Liquid Glass (expo-glass-effect), untouched
//   older iOS → a plain surface (no Liquid Glass there, and glass is never imitated on iOS)
//   Android 12+ → real blur of the screen's wallpaper (BlurTargetView, see BlurTarget.jsx), with
//              the same sheen and rim as the other variants
//   older Android, or outside a Screen → frosted translucent fill
// Every variant gets the same hairline edge and bright top rim, and none casts a shadow.
// With "Reduce transparency" on, it falls back to a solid surface.
import { createContext, memo, useContext } from 'react';
import { Platform, View } from 'react-native';
import { GlassView, GlassContainer, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { FILL } from './Brand';
import { ANDROID_BLUR, useBlurTarget } from './BlurTarget';
import { rowSurface } from '../../theme/tokens';

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

/**
 * Neighbouring glass controls, grouped. On iOS 26 a GlassContainer (SwiftUI's
 * GlassEffectContainer): glass cannot sample other glass, so controls side by side must share one
 * container to render as one material and to merge when they come close. Elsewhere a plain View.
 */
export function GlassGroup({ spacing, style, children }) {
  if (NATIVE_GLASS) return <GlassContainer spacing={spacing} style={style}>{children}</GlassContainer>;
  return <View style={style}>{children}</View>;
}

/**
 * True inside a surface that is already glass (GlassCard, the bottom sheet). Glass cannot sample
 * other glass, so what sits inside one takes the dense row surface instead (ListFill).
 */
export const InsideGlassContext = createContext(false);

/** Rounding for a fill: one radius, or per corner ({ tl, tr, bl, br }) for grouped list rows. */
function rounding(radius, corners) {
  if (!corners) return { borderRadius: radius };
  return {
    borderTopLeftRadius: corners.tl ?? radius,
    borderTopRightRadius: corners.tr ?? radius,
    borderBottomLeftRadius: corners.bl ?? radius,
    borderBottomRightRadius: corners.br ?? radius,
  };
}

/** Soft white sheen across the top half — the light catching the glass. */
const Sheen = memo(function Sheen({ round, opacity }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[`rgba(255,255,255,${opacity})`, 'rgba(255,255,255,0)']}
      locations={[0, 0.55]}
      style={[FILL, round]}
    />
  );
});

/**
 * Glass background layer: put it as the first child of any container with the same radius.
 * It fills the container absolutely, so the container keeps its own layout and press feedback.
 * `tint` colours the glass (selected states); `sheen` can be turned off on very small controls.
 * `corners` rounds each corner on its own (grouped rows). `blur={false}`: on Android the same
 * glass without a live blur, for surfaces repeated down a list (one blur per row would cost every
 * frame of a scroll); iOS draws the system glass either way.
 */
export const GlassFill = memo(function GlassFill({ radius = 22, corners, tint, nativeTint, sheen = true, edgeColor, rimColor, target, interactive, systemMaterial = false, blur = true }) {
  const { colors, theme, effectiveGlass, material } = useTheme();
  // Android: blur the wallpaper of the screen this sits in, or `target` for chrome that floats over
  // every screen (the dock passes the screen in front)
  const screenTarget = useBlurTarget();
  const blurTarget = blur ? target || screenTarget : null;
  const round = rounding(radius, corners);
  const shape = { ...FILL, ...round, overflow: 'hidden' };
  const edge = (
    <View
      pointerEvents="none"
      style={[FILL, round, { borderWidth: 1, borderColor: edgeColor || colors.glassBorder, borderTopColor: rimColor || colors.glassRim }]}
    />
  );

  if (effectiveGlass === 'off') {
    return (
      <View pointerEvents="none" style={[shape, { backgroundColor: tint || colors.raised }]}>
        {edge}
      </View>
    );
  }

  // iOS 26: the system's own Liquid Glass; the intensity controls its style and tint density.
  // No hand-drawn rim: the system glass lights its own edge. `interactive`: the glass
  // takes the touch and answers it natively (press, bounce, shimmer); the control's content must
  // let touches through (pointerEvents="none") so they reach the glass.
  if (NATIVE_GLASS) {
    const usesSystemTint = (systemMaterial || interactive) && effectiveGlass !== 'soft';
    const customTint = nativeTint === null ? material.nativeTint : tint || material.nativeTint;
    return (
      <GlassView
        pointerEvents={interactive ? 'auto' : 'none'}
        isInteractive={Boolean(interactive)}
        style={shape}
        glassEffectStyle={effectiveGlass === 'strong' && interactive ? 'clear' : material.nativeStyle}
        colorScheme={theme}
        tintColor={nativeTint ?? (usesSystemTint ? undefined : customTint)}
      />
    );
  }

  // iOS before 26 has no Liquid Glass: a plain surface, never glass imitated with a blur
  if (Platform.OS === 'ios') {
    return (
      <View pointerEvents="none" style={[shape, { backgroundColor: tint || colors.glassFill }]}>
        {edge}
      </View>
    );
  }

  if (ANDROID_BLUR && blurTarget) {
    return (
      <View pointerEvents="none" style={shape}>
        <BlurView style={[FILL, round, { overflow: 'hidden' }]} blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus"
          intensity={material.blurIntensity} tint={colors.glassTint} />
        <View style={[FILL, { backgroundColor: tint || colors.glassFill }]} />
        {sheen ? <Sheen round={round} opacity={colors.glassSheen} /> : null}
        {edge}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[shape, { backgroundColor: tint || colors.glassFill }]}>
      {sheen ? <Sheen round={round} opacity={colors.glassSheen} /> : null}
      {edge}
    </View>
  );
});

/**
 * The surface of list rows, list items and unselected chips. On the wallpaper it is glass, the same
 * material as the cards (system glass on iOS 26; on Android without a live blur, see GlassFill).
 * Inside a surface that is already glass (InsideGlassContext) it is the dense row surface: glass
 * cannot sit on glass. First child of the row, like GlassFill.
 */
export const ListFill = memo(function ListFill({ radius = 20, corners, edgeColor, rimColor }) {
  const { colors } = useTheme();
  const inside = useContext(InsideGlassContext);
  if (!inside) return <GlassFill radius={radius} corners={corners} edgeColor={edgeColor} rimColor={rimColor} blur={false} />;
  const surface = rowSurface(colors);
  return (
    <View
      pointerEvents="none"
      style={[FILL, rounding(radius, corners), surface, {
        borderColor: edgeColor || surface.borderColor,
        borderTopColor: rimColor || edgeColor || surface.borderTopColor,
      }]}
    />
  );
});
