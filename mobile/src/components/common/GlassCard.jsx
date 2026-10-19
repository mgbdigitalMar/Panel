import { View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { glassSurface } from '../../theme/tokens';
import { GlassFill } from './LiquidGlass';
import { PressScale } from './Pressable';

/**
 * Glass card: translucent fill, hairline edge and a bright top rim over the brand backdrop.
 * No drop shadow. `strong` uses the full liquid-glass layer (blur / native glass) for hero cards;
 * plain cards stay cheap so long lists scroll smoothly. `tint`/`border` recolour it (callouts).
 */
export function GlassCard({ children, style, onPress, radius = 22, padding = 16, strong, tint, border, accessibilityLabel, disabled }) {
  const { colors } = useTheme();
  const surface = [
    { borderRadius: radius, padding },
    strong && !tint ? null : glassSurface(colors),
    tint ? { backgroundColor: tint, borderTopColor: border || colors.glassBorder } : null,
    border ? { borderColor: border } : null,
  ];
  const fill = strong && !tint ? <GlassFill radius={radius} /> : null;
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
