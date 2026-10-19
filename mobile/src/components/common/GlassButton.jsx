import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BRAND } from '../../theme/tokens';
import { GradientFill } from './Brand';
import { GlassFill } from './LiquidGlass';
import { PressScale } from './Pressable';
import { T } from './Text';

// Pill buttons, like the web (--radius-full). Heights line up with the controls around them:
// lg = text inputs (52), md = 48, sm = the 44 dp round icon buttons — never below the 44 dp touch minimum.
export const BUTTON_SIZES = {
  lg: { height: 52, font: 16, icon: 19, px: 22 },
  md: { height: 48, font: 15, icon: 18, px: 20 },
  sm: { height: 44, font: 14, icon: 17, px: 16 },
};

/**
 * Buttons from the design system. Flat — no drop shadows.
 * variant: 'primary' (blue CTA gradient) | 'glass' (liquid glass) | 'danger' | 'success' | 'ghost'
 * `color` gives a primary button a flat custom fill instead of the gradient.
 */
export function GlassButton({
  title, onPress, variant = 'primary', size = 'md', icon: Icon, loading, disabled, style, color, accessibilityLabel, children,
}) {
  const { colors } = useTheme();
  const s = BUTTON_SIZES[size];
  const radius = s.height / 2;
  const v = {
    // A custom fill follows the theme's on-accent ink (dark ink on dark mode's pastel fills)
    primary: { bg: color || BRAND.blue, fg: color ? colors.onAccent : '#FFFFFF' },
    glass: { bg: 'transparent', fg: colors.text },
    danger: { bg: colors.dangerSoft, fg: colors.dangerFg },
    success: { bg: colors.successSoft, fg: colors.successFg },
    ghost: { bg: 'transparent', fg: colors.accentFg },
  }[variant];
  const isDisabled = disabled || loading;
  const gradient = variant === 'primary' && !color;

  return (
    <PressScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={[{
        height: s.height,
        minWidth: s.height,
        borderRadius: radius,
        paddingHorizontal: title ? s.px : 0,
        backgroundColor: gradient ? 'transparent' : v.bg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
      }, style]}
    >
      {gradient ? <GradientFill radius={radius} /> : null}
      {variant === 'glass' ? <GlassFill radius={radius} /> : null}
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {Icon ? <Icon size={s.icon} color={v.fg} strokeWidth={2} /> : null}
          {title ? <T size={s.font} weight="semibold" color={v.fg} numberOfLines={1} style={{ flexShrink: 1 }}>{title}</T> : null}
          {children}
        </>
      )}
    </PressScale>
  );
}

/** Round liquid-glass icon button (back, close, bell…). 44 dp hit target. */
export function IconButton({ icon: Icon, onPress, accessibilityLabel, size = 44, badge, variant = 'glass', style }) {
  const { colors } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={size < 44 ? (44 - size) / 2 + 2 : 4}
      style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {variant === 'glass' ? <GlassFill radius={size / 2} sheen={false} /> : null}
      <Icon size={size >= 44 ? 21 : 19} color={colors.text} strokeWidth={1.9} />
      {badge ? (
        <View style={{
          position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
          backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg,
        }}
        >
          <T size={10} weight="bold" color="#FFFFFF" style={{ lineHeight: 12 }}>{badge > 99 ? '99+' : badge}</T>
        </View>
      ) : null}
    </PressScale>
  );
}
