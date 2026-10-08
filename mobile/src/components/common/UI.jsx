// Smaller building blocks from the design file.
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Inbox, X, Info, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { tone as toneOf } from '../../theme/tokens';
import { initials as toInitials, avatarColor } from '../../utils/format';
import { PressScale } from './Pressable';
import { T } from './Text';

/** Segmented control (Ya / Bolsa / Debo, Semana / Mes…). options: [{ value, label, color? }] */
export function Segmented({ options, value, onChange, height = 40, style }) {
  const { colors, theme } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.segTrack, borderWidth: 1, borderColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'transparent' }, style]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => { if (!on) { Haptics.selectionAsync().catch(() => {}); onChange(o.value); } }}
            style={{
              flex: 1, height: height - 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? colors.segOn : 'transparent',
              ...(on ? { shadowColor: '#000', shadowOpacity: theme === 'dark' ? 0.35 : 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 } : null),
            }}
          >
            <T size={14} weight={on ? 'semibold' : 'medium'} color={on ? (o.color || colors.segOnText) : colors.text2} numberOfLines={1}>{o.label}</T>
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ marginHorizontal: -20 }, style]}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(o.value); }}
            style={{
              height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center',
              backgroundColor: on ? colors.chipOnBg : colors.glass,
              borderWidth: on ? 0 : 1, borderColor: colors.glassBorderStrong,
            }}
          >
            <T size={13} weight={on ? 'semibold' : 'medium'} color={on ? colors.chipOnText : colors.text2}>
              {o.label}{o.count != null ? ` · ${o.count}` : ''}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Avatar({ name, initials, size = 42, color, style }) {
  const bg = color || avatarColor(name);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <T size={Math.round(size * 0.34)} weight="bold" color="#11141B">{initials || toInitials(name)}</T>
    </View>
  );
}

/** Rounded icon tile tinted by tone ('accent' | 'teal' | 'amber' | 'green' | 'rose' | 'purple'). */
export function IconTile({ icon: Icon, tone = 'accent', size = 40, radius = 13 }) {
  const { colors } = useTheme();
  const [bg, fg] = toneOf(colors, tone);
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(size * 0.5)} color={fg} strokeWidth={1.8} />
    </View>
  );
}

/** List row: [left] title/subtitle [right]. Use `first`/`last` to build grouped lists. */
export function Row({ left, title, subtitle, right, onPress, first = true, last = true, style, titleWeight = 'semibold', subtitleLines = 2 }) {
  const { colors } = useTheme();
  const radius = { tl: first ? 20 : 6, bl: last ? 20 : 6 };
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
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    borderTopLeftRadius: radius.tl, borderTopRightRadius: radius.tl, borderBottomLeftRadius: radius.bl, borderBottomRightRadius: radius.bl,
  }, style];
  if (onPress) return <PressScale onPress={onPress} accessibilityRole="button" style={s}>{content}</PressScale>;
  return <View style={s}>{content}</View>;
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 10 }}>
      <IconTile icon={Icon} tone="accent" size={56} radius={18} />
      <T size={17} weight="semibold" style={{ textAlign: 'center' }}>{title}</T>
      {message ? <T size={14} color={colors.text3} style={{ textAlign: 'center' }}>{message}</T> : null}
      {action ? <View style={{ marginTop: 6 }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label = 'Cargando…' }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.accent} />
      <T size={13} color={colors.text3}>{label}</T>
    </View>
  );
}

/** Info / warning / danger banner. */
export function Banner({ tone = 'accent', title, children, icon }) {
  const { colors } = useTheme();
  const [bg, fg] = toneOf(colors, tone);
  const Icon = icon || (tone === 'danger' || tone === 'rose' ? AlertTriangle : tone === 'amber' || tone === 'warning' ? AlertTriangle : Info);
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, backgroundColor: bg }}>
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
      onPress={() => !disabled && onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', opacity: disabled ? 0.5 : 1 }}
    >
      <View style={{
        width: 24, height: 24, borderRadius: 8, marginTop: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: checked ? colors.accent : 'transparent', borderWidth: checked ? 0 : 1.5, borderColor: colors.text3,
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
  const btn = (txt, next, a11y, filled) => (
    <PressScale
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(Math.max(min, Math.min(max, next))); }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ width: 44, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? colors.segOn : 'transparent' }}
    >
      <T size={20} weight="medium">{txt}</T>
    </PressScale>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 14, backgroundColor: colors.segTrack }}
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.glass }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15}>{title}</T>
        {subtitle ? <T size={12.5} color={colors.text3}>{subtitle}</T> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.segTrack, true: '#34C77B' }}
        thumbColor="#FFFFFF"
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
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={{
        maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.sheetBg,
        borderTopLeftRadius: 30, borderTopRightRadius: 30, borderTopWidth: 1, borderColor: colors.glassBorderStrong,
        paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 12, shadowColor: '#000000',
        shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.35, shadowRadius: 22, elevation: 20,
      }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.text3, opacity: 0.5 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 }}>
          <T size={22} weight="semibold" style={{ flex: 1 }}>{title}</T>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={8}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center' }}>
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

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.divider }} />;
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
