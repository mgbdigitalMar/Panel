// Brand pieces shared with the web: the Margube leaf, the dark brand panel and the CTA gradient.
import { memo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { BRAND } from '../../theme/tokens';
import { T } from './Text';

// Leaf geometry, traced from the Margube mark (48×48 box) — same as the web loader
export const LEAF_PATH = 'M9.5 39.5C9.5 22 14.5 10 25 9.2L39.5 8.8V24C39.5 34 33 39.5 24 39.5Z';
export const VEIN_PATH = 'M10.5 38.5C12.5 31 16.5 26.8 22 24';

/**
 * The web's --shape-leaf (60% 12% 60% 12%): round top-left and bottom-right,
 * near-sharp elsewhere. Used for every person's avatar.
 */
export function leafRadii(size) {
  const round = size * 0.6;
  const sharp = size * 0.12;
  return {
    borderTopLeftRadius: round,
    borderTopRightRadius: sharp,
    borderBottomRightRadius: round,
    borderBottomLeftRadius: sharp,
  };
}

/** The leaf mark on a brand-blue tile (app icon, empty states, lock screen). */
export const LeafMark = memo(function LeafMark({ size = 48, tile = true, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tile ? (
        <>
          <Defs>
            <SvgLinearGradient id="leafTile" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={BRAND.blueLight} />
              <Stop offset="1" stopColor={BRAND.blue} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="48" height="48" rx="13" fill="url(#leafTile)" />
        </>
      ) : null}
      <Path d={LEAF_PATH} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
      <Path d={VEIN_PATH} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
});

/** Absolute fill without StyleSheet.absoluteFillObject (removed in React Native 0.86). */
export const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Horizontal CTA gradient (--gradient-cta) painted as the background of its parent.
 * A native gradient view, so it always covers the parent's full box (padding included).
 */
export const GradientFill = memo(function GradientFill({ radius = 0, colors = BRAND.cta, vertical }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={vertical ? { x: 0, y: 1 } : { x: 1, y: 0 }}
      style={[FILL, { borderRadius: radius }]}
    />
  );
});

/** Static art behind a brand panel: blue glow bottom-left, two hairline rings, a hairline leaf. */
const PanelArt = memo(function PanelArt({ width, height, leaf, rings }) {
  const leafSize = Math.min(width * 0.46, 220);
  const s = leafSize / 48;
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <RadialGradient id="panelGlow" cx="0" cy="1" r="0.95" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={BRAND.glow} stopOpacity={0.55} />
          <Stop offset="0.55" stopColor={BRAND.glow} stopOpacity={0.16} />
          <Stop offset="1" stopColor={BRAND.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#panelGlow)" />
      {rings ? (
        <>
          <Circle cx={width * 0.88} cy={height * 0.18} r={96} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          <Circle cx={width * 0.88} cy={height * 0.18} r={156} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        </>
      ) : null}
      {leaf ? (
        <>
          <Path d={LEAF_PATH} transform={`translate(${width - leafSize * 0.9} ${height - leafSize * 0.72}) scale(${s})`}
            fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.25 / s} strokeLinejoin="round" />
          <Path d={VEIN_PATH} transform={`translate(${width - leafSize * 0.9} ${height - leafSize * 0.72}) scale(${s})`}
            fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.25 / s} strokeLinecap="round" />
        </>
      ) : null}
    </Svg>
  );
});

/**
 * The login's dark brand panel in miniature (web: @mixin brand-panel).
 * Navy in both themes — use it for the single highlight on a screen.
 * Text inside should be white; use BrandTag / brandText helpers.
 */
export function BrandPanel({ children, style, padding = 20, radius = 26, leaf = true, rings = true }) {
  const { colors } = useTheme();
  const [size, setSize] = useState(null);
  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!size || Math.abs(size.width - width) > 1 || Math.abs(size.height - height) > 1) setSize({ width, height });
      }}
      style={[{
        borderRadius: radius,
        padding,
        backgroundColor: colors.brandBg,
        borderWidth: 1,
        borderColor: colors.brandBorder,
        overflow: 'hidden',
      }, style]}
    >
      {size ? <PanelArt width={size.width} height={size.height} leaf={leaf} rings={rings} /> : null}
      {children}
    </View>
  );
}

/** Text colours on a brand panel. */
export const ON_BRAND = {
  text: '#FFFFFF',
  text2: 'rgba(255,255,255,0.72)',
  text3: 'rgba(255,255,255,0.56)',
  track: 'rgba(255,255,255,0.14)',
  accent: '#9DB4FF',
};

/** Translucent chip on a brand panel (web: @mixin brand-tag). */
export function BrandTag({ label, icon: Icon }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 11, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)' }}>
      {Icon ? <Icon size={12} color="rgba(255,255,255,0.88)" /> : null}
      <T size={12} weight="semibold" color="rgba(255,255,255,0.88)" numberOfLines={1}>{label}</T>
    </View>
  );
}

/** White chip on a hero card. */
export function HeroChip({ label, icon: Icon }) {
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#FFFFFF' }}>
      {Icon ? <Icon size={13} color={BRAND.navy} strokeWidth={2.2} /> : null}
      <T size={12.5} weight="semibold" color={BRAND.navy} numberOfLines={1}>{label}</T>
    </View>
  );
}

/** The big leaf behind a hero card. */
const HeroArt = memo(function HeroArt({ width, height }) {
  const size = Math.min(height * 1.05, width * 0.78);
  const s = size / 48;
  const x = width - size * 0.82;
  const y = height - size * 0.98;
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <RadialGradient id="heroLight" cx="0.8" cy="0.15" r="0.75" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#heroLight)" />
      <Path d={LEAF_PATH} transform={`translate(${x} ${y}) scale(${s})`} fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.26)" strokeWidth={1.4 / s} strokeLinejoin="round" />
      <Path d={VEIN_PATH} transform={`translate(${x} ${y}) scale(${s})`} fill="none"
        stroke="rgba(255,255,255,0.26)" strokeWidth={1.4 / s} strokeLinecap="round" />
    </Svg>
  );
});

/** Brand blue running into navy with a dark fade at the bottom so white text stays legible.
 * Same colours in both themes, like the brand panel. */
export function HeroCard({ children, style, padding = 20, radius = 30, minHeight = 230 }) {
  const [size, setSize] = useState(null);
  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!size || Math.abs(size.width - width) > 1 || Math.abs(size.height - height) > 1) setSize({ width, height });
      }}
      style={[{ borderRadius: radius, padding, minHeight, overflow: 'hidden', backgroundColor: BRAND.blue }, style]}
    >
      <LinearGradient pointerEvents="none" colors={['#7AA2FF', BRAND.blue, '#1B2C6E', BRAND.navy]} locations={[0, 0.38, 0.78, 1]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={FILL} />
      {size ? <HeroArt width={size.width} height={size.height} /> : null}
      <LinearGradient pointerEvents="none" colors={['rgba(17,20,27,0)', 'rgba(17,20,27,0.5)']} locations={[0.35, 1]} style={FILL} />
      {children}
    </View>
  );
}
