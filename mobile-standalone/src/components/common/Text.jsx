import { Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FONTS } from '../../theme/tokens';

// Android ignores fontWeight for custom fonts, so each weight maps to its own family.
const FAMILY = {
  regular: FONTS.regular,
  medium: FONTS.medium,
  semibold: FONTS.semibold,
  bold: FONTS.bold,
};

/**
 * Themed text. `mono` uses Geist Mono for figures (hours, times, counters).
 * @param {{ size?: number, weight?: 'regular'|'medium'|'semibold'|'bold', color?: string, mono?: boolean, tracking?: number, upper?: boolean }} props
 */
export function T({ size = 15, weight = 'regular', color, mono, tracking, upper, style, children, ...rest }) {
  const { colors } = useTheme();
  const fontFamily = mono
    ? (weight === 'semibold' || weight === 'bold' ? FONTS.monoBold : FONTS.mono)
    : FAMILY[weight] || FONTS.regular;
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        {
          fontFamily,
          fontSize: size,
          lineHeight: Math.round(size * 1.3),
          color: color || colors.text,
          letterSpacing: tracking ?? (size >= 26 ? -size * 0.03 : size >= 20 ? -size * 0.02 : 0),
        },
        upper && { textTransform: 'uppercase', letterSpacing: 1 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Section label: 13 / semibold / uppercase / text3. */
export function Label({ children, style }) {
  const { colors } = useTheme();
  return <T size={12.5} weight="semibold" color={colors.text3} upper style={style}>{children}</T>;
}
