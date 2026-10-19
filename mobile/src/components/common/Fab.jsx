import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientFill } from './Brand';
import { PressScale } from './Pressable';
import { T } from './Text';
import { TAB_BAR_HEIGHT } from '../../navigation/tabBarMetrics';

/** Extended floating action button in the CTA gradient, pinned above the tab bar. Flat, no shadow. */
export function Fab({ onPress, label = 'Nueva solicitud', icon: Icon = Plus, compact }) {
  const insets = useSafeAreaInsets();
  const size = 52; // same height as primary buttons
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        position: 'absolute', right: Math.max(20, insets.right + 12), bottom: Math.max(insets.bottom, 10) + TAB_BAR_HEIGHT + 16,
        height: size, minWidth: size, paddingHorizontal: compact ? 0 : 20, borderRadius: size / 2,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      <GradientFill radius={size / 2} />
      <Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
      {compact ? null : <T size={15} weight="semibold" color="#FFFFFF">{label}</T>}
    </PressScale>
  );
}
