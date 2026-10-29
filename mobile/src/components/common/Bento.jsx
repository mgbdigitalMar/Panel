// Bento pieces of the redesign: big light figures, proportion pills, capsule bars, a month grid
// with hatched off-days, accent / info tiles, file chips and the photo hero of the profile.
import { memo } from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { BRAND, RADIUS } from '../../theme/tokens';
import { addDays, startOfWeek, toISODate, todayISO, MONTHS } from '../../utils/format';
import { FILL, GradientFill, LEAF_PATH, VEIN_PATH } from './Brand';
import { GlassFill } from './LiquidGlass';
import { PressScale } from './Pressable';
import { T } from './Text';

const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Large light figure with its unit ("+12:30 h"). */
export function BigFigure({ value, unit, color, unitColor, size = 46, style, accessibilityLabel }) {
  const { colors } = useTheme();
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }, style]}
    >
      <T size={size} weight="light" color={color} numberOfLines={1} adjustsFontSizeToFit
        style={{ lineHeight: Math.round(size * 1.15), fontVariant: ['tabular-nums'], flexShrink: 1 }}>
        {value}
      </T>
      {unit ? <T size={Math.round(size * 0.4)} weight="light" color={unitColor || colors.text3}>{unit}</T> : null}
    </View>
  );
}

/**
 * Proportion pills with their label above: each pill's width follows its share of the total.
 * items: [{ label, value, display, bg, fg, outline? }]
 */
export function SplitPills({ items, height = 36, style }) {
  const { colors } = useTheme();
  const total = items.reduce((s, it) => s + Math.max(0, Number(it.value) || 0), 0);
  return (
    <View style={[{ flexDirection: 'row', gap: 6 }, style]}>
      {items.map((it) => {
        const share = total ? Math.max(0, Number(it.value) || 0) / total : 1 / items.length;
        return (
          <View key={it.label} style={{ flex: Math.max(share, 0.24), minWidth: 0, gap: 6 }} accessible accessibilityLabel={`${it.label}: ${it.display}`}>
            <T size={12.5} color={colors.text2} numberOfLines={1}>{it.label}</T>
            <View style={{
              height, borderRadius: height / 2, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: it.bg,
              borderWidth: it.outline ? 1 : 0, borderColor: colors.glassBorder,
            }}
            >
              <T size={12.5} weight="semibold" mono color={it.fg} numberOfLines={1}>{it.display}</T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Thin vertical capsules filled from the bottom (0–100), label underneath.
 * items: [{ key, label, value, highlight?, dot?, color?, accessibilityLabel? }]
 */
export function CapsuleBars({ items, height = 96, width = 14, color, style }) {
  const { colors } = useTheme();
  const inner = width - 4;
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between' }, style]}>
      {items.map((it) => {
        const pct = clamp(it.value);
        return (
          <View key={it.key || it.label} style={{ flex: 1, alignItems: 'center', gap: 8 }} accessible
            accessibilityLabel={it.accessibilityLabel || `${it.label}: ${Math.round(pct)}%`}>
            <View style={{
              width, height, borderRadius: width / 2, padding: 2, justifyContent: 'flex-end',
              backgroundColor: colors.capsule, borderWidth: 1, borderColor: it.highlight ? colors.accentBorder : colors.cellBorder,
            }}
            >
              {pct > 0 ? (
                <View style={{ height: `${Math.max(pct, (inner / (height - 6)) * 100)}%`, borderRadius: inner / 2, backgroundColor: it.color || color || colors.accent }} />
              ) : null}
            </View>
            <T size={11.5} weight={it.highlight ? 'semibold' : 'regular'} color={it.highlight ? colors.text : colors.text3}>{it.label}</T>
            <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: -4, backgroundColor: it.dot ? colors.accent : 'transparent' }} />
          </View>
        );
      })}
    </View>
  );
}

// Diagonal lines on a 40×40 box; "slice" keeps them at 45° on any aspect ratio.
const HATCH_PATH = Array.from({ length: 11 }, (_, i) => {
  const c = i * 8;
  return c <= 40 ? `M0 ${c}L${c} 0` : `M${c - 40} 40L40 ${c - 40}`;
}).join('');

/** Hatching laid over a cell: days outside the month, weekends, unavailable slots. */
export const Hatch = memo(function Hatch({ color, radius = 0 }) {
  return (
    <View pointerEvents="none" style={[FILL, { borderRadius: radius, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice">
        <Path d={HATCH_PATH} stroke={color} strokeWidth={1.3} />
      </Svg>
    </View>
  );
});

const WEEK_HEAD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Monday-first month grid. Rounded cells, weekend headers in rose, hatched weekends and days
 * outside the month. marks: { [iso]: { bg, fg, dot, label } } · onSelect(iso)
 */
export function MonthCalendar({ month, marks = {}, selected, onSelect, style }) {
  const { colors } = useTheme();
  const today = todayISO();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const weeks = [];
  let d = startOfWeek(first);
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
    d = addDays(d, 7);
  } while (d.getMonth() === month.getMonth());

  return (
    <View style={[{ gap: 6 }, style]}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {WEEK_HEAD.map((h, i) => (
          <T key={h} size={12} weight="medium" align="center" color={i >= 5 ? colors.dangerFg : colors.text3} style={{ flex: 1 }}>{h}</T>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={toISODate(week[0])} style={{ flexDirection: 'row', gap: 6 }}>
          {week.map((day) => {
            const iso = toISODate(day);
            const inMonth = day.getMonth() === month.getMonth();
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            const mark = inMonth ? marks[iso] : null;
            const isSel = selected === iso && inMonth;
            const isToday = iso === today;
            return (
              <Pressable
                key={iso}
                disabled={!inMonth || !onSelect}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect(iso); }}
                accessibilityRole={onSelect && inMonth ? 'button' : undefined}
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${day.getDate()} de ${MONTHS[day.getMonth()]}${isToday ? ', hoy' : ''}${mark?.label ? `, ${mark.label}` : ''}`}
                style={({ pressed }) => ({
                  flex: 1, aspectRatio: 1, borderRadius: RADIUS.cell, padding: 6,
                  backgroundColor: mark?.bg || (inMonth && !weekend ? colors.cell : 'transparent'),
                  borderWidth: isSel ? 1.5 : 1,
                  borderColor: isSel ? colors.accent : isToday ? colors.accentBorder : mark ? 'transparent' : colors.cellBorder,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {!inMonth || (weekend && !mark) ? <Hatch color={colors.hatch} radius={RADIUS.cell} /> : null}
                <T size={12.5} weight={isToday || mark ? 'semibold' : 'regular'} style={{ fontVariant: ['tabular-nums'] }}
                  color={!inMonth ? colors.muted : mark?.fg || (isToday ? colors.accentFg : colors.text)}>
                  {day.getDate()}
                </T>
                {mark?.dot ? <View style={{ position: 'absolute', right: 6, bottom: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: mark.dot }} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Glass pill "‹ Octubre ›" that moves a month cursor (first day of the month). */
export function MonthSwitcher({ value, onChange, style }) {
  const { colors } = useTheme();
  const y = value.getFullYear();
  const m = value.getMonth();
  const label = `${cap(MONTHS[m])}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
  const btn = (Icon, delta, a11y) => (
    <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(new Date(y, m + delta, 1)); }}
      accessibilityRole="button" accessibilityLabel={a11y} hitSlop={8}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.neutralSoft : 'transparent' })}>
      <Icon size={17} color={colors.text2} strokeWidth={2} />
    </Pressable>
  );
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: 21, paddingHorizontal: 4 }, style]}>
      <GlassFill radius={21} sheen={false} />
      {btn(ChevronLeft, -1, 'Mes anterior')}
      <T size={13.5} weight="semibold" align="center" numberOfLines={1} style={{ minWidth: 78 }}>{label}</T>
      {btn(ChevronRight, 1, 'Mes siguiente')}
    </View>
  );
}

/** The hairline Margube leaf in a tile's corner. */
const TileLeaf = memo(function TileLeaf({ size = 64, color = 'rgba(255,255,255,0.28)' }) {
  return (
    <Svg pointerEvents="none" width={size} height={size} viewBox="0 0 48 48" style={{ position: 'absolute', top: -6, right: -6 }}>
      <Path d={LEAF_PATH} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d={VEIN_PATH} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
});

function TileShell({ onPress, accessibilityLabel, style, children }) {
  const s = [{ borderRadius: RADIUS.tile, padding: 16, minHeight: 128, overflow: 'hidden' }, style];
  if (onPress) return <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} scaleTo={0.97} style={s}>{children}</PressScale>;
  return <View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={s}>{children}</View>;
}

/** Brand-blue tile: the one highlighted fact of a bento row (days left, birthday…). */
export function AccentTile({ icon: Icon, label, value, sub, onPress, style, accessibilityLabel, children }) {
  return (
    <TileShell onPress={onPress} accessibilityLabel={accessibilityLabel || [label, value, sub].filter(Boolean).join(', ')} style={style}>
      <GradientFill radius={RADIUS.tile} colors={[BRAND.blueLight, BRAND.blue]} vertical />
      <TileLeaf />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 30 }}>
        {Icon ? <Icon size={15} color="#FFFFFF" strokeWidth={2} /> : null}
        <T size={13} weight="medium" color="rgba(255,255,255,0.9)" numberOfLines={1} style={{ flexShrink: 1 }}>{label}</T>
      </View>
      <View style={{ flex: 1, minHeight: 12 }} />
      <T size={30} weight="light" color="#FFFFFF" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{value}</T>
      {sub ? <T size={12.5} color="rgba(255,255,255,0.74)" numberOfLines={1}>{sub}</T> : null}
      {children}
    </TileShell>
  );
}

/** Glass tile with a small label and its value at the bottom (phone, balance…). */
export function InfoTile({ icon: Icon, label, value, sub, valueColor, mono, onPress, style, accessibilityLabel, children }) {
  const { colors } = useTheme();
  return (
    <TileShell onPress={onPress} accessibilityLabel={accessibilityLabel || [label, value, sub].filter(Boolean).join(', ')} style={style}>
      <GlassFill radius={RADIUS.tile} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {Icon ? <Icon size={15} color={colors.text2} strokeWidth={2} /> : null}
        <T size={13} weight="medium" color={colors.text2} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</T>
      </View>
      <View style={{ flex: 1, minHeight: 12 }} />
      {value != null ? (
        <T size={mono ? 17 : 22} weight={mono ? 'semibold' : 'light'} mono={mono} color={valueColor} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      ) : null}
      {sub ? <T size={12.5} color={colors.text3} numberOfLines={1}>{sub}</T> : null}
      {children}
    </TileShell>
  );
}

/**
 * Tinted pill for a file or a destination: icon plate, title and size line, round action at the end.
 * tone: [background, foreground] from tone().
 */
export function FileChip({ icon: Icon, action: Action, title, sub, tone, badge, onPress, accessibilityLabel, style }) {
  const { colors } = useTheme();
  const [bg, fg] = tone || [colors.neutralSoft, colors.text2];
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} scaleTo={0.97}
      style={[{ flex: 1, minWidth: 0, minHeight: 64, borderRadius: 32, padding: 8, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: bg }, style]}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={fg} strokeWidth={2} />
        {badge ? (
          <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <T size={10} weight="bold" color="#FFFFFF" style={{ lineHeight: 12 }}>{badge > 99 ? '99+' : badge}</T>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={14} weight="semibold" numberOfLines={1}>{title}</T>
        {sub ? <T size={12} color={colors.text3} numberOfLines={1}>{sub}</T> : null}
      </View>
      {Action ? (
        <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: fg, alignItems: 'center', justifyContent: 'center' }}>
          <Action size={15} color={fg} strokeWidth={2.2} />
        </View>
      ) : null}
    </PressScale>
  );
}

/**
 * Tall hero card: the person's photo (or the brand gradient with a large initial) fading
 * into dark at the bottom, where the name sits. `top` overlays the corners (back, actions).
 */
export function PhotoHero({ src, fallback, height = 380, top, children }) {
  return (
    <View style={{ height, borderRadius: 34, overflow: 'hidden', backgroundColor: BRAND.navy }}>
      {src ? (
        <Image source={{ uri: src }} style={FILL} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <>
          <LinearGradient colors={['#7AA2FF', BRAND.blue, '#1B2C6E', BRAND.navy]} locations={[0, 0.4, 0.8, 1]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={FILL} />
          <View style={[FILL, { alignItems: 'center', justifyContent: 'center', paddingBottom: height * 0.2 }]}>{fallback}</View>
        </>
      )}
      <LinearGradient pointerEvents="none" colors={['rgba(10,12,16,0.28)', 'rgba(10,12,16,0)', 'rgba(10,12,16,0.25)', 'rgba(10,12,16,0.82)']}
        locations={[0, 0.22, 0.55, 1]} style={FILL} />
      {top ? (
        <View style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>{top}</View>
      ) : null}
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20, alignItems: 'center', gap: 6 }}>{children}</View>
    </View>
  );
}
