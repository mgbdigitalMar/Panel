import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { PressScale } from './Pressable';
import { T } from './Text';

const SIZES = {
  lg: { height: 54, radius: 17, font: 17, icon: 20, px: 22 },
  md: { height: 48, radius: 16, font: 15, icon: 18, px: 18 },
  sm: { height: 40, radius: 12, font: 14, icon: 16, px: 14 },
};

/**
 * Buttons from the design system.
 * variant: 'primary' (accent fill) | 'glass' | 'danger' | 'success' | 'ghost'
 */
export function GlassButton({
  title, onPress, variant = 'primary', size = 'md', icon: Icon, loading, disabled, style, color, accessibilityLabel, children,
}) {
  const { colors } = useTheme();
  const s = SIZES[size];
  const v = {
    primary: { bg: color || colors.accent, fg: colors.onAccent, border: 'transparent' },
    glass: { bg: colors.glassStrong, fg: colors.text, border: colors.glassBorderStrong },
    danger: { bg: colors.dangerSoft, fg: colors.dangerFg, border: 'transparent' },
    success: { bg: colors.successSoft, fg: colors.successFg, border: 'transparent' },
    ghost: { bg: 'transparent', fg: colors.accentFg, border: 'transparent' },
  }[variant];
  const isDisabled = disabled || loading;

  return (
    <PressScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={[{
        height: s.height,
        borderRadius: s.radius,
        paddingHorizontal: s.px,
        backgroundColor: v.bg,
        borderWidth: v.border === 'transparent' ? 0 : 1,
        borderColor: v.border,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
      }, variant === 'primary' && !isDisabled && {
        shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
      }, style]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {Icon ? <Icon size={s.icon} color={v.fg} strokeWidth={2} /> : null}
          {title ? <T size={s.font} weight="semibold" color={v.fg} numberOfLines={1}>{title}</T> : null}
          {children}
        </>
      )}
    </PressScale>
  );
}

/** Round icon-only button (back, close, bell…). 44 dp hit target. */
export function IconButton({ icon: Icon, onPress, accessibilityLabel, size = 44, badge, variant = 'glass', style }) {
  const { colors } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={[{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: variant === 'glass' ? colors.glassStrong : 'transparent',
        borderWidth: variant === 'glass' ? 1 : 0,
        borderColor: colors.glassBorderStrong,
      }, style]}
    >
      <Icon size={22} color={colors.text} strokeWidth={1.8} />
      {badge ? (
        <View style={{
          position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
          backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg,
        }}
        >
          <T size={10} weight="bold" color="#FFFFFF" style={{ lineHeight: 12 }}>{badge > 99 ? '99+' : badge}</T>
        </View>
      ) : null}
    </PressScale>
  );
}
