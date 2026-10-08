import { View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { PressScale } from './Pressable';

/**
 * Translucent "glass" surface. No real blur on lists (keeps 60 fps on Android):
 * a translucent fill + hairline border, plus a soft shadow in light mode.
 */
export function GlassCard({ children, style, onPress, radius = 22, padding = 16, strong, tint, border, accessibilityLabel, disabled }) {
  const { colors, theme } = useTheme();
  const surface = {
    borderRadius: radius,
    padding,
    backgroundColor: tint || (strong ? colors.glassStrong : colors.glass),
    borderWidth: 1,
    borderColor: border || colors.glassBorder,
    shadowColor: theme === 'dark' ? '#000000' : '#11141B',
    shadowOpacity: theme === 'dark' ? 0.35 : 0.05,
    shadowRadius: theme === 'dark' ? 12 : 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: theme === 'dark' ? 3 : 2,
  };
  if (onPress) {
    return (
      <PressScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[surface, style]}>
        {children}
      </PressScale>
    );
  }
  return <View style={[surface, style]}>{children}</View>;
}
