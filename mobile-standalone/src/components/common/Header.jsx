import { View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { IconButton } from './GlassButton';
import { T } from './Text';

/**
 * Large-title header (30-34/600) with optional back button, eyebrow, subtitle and right-side actions.
 * In root tabs (no back button), actions stay cleanly aligned side-by-side with the title.
 */
export function Header({ title, subtitle, eyebrow, back, right, onBack, size = 30 }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const goBack = onBack || (() => navigation.goBack());

  if (back) {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <IconButton icon={ChevronLeft} onPress={goBack} accessibilityLabel="Volver" />
          {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{right}</View> : null}
        </View>
        {title || subtitle || eyebrow ? (
          <View style={{ gap: 4 }}>
            {eyebrow ? <T size={13} weight="semibold" color={colors.accentFg} upper>{eyebrow}</T> : null}
            {title ? <T size={size} weight="semibold" accessibilityRole="header">{title}</T> : null}
            {subtitle ? <T size={13.5} color={colors.text3}>{subtitle}</T> : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 4 }}>
      {eyebrow ? <T size={13} weight="semibold" color={colors.accentFg} upper>{eyebrow}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 10 }}>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          {title ? <T size={size} weight="semibold" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>{title}</T> : null}
          {subtitle ? <T size={13.5} color={colors.text3} numberOfLines={1}>{subtitle}</T> : null}
        </View>
        {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>{right}</View> : null}
      </View>
    </View>
  );
}

/** Modal-style header: "Cancelar · Title · Action" (Nueva solicitud, Registrar horas). */
export function ModalHeader({ title, onCancel, actionLabel, onAction, actionDisabled, cancelLabel = 'Cancelar' }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
      <Pressable onPress={onCancel || (() => navigation.goBack())} hitSlop={10} accessibilityRole="button" style={{ flex: 1 }}>
        <T size={16} weight="medium" color={colors.accentFg}>{cancelLabel}</T>
      </Pressable>
      <T size={17} weight="semibold" style={{ textAlign: 'center' }}>{title}</T>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {actionLabel ? (
          <Pressable onPress={onAction} disabled={actionDisabled} hitSlop={10} accessibilityRole="button">
            <T size={16} weight="semibold" color={actionDisabled ? colors.muted : colors.accentFg}>{actionLabel}</T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
