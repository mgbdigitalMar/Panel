import { memo } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

/**
 * The design's two blurred colour blobs, drawn as radial gradients
 * (cheap on Android, unlike a real blur).
 */
export const Glow = memo(function Glow({ variant = 'default' }) {
  const { colors } = useTheme();
  const a = { cx: variant === 'login' ? 170 : 90, cy: variant === 'login' ? 150 : 40, r: 260 };
  const b = { cx: 400, cy: variant === 'login' ? 340 : 220, r: 210 };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height={620} viewBox="0 0 390 620" preserveAspectRatio="xMidYMin slice">
        <Defs>
          <RadialGradient id="ga" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.glowA} stopOpacity={colors.glowAOpacity} />
            <Stop offset="0.55" stopColor={colors.glowA} stopOpacity={colors.glowAOpacity * 0.35} />
            <Stop offset="1" stopColor={colors.glowA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gb" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.glowB} stopOpacity={colors.glowBOpacity} />
            <Stop offset="0.55" stopColor={colors.glowB} stopOpacity={colors.glowBOpacity * 0.35} />
            <Stop offset="1" stopColor={colors.glowB} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={a.cx} cy={a.cy} r={a.r} fill="url(#ga)" />
        <Circle cx={b.cx} cy={b.cy} r={b.r} fill="url(#gb)" />
      </Svg>
    </View>
  );
});

/**
 * Screen container: background, glow, safe areas, optional pull-to-refresh
 * and an optional sticky footer (primary action bar).
 */
export function Screen({
  children, scroll = true, refreshing = false, onRefresh, footer, glow = true, padded = true,
  tabBarSpace = false, contentStyle, keyboard = true, scrollRef, glowVariant, fab,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSpace = (footer ? 20 : tabBarSpace ? (104 + Math.max(insets.bottom, 12)) : 32) + (footer ? insets.bottom : 0);

  const content = scroll ? (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          paddingTop: insets.top + 12,
          paddingBottom: bottomSpace,
          paddingHorizontal: padded ? 20 : 0,
          gap: 16,
          maxWidth: 680,
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
    <View style={[{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: padded ? 20 : 0, maxWidth: 680, width: '100%', alignSelf: 'center' }, contentStyle]}>{children}</View>
  );

  const body = (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {glow ? <Glow variant={glowVariant} /> : null}
      {content}
      {fab}
      {footer ? (
        <View style={{
          paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 14, gap: 10,
          backgroundColor: colors.navBg, borderTopWidth: 1, borderTopColor: colors.divider,
        }}
        >
          <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center', gap: 10 }}>
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
