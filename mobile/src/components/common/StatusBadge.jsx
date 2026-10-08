import { View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { tone as toneOf } from '../../theme/tokens';
import { T } from './Text';

const LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  confirmed: 'Aprobada',
  cancelled: 'Cancelada',
  signed: 'Firmado',
  completed: 'Completado',
};

/** Status pill: Pendiente / Aprobada / Rechazada / Cancelada… */
export function StatusBadge({ status, label, tone, small, style }) {
  const { colors } = useTheme();
  const t = tone || (status === 'cancelled' ? 'neutral' : status);
  const [bg, fg] = toneOf(colors, t);
  return (
    <View style={[{
      alignSelf: 'flex-start',
      paddingHorizontal: small ? 8 : 10,
      paddingVertical: small ? 2 : 5,
      borderRadius: small ? 6 : 999,
      backgroundColor: bg,
    }, style]}
    >
      <T size={small ? 11 : 12} weight="semibold" color={fg} numberOfLines={1}>{label || LABELS[status] || status}</T>
    </View>
  );
}

/** Small square tag (e.g. type of item in lists). */
export function Tag({ label, tone, style }) {
  return <StatusBadge label={label} tone={tone} small style={style} />;
}
