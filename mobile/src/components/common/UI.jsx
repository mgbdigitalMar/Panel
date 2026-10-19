// Smaller building blocks, styled after the web's components (src/components/ui, styles/_patterns.scss).
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Inbox, X, Info, AlertTriangle, ArrowRight, ArrowUpRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { tone as toneOf, glassSurface, BRAND } from '../../theme/tokens';
import { initials as toInitials, avatarColor } from '../../utils/format';
import { PressScale } from './Pressable';
import { T } from './Text';
import { GradientFill, leafRadii } from './Brand';
import { GlassFill } from './LiquidGlass';

/**
 * Segmented tabs: a liquid-glass pill track; the active option is a lighter glass pill.
 * options: [{ value, label, color? }] — `color` recolours that option's active label.
 */
export function Segmented({ options, value, onChange, height = 44, style }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[{ flexDirection: 'row', padding: 4, gap: 2, borderRadius: height / 2 + 4 }, style]}
    >
      <GlassFill radius={height / 2 + 4} />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => { if (!on) { Haptics.selectionAsync().catch(() => {}); onChange(o.value); } }}
            style={({ pressed }) => ({
              flex: 1, minWidth: 0, height: height - 8, borderRadius: (height - 8) / 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
              backgroundColor: on ? colors.segOn : pressed ? colors.neutralSoft : 'transparent',
              borderWidth: on ? 1 : 0, borderColor: colors.glassBorder,
            })}
          >
            <T size={14} weight={on ? 'semibold' : 'medium'} color={on ? (o.color || colors.segOnText) : colors.text3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontal rail of filter chips (departments, categories, status). */
export function ChipRail({ options, value, onChange, style }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ marginHorizontal: -20, flexGrow: 0 }, style]}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => { if (!on) { Haptics.selectionAsync().catch(() => {}); onChange(o.value); } }}
            style={{
              height: 36, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6,
              ...(on ? { backgroundColor: colors.chipOnBg, borderWidth: 1, borderColor: colors.chipOnBg } : glassSurface(colors)),
            }}
          >
            <T size={13} weight="semibold" color={on ? colors.chipOnText : colors.text2}>{o.label}</T>
            {o.count != null ? (
              <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.24)' : colors.neutralSoft }}>
                <T size={11} weight="bold" color={on ? colors.chipOnText : colors.text2} style={{ lineHeight: 13, fontVariant: ['tabular-nums'] }}>{o.count}</T>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Person avatar in the Margube leaf shape; shows the photo when there is one. */
export function Avatar({ name, initials, src, size = 42, color, ring, style }) {
  const bg = color || avatarColor(name);
  const avatar = (
    <View
      accessibilityLabel={name || undefined}
      style={[{ width: size, height: size, ...leafRadii(size), backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, !ring && style]}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
      ) : (
        <T size={Math.round(size * 0.36)} weight="semibold" heading color="#11141B" style={{ lineHeight: Math.round(size * 0.46) }}>{initials || toInitials(name)}</T>
      )}
    </View>
  );
  if (!ring) return avatar;
  // Leaf outline around the avatar (profile identity, like the web's sidebar)
  const pad = 3;
  return (
    <View style={[{ padding: pad, ...leafRadii(size + pad * 2), borderWidth: 1.5, borderColor: ring }, style]}>{avatar}</View>
  );
}

/** Round icon tinted by tone; `solid` fills it with the tone (the active item, like the reference). Tone ('accent' | 'teal' | 'amber' | 'green' | 'rose' | 'purple'). */
export function IconTile({ icon: Icon, tone = 'accent', size = 40, radius, solid }) {
  const { colors } = useTheme();
  const [bg, fg] = toneOf(colors, tone);
  return (
    <View style={{ width: size, height: size, borderRadius: radius ?? size / 2, backgroundColor: solid ? fg : bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(size * 0.46)} color={solid ? colors.bg : fg} strokeWidth={1.9} />
    </View>
  );
}

/**
 * Quick-access grid: liquid-glass tiles that share the full width — two columns on phones,
 * four once there is room. items: [{ key, icon, tone, label, sub, badge, onPress }]
 */
export function ActionGrid({ items, gap = 10, style }) {
  const [width, setWidth] = useState(0);
  const cols = width >= 560 ? 4 : 2;
  const tileW = width ? Math.floor((width - gap * (cols - 1)) / cols) : 0;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}
    >
      {tileW ? items.map(({ key, ...it }) => <ActionTile key={key || it.label} {...it} width={tileW} />) : null}
    </View>
  );
}

function ActionTile({ icon, tone = 'accent', label, sub, badge, onPress, width }) {
  const { colors } = useTheme();
  const radius = 22;
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[label, sub, badge ? `${badge} pendientes` : null].filter(Boolean).join(', ')}
      scaleTo={0.96}
      style={{ width, minHeight: 112, borderRadius: radius, padding: 14, gap: 12, justifyContent: 'space-between' }}
    >
      <GlassFill radius={radius} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <IconTile icon={icon} tone={tone} size={40} />
        {badge ? (
          <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <T size={12} weight="bold" color="#FFFFFF" style={{ lineHeight: 14 }}>{badge > 99 ? '99+' : badge}</T>
          </View>
        ) : (
          <ArrowUpRight size={18} color={colors.text3} strokeWidth={2} />
        )}
      </View>
      <View style={{ gap: 2 }}>
        <T size={15} weight="semibold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</T>
        {sub ? <T size={12.5} color={colors.text3} numberOfLines={1}>{sub}</T> : null}
      </View>
    </PressScale>
  );
}

/** Text tabs with superscript counts (reference: All Courses¹² Completed⁷). options: [{ value, label, count }] */
export function CountTabs({ options, value, onChange, style }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ marginHorizontal: -20, flexGrow: 0 }, style]}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 22 }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.count != null ? `${o.label}, ${o.count}` : o.label}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            onPress={() => { if (!on) { Haptics.selectionAsync().catch(() => {}); onChange(o.value); } }}
            style={{ minHeight: 36, justifyContent: 'center' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <T size={15} weight={on ? 'semibold' : 'regular'} color={on ? colors.text : colors.text3}>{o.label}</T>
              {o.count != null ? (
                <T size={10.5} weight="semibold" color={on ? colors.accentFg : colors.text3} style={{ marginLeft: 2, marginTop: -2, lineHeight: 13 }}>{o.count}</T>
              ) : null}
            </View>
            <View style={{ height: 2, marginTop: 4, borderRadius: 1, backgroundColor: on ? colors.accent : 'transparent', width: 16 }} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Progress ring (reference: the day rings). `value` 0–100; children sit in the middle. */
export function Ring({ value = 0, size = 44, stroke = 3.5, color, track, children, accessibilityLabel }) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track || colors.ringTrack} strokeWidth={stroke} fill="none" />
        {pct > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color || colors.accent} strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/**
 * Glass card with the brand blue washing in from the top-left (reference: the highlighted schedule card).
 * Use for the one item that is "now" in a list; the rest stay plain glass.
 */
export function WashCard({ children, onPress, radius = 24, padding = 16, style, accessibilityLabel }) {
  const { colors } = useTheme();
  const body = (
    <>
      <LinearGradient pointerEvents="none" colors={colors.wash} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius }} />
      {children}
    </>
  );
  const s = [{ borderRadius: radius, padding, ...glassSurface(colors), borderColor: colors.accentBorder, overflow: 'hidden' }, style];
  if (onPress) return <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} scaleTo={0.98} style={s}>{body}</PressScale>;
  return <View style={s}>{body}</View>;
}

/** Small time/status pill used at the bottom of agenda cards (reference: 11:30 AM). */
export function Pill({ label, mono, tone }) {
  const { colors } = useTheme();
  const [bg, fg] = tone ? toneOf(colors, tone) : [colors.segOn, colors.text];
  return (
    <View style={{ alignSelf: 'flex-start', height: 28, paddingHorizontal: 11, borderRadius: 14, justifyContent: 'center', backgroundColor: bg, borderWidth: tone ? 0 : 1, borderColor: colors.glassBorder }}>
      <T size={12.5} weight="semibold" mono={mono} color={fg} numberOfLines={1}>{label}</T>
    </View>
  );
}

/** List row: [left] title/subtitle [right]. Use `first`/`last` to build grouped lists. */
export function Row({ left, title, subtitle, right, onPress, first = true, last = true, style, titleWeight = 'semibold', subtitleLines = 2, accessibilityLabel }) {
  const { colors } = useTheme();
  const radius = { tl: first ? 18 : 6, bl: last ? 18 : 6 };
  const content = (
    <>
      {left}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        {typeof title === 'string' ? <T size={15} weight={titleWeight} numberOfLines={2}>{title}</T> : title}
        {typeof subtitle === 'string' ? <T size={13} color={colors.text3} numberOfLines={subtitleLines}>{subtitle}</T> : subtitle}
      </View>
      {right}
    </>
  );
  const s = [{
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 14, minHeight: 64,
    ...glassSurface(colors),
    ...(first ? null : { borderTopColor: colors.glassBorder }),
    borderTopLeftRadius: radius.tl, borderTopRightRadius: radius.tl, borderBottomLeftRadius: radius.bl, borderBottomRightRadius: radius.bl,
  }, style];
  if (onPress) {
    return (
      <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} scaleTo={0.985} style={s}>{content}</PressScale>
    );
  }
  return <View style={s}>{content}</View>;
}

/** Section heading that sits on the screen, above its cards (web: SectionHead + "Ver todo →"). */
export function SectionHead({ title, action, onAction, icon: Icon, count, style }) {
  const { colors } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 32 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        {Icon ? <Icon size={18} color={colors.accentFg} strokeWidth={2} /> : null}
        <T size={18} weight="semibold" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>{title}</T>
        {count != null ? (
          <View style={{ minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' }}>
            <T size={11.5} weight="bold" color={colors.text2} style={{ lineHeight: 14 }}>{count}</T>
          </View>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: pressed ? colors.accentSoft : 'transparent' })}>
          <T size={13.5} weight="semibold" color={colors.accentFg}>{action}</T>
          <ArrowRight size={14} color={colors.accentFg} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Thin progress bar; `gradient` paints the fill with the CTA gradient (web: workday bar). */
export function ProgressBar({ value = 0, color, track, height = 6, gradient, accessibilityLabel }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height, borderRadius: height / 2, backgroundColor: track || colors.segTrack, overflow: 'hidden' }}
    >
      {pct > 0 ? (
        <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: gradient ? 'transparent' : (color || colors.accent), overflow: 'hidden' }}>
          {gradient ? <GradientFill radius={height / 2} colors={[BRAND.blue, '#5B7CFF', '#7AA2FF']} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 10 }}>
      <View style={{ width: 64, height: 64, ...leafRadii(64), backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Icon size={28} color={colors.accentFg} strokeWidth={1.8} />
      </View>
      <T size={17} weight="semibold" align="center">{title}</T>
      {message ? <T size={14} color={colors.text3} align="center" style={{ maxWidth: 300 }}>{message}</T> : null}
      {action ? <View style={{ marginTop: 6 }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label = 'Cargando…' }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.accent} />
      <T size={13} color={colors.text3}>{label}</T>
    </View>
  );
}

/** Info / warning / danger banner. */
export function Banner({ tone = 'accent', title, children, icon }) {
  const { colors } = useTheme();
  const [bg, fg] = toneOf(colors, tone);
  const Icon = icon || (tone === 'danger' || tone === 'rose' || tone === 'amber' || tone === 'warning' ? AlertTriangle : Info);
  return (
    <View
      accessibilityRole={tone === 'danger' || tone === 'rose' ? 'alert' : undefined}
      style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: bg }}
    >
      <Icon size={18} color={fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <T size={14} weight="semibold" color={fg}>{title}</T> : null}
        {typeof children === 'string' ? <T size={13.5} color={colors.text2}>{children}</T> : children}
      </View>
    </View>
  );
}

export function Checkbox({ checked, onChange, label, disabled }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => { if (!disabled) { Haptics.selectionAsync().catch(() => {}); onChange(!checked); } }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      hitSlop={6}
      style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', opacity: disabled ? 0.5 : 1, minHeight: 28 }}
    >
      <View style={{
        width: 24, height: 24, borderRadius: 8, marginTop: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: checked ? colors.accent : colors.inputBg, borderWidth: checked ? 0 : 1.5, borderColor: colors.glassBorderStrong,
      }}
      >
        {checked ? <Check size={16} color={colors.onAccent} strokeWidth={3} /> : null}
      </View>
      <T size={14} color={checked ? colors.text : colors.text2} style={{ flex: 1 }}>{label}</T>
    </Pressable>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, format = (v) => String(v), label }) {
  const { colors } = useTheme();
  const btn = (txt, next, a11y, filled) => {
    const blocked = next < min || next > max;
    return (
      <PressScale
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(Math.max(min, Math.min(max, next))); }}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={{ width: 44, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? colors.accent : colors.glassFill }}
      >
        <T size={20} weight="medium" color={filled ? colors.onAccent : colors.text} style={{ lineHeight: 24 }}>{txt}</T>
      </PressScale>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 24, backgroundColor: colors.segTrack }}
      accessibilityLabel={label}>
      {btn('−', value - step, 'Menos', false)}
      <T mono weight="semibold" size={15} style={{ minWidth: 40, textAlign: 'center' }}>{format(value)}</T>
      {btn('+', value + step, 'Más', true)}
    </View>
  );
}

export function SwitchRow({ title, subtitle, value, onValueChange, disabled }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 56 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15} weight="medium">{title}</T>
        {subtitle ? <T size={12.5} color={colors.text3}>{subtitle}</T> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.segTrack, true: colors.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.segTrack}
        accessibilityLabel={title}
      />
    </View>
  );
}

/** Bottom sheet modal (Confirmar reserva, Editar sala…). */
export function Sheet({ visible, onClose, title, children, footer }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" />
      <View style={{
        maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.sheetBg,
        borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: colors.glassBorder,
        paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 12,
      }}
      >
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.glassBorderStrong }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 }}>
          <T size={20} weight="semibold" style={{ flex: 1 }} accessibilityRole="header">{title}</T>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={8}
            style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: pressed ? colors.segTrack : colors.glassStrong, alignItems: 'center', justifyContent: 'center' })}>
            <X size={18} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 16 }}>
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: 20, gap: 10 }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

export function Divider({ inset = 0 }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, marginLeft: inset, backgroundColor: colors.divider }} />;
}

/** Key/value line used in detail screens. */
export function InfoLine({ label, value, mono, last }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.divider }}>
      <T size={14} color={colors.text3}>{label}</T>
      <T size={14} weight="medium" mono={mono} style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>{value || '—'}</T>
    </View>
  );
}
