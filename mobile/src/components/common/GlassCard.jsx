import { View } from 'react-native';
import { RADIUS } from '../../theme/tokens';
import { GlassFill } from './LiquidGlass';
import { PressScale } from './Pressable';

/**
 * Glass card: real liquid glass over the room backdrop. Native Liquid Glass on iOS 26, a system
 * material blur on older iOS and a blur of the screen's wallpaper on Android 12+ (LiquidGlass.jsx),
 * each with the soft sheen and the bright top rim. No drop shadow. `tint`/`border` recolour it
 * (callouts). `strong` is kept for callers; every card is now the full glass layer.
 */
export function GlassCard({ children, style, onPress, radius = RADIUS.card, padding = 18, tint, border, accessibilityLabel, disabled, sheen = true }) {
  const surface = [
    { borderRadius: radius, padding },
    border ? { borderWidth: 1, borderColor: border } : null,
  ];
  const fill = <GlassFill radius={radius} tint={tint} sheen={sheen} edgeColor={border} />;
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
