import { Platform, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FONTS } from '../../theme/tokens';

// Android ignores fontWeight for custom fonts, so each weight maps to its own family.
const BODY = {
  regular: FONTS.regular,
  medium: FONTS.medium,
  semibold: FONTS.semibold,
  bold: FONTS.bold,
};

const HEADING = {
  regular: FONTS.headingMedium,
  medium: FONTS.headingMedium,
  semibold: FONTS.heading,
  bold: FONTS.headingBold,
};

/**
 * Themed text. Like the web, headings (17+ semibold/bold) use Poppins and body uses Inter.
 * `mono` uses Geist Mono for small figures; large figures (22+) switch to Poppins with
 * tabular numerals, matching the web's KPI tiles. `heading` forces the choice either way.
 * @param {{ size?: number, weight?: 'regular'|'medium'|'semibold'|'bold', color?: string, mono?: boolean,
 *   heading?: boolean, tracking?: number, upper?: boolean, align?: 'left'|'center'|'right' }} props
 */
export function T({ size = 15, weight = 'regular', color, mono, heading, tracking, upper, align, style, children, ...rest }) {
  const { colors } = useTheme();
  const bigFigure = mono && size >= 22;
  const isHeading = heading ?? (bigFigure || (!mono && size >= 17 && (weight === 'semibold' || weight === 'bold')));
  // Display sizes read lighter: semibold drops to medium from 24 up.
  const headingWeight = size >= 24 && weight === 'semibold' && !bigFigure ? 'medium' : weight;
  const fontFamily = isHeading
    ? HEADING[headingWeight] || FONTS.heading
    : mono
      ? (weight === 'semibold' || weight === 'bold' ? FONTS.monoBold : FONTS.mono)
      : BODY[weight] || FONTS.regular;
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        {
          fontFamily,
          fontSize: size,
          lineHeight: Math.round(size * (isHeading ? 1.25 : 1.4)),
          color: color || colors.text,
          letterSpacing: tracking ?? (size >= 26 ? -size * 0.03 : size >= 18 ? -size * 0.015 : 0),
        },
        bigFigure && { fontVariant: ['tabular-nums'] },
        Platform.OS === 'android' && { includeFontPadding: false },
        align && { textAlign: align },
        upper && { textTransform: 'uppercase', letterSpacing: 0.8 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Section label: 12.5 / semibold / uppercase / text3. */
export function Label({ children, style }) {
  const { colors } = useTheme();
  return <T size={12} weight="semibold" color={colors.text3} upper style={style}>{children}</T>;
}
