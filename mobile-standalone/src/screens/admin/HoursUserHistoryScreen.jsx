// Historial de horas de un empleado (detail modal of the web HorasPage > Usuarios)
import { useMemo } from 'react';
import { View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Download, Timer } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { Screen } from '../../components/common/Screen';
import { Header } from '../../components/common/Header';
import { GlassCard } from '../../components/common/GlassCard';
import { IconButton } from '../../components/common/GlassButton';
import { T } from '../../components/common/Text';
import { EmptyState } from '../../components/common/UI';
import { HourRow, exportHoursCsv } from '../HorasScreen';
import { hourStats } from '../../utils/domain';
import { fmtHM, fmtHMSigned, toISODate } from '../../utils/format';

export default function HoursUserHistoryScreen() {
  const { colors } = useTheme();
  const { params } = useRoute();
  const toast = useToast();
  const { employees } = useAuth();
  const { hourCompensations } = useData();
  const emp = employees.find((e) => String(e.id) === String(params?.id));
  const history = useMemo(() => hourCompensations
    .filter((h) => String(h.employeeId) === String(params?.id))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')), [hourCompensations, params?.id]);
  const s = hourStats(history);
  const balance = s.bolsa + s.ya - s.debe;

  return (
    <Screen>
      <Header back title={emp?.name || 'Empleado'} subtitle={emp?.dept}
        right={history.length ? <IconButton icon={Download} accessibilityLabel="Descargar CSV" onPress={async () => {
          try { await exportHoursCsv(history, `horas-${(emp?.name || 'empleado').replace(/\s+/g, '_')}-${toISODate(new Date())}.csv`); } catch (e) { toast.error(toUserMessage(e)); }
        }} /> : null} />

      <GlassCard radius={24} style={{ gap: 12 }} strong>
        <T size={13} color={colors.text3}>Balance neto</T>
        <T mono weight="semibold" size={40} color={balance < 0 ? colors.dangerFg : colors.text} numberOfLines={1} adjustsFontSizeToFit>{fmtHMSigned(balance)}</T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[['En bolsa', s.bolsa, colors.accentFg], ['Pendiente', s.pending, colors.warningFg], ['Debo', s.debe, colors.dangerFg], ['Ya', s.ya, colors.successFg]].map(([l, v, c]) => (
            <View key={l} style={{ flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.segTrack, alignItems: 'center' }}>
              <T mono weight="semibold" size={13.5} color={c} numberOfLines={1} adjustsFontSizeToFit>{fmtHM(v)}</T>
              <T size={10.5} color={colors.text3} numberOfLines={1}>{l}</T>
            </View>
          ))}
        </View>
      </GlassCard>

      <View style={{ gap: 8 }}>
        {history.length === 0 ? <EmptyState icon={Timer} title="No hay registros para este usuario" /> : history.map((h) => <HourRow key={h.id} h={h} />)}
      </View>
    </Screen>
  );
}
