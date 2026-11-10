import { memo, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { Wallpaper } from './Wallpaper';
import { useTheme } from '../../context/ThemeContext';
import { LEAF_PATH, VEIN_PATH } from './Brand';

// Every SVG here is drawn once; all motion is transform/opacity on the native driver (no JS work
// per frame), and the moving layers are cached as GPU textures. Reduce Motion stops every loop.

const sine = Easing.inOut(Easing.sin);

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub?.remove();
  }, []);
  return reduce;
}

/**
 * A 0→1 driver that loops on the native thread.
 * pingPong: 0→1→0 on a sine (drift, breathing); otherwise 0→1 then restart (ripples).
 */
function useLoop(duration, enabled, { delay = 0, pingPong = true } = {}) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!enabled) { v.setValue(0); return undefined; }
    const step = (toValue, easing) => Animated.timing(v, { toValue, duration, easing, useNativeDriver: true, isInteraction: false });
    const anim = Animated.loop(pingPong
      ? Animated.sequence([step(1, sine), step(0, sine)])
      : step(1, Easing.out(Easing.cubic)));
    const t = setTimeout(() => anim.start(), delay);
    return () => { clearTimeout(t); anim.stop(); };
  }, [enabled, v, duration, delay, pingPong]);
  return v;
}

const cached = { renderToHardwareTextureAndroid: true, shouldRasterizeIOS: true };

/** One soft colour blob (radial gradient), drawn once. */
const Blob = memo(function Blob({ id, size, color, opacity }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.5" stopColor={color} stopOpacity={opacity * 0.38} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
});

/** Same room and veil as every signed-in screen and the web login. */
export const AuthBackdrop = memo(function AuthBackdrop() {
  return <Wallpaper />;
});

/** The static sphere: brand blue with a rim light and the leaf mark. */
const OrbArt = memo(function OrbArt({ size }) {
  const s = 1.25;
  const tx = size / 2 - 24.5 * s;
  const ty = size / 2 - 24.2 * s;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="orbFill" cx="36%" cy="30%" r="75%">
          <Stop offset="0" stopColor="#9DB4FF" />
          <Stop offset="0.42" stopColor="#2F5BEA" />
          <Stop offset="1" stopColor="#0A1230" />
        </RadialGradient>
        <RadialGradient id="orbRim" cx="50%" cy="50%" r="50%">
          <Stop offset="0.82" stopColor="#7AA2FF" stopOpacity={0} />
          <Stop offset="1" stopColor="#7AA2FF" stopOpacity={0.55} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#orbFill)" />
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#orbRim)" />
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
      <Path
        d={LEAF_PATH}
        transform={`translate(${tx} ${ty}) scale(${s})`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path
        d={VEIN_PATH}
        transform={`translate(${tx} ${ty}) scale(${s})`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
});

/** Brand orb with a static halo, two radar ripples and a slow float. */
export const BrandOrb = memo(function BrandOrb({ size = 104 }) {
  const { colors, theme } = useTheme();
  const reduce = useReduceMotion();
  const float = useLoop(3200, !reduce);
  const ripple1 = useLoop(3600, !reduce, { pingPong: false });
  const ripple2 = useLoop(3600, !reduce, { pingPong: false, delay: 1800 });
  const halo = size * 2.4;

  const ring = (v) => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    opacity: reduce ? 0.5 : v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
    transform: [{ scale: reduce ? 1.35 : v.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
  });

  return (
    <View
      style={{ width: halo, height: size * 1.7, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Margube"
    >
      <View pointerEvents="none" style={{ position: 'absolute', width: halo, height: halo }}>
        <Blob id="orbHalo" size={halo} color={colors.accent} opacity={theme === 'dark' ? 0.4 : 0.28} />
      </View>
      <Animated.View pointerEvents="none" style={ring(ripple1)} />
      <Animated.View pointerEvents="none" style={ring(ripple2)} />
      <Animated.View
        {...cached}
        style={{
          shadowColor: '#2F5BEA',
          shadowOpacity: 0.55,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] }) }],
        }}
      >
        <OrbArt size={size} />
      </Animated.View>
    </View>
  );
});
