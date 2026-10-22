import { memo } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { TAB_BAR_HEIGHT } from '../../navigation/tabBarMetrics';

// Content column: phones use the full width; tablets and landscape get a readable measure.
export const CONTENT_MAX = 640;
export const GUTTER = 20;

/** Brand blue washing in from the top and teal from the right edge; radial gradients drawn once. */
export const Glow = memo(function Glow({ variant = 'default' }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const h = 760;
  const a = { cx: variant === 'login' ? width * 0.5 : width * 0.3, cy: variant === 'login' ? 120 : -40, rx: width * 0.95, ry: 330 };
  const b = { cx: width * 1.08, cy: variant === 'login' ? 420 : 340, rx: width * 0.6, ry: 300 };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={h}>
        <Defs>
          <RadialGradient id="ga" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.glowA} stopOpacity={colors.glowAOpacity} />
            <Stop offset="0.45" stopColor={colors.glowA} stopOpacity={colors.glowAOpacity * 0.45} />
            <Stop offset="1" stopColor={colors.glowA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gb" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.glowB} stopOpacity={colors.glowBOpacity} />
            <Stop offset="0.45" stopColor={colors.glowB} stopOpacity={colors.glowBOpacity * 0.4} />
            <Stop offset="1" stopColor={colors.glowB} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} fill="url(#ga)" />
        <Ellipse cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill="url(#gb)" />
      </Svg>
    </View>
  );
});

/**
 * Screen container: background, glow, safe areas, optional pull-to-refresh
 * and an optional sticky footer (primary action bar).
 * `backdrop` replaces the default glow (e.g. the animated auth backdrop).
 */
export function Screen({
  children, scroll = true, refreshing = false, onRefresh, footer, glow = true, padded = true,
  tabBarSpace = false, contentStyle, keyboard = true, scrollRef, glowVariant, fab, backdrop,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSpace = (footer ? 20 : tabBarSpace ? (TAB_BAR_HEIGHT + Math.max(insets.bottom, 10) + 28) : 32 + insets.bottom) + (fab ? 64 : 0);
  const gutter = padded ? Math.max(GUTTER, insets.left, insets.right) : 0;

  const content = scroll ? (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        {
          paddingTop: insets.top + 12,
          paddingBottom: bottomSpace,
          paddingHorizontal: gutter,
          gap: 18,
          maxWidth: CONTENT_MAX + gutter * 2,
          width: '100%',
          alignSelf: 'center',
        },
        contentStyle,
      ]}
      refreshControl={onRefresh ? (
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]}
          progressBackgroundColor={colors.sheetBg} progressViewOffset={insets.top} />
      ) : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: gutter, maxWidth: CONTENT_MAX + gutter * 2, width: '100%', alignSelf: 'center' }, contentStyle]}>{children}</View>
  );

  const body = (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {backdrop ?? (glow ? <Glow variant={glowVariant} /> : null)}
      {content}
      {fab}
      {footer ? (
        <View style={{
          paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 8) + 14, gap: 10,
          backgroundColor: colors.navBg, borderTopWidth: 1, borderTopColor: colors.divider,
        }}
        >
          <View style={{ maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center', gap: 10 }}>
            {footer}
          </View>
        </View>
      ) : null}
    </View>
  );

  if (!keyboard) return body;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
    </KeyboardAvoidingView>
  );
}
