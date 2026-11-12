import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { glassSurface, RADIUS } from '../../theme/tokens';
import { GlassFill } from './LiquidGlass';
import { PressScale } from './Pressable';

/**
 * Glass card: translucent fill, soft sheen and a bright top rim over the room backdrop.
 * No drop shadow. `strong` uses the full liquid-glass layer (blur / native glass) for hero cards;
 * plain cards stay cheap so long lists scroll smoothly. `tint`/`border` recolour it (callouts).
 */
export function GlassCard({ children, style, onPress, radius = RADIUS.card, padding = 18, strong, tint, border, accessibilityLabel, disabled, sheen = true }) {
  const { colors } = useTheme();
  const surface = [
    { borderRadius: radius, padding },
    strong ? null : glassSurface(colors),
    tint && !strong ? { backgroundColor: tint, borderTopColor: border || colors.glassBorder } : null,
    border ? { borderColor: border } : null,
  ];
  const fill = strong ? <GlassFill radius={radius} tint={tint} sheen={sheen} /> : sheen ? (
    <LinearGradient pointerEvents="none" colors={[`rgba(255,255,255,${colors.glassSheen})`, 'rgba(255,255,255,0)']}
      locations={[0, 0.5]} style={{ position: 'absolute', inset: 0, borderRadius: radius }} />
  ) : null;
  if (onPress) {
    return (
      <PressScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel} scaleTo={0.98} style={[surface, style]}>
        {fill}
        {children}
      </PressScale>
    );
  }
  return <View style={[surface, style]}>{fill}{children}</View>;
}
