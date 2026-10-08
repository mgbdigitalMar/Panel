import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { PressScale } from './Pressable';
import { T } from './Text';

/** Extended floating action button, pinned above the tab bar (design 07). */
export function Fab({ onPress, label = 'Nueva solicitud', icon: Icon = Plus, compact }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        position: 'absolute', right: 16, bottom: Math.max(insets.bottom, 12) + 88,
        height: 56, minWidth: 56, paddingHorizontal: compact ? 0 : 18, borderRadius: 18, backgroundColor: colors.accent,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8,
      }}
    >
      <Icon size={22} color={colors.onAccent} strokeWidth={2.2} />
      {compact ? null : <T size={15} weight="semibold" color={colors.onAccent}>{label}</T>}
    </PressScale>
  );
}
