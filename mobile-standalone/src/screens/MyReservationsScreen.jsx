// Historial de reservas (table + actions of the web ReservationsPage)
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Building2, Car, Check, X, Trash2, Download, CalendarX } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton, IconButton } from '../components/common/GlassButton';
import { StatusBadge } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { ChipRail, EmptyState, IconTile, Segmented } from '../components/common/UI';
import { reservationStatusLabel, reservationTone } from '../utils/domain';
import { fmtDayShort, todayISO, toISODate } from '../utils/format';
import { exportCsv } from '../services/files';

export default function MyReservationsScreen() {
  const { colors } = useTheme();
  const { params } = useRoute();
  const toast = useToast();
  const { user } = useAuth();
  const { reservations, setReservationStatus, deleteReservation, refresh } = useData();
  const isAdmin = user?.role === 'admin';
  const [scope, setScope] = useState(params?.scope === 'pending' && isAdmin ? 'pending' : params?.scope === 'all' ? 'all' : 'mine');
  const [type, setType] = useState('all');
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const today = todayISO();

  const list = useMemo(() => {
    const base = reservations.filter((r) => (scope === 'mine' ? r.employeeId === user?.id : scope === 'pending' ? r.status === 'pending' : true)
      && (type === 'all' || r.type === type)
      && (!params?.date || r.date === params.date));
    const upcoming = base.filter((r) => r.date >= today).sort((a, b) => (a.date + a.timeStart).localeCompare(b.date + b.timeStart));
    const past = base.filter((r) => r.date < today).sort((a, b) => (b.date + b.timeStart).localeCompare(a.date + a.timeStart));
    return { upcoming, past };
  }, [reservations, scope, type, user?.id, params, today]);

  const all = [...list.upcoming, ...list.past];

  const act = async (r, fn, ok) => {
    setBusy(r.id);
    const res = await fn();
    setBusy(null);
    if (res?.error) toast.error(toUserMessage(res.error));
    else if (ok) toast.success(ok);
  };

  const confirmDelete = (r) => Alert.alert('Eliminar reserva', '¿Seguro que quieres eliminar esta reserva? Esta acción no se puede deshacer.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: () => act(r, () => deleteReservation(r.id), 'Reserva eliminada') },
  ]);

  const exportList = async () => {
    try {
      await exportCsv(`reservas-${toISODate(new Date())}.csv`,
        ['Recurso', 'Tipo', 'Solicitante', 'Fecha', 'Horario', 'Propósito', 'Estado'],
        all.map((r) => [r.resourceName, r.type === 'vehicle' ? 'Vehículo' : 'Sala', r.employeeName || '—', r.date, `${r.timeStart}-${r.timeEnd}`, r.purpose || '', reservationStatusLabel(r.status)]));
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  const renderItem = (r) => {
    const mine = r.employeeId === user?.id;
    return (
      <GlassCard key={r.id} style={{ gap: 12 }} padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon={r.type === 'vehicle' ? Car : Building2} tone={r.type === 'vehicle' ? 'teal' : 'accent'} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={15} weight="semibold" numberOfLines={1}>{r.resourceName}</T>
            <T size={13} color={colors.text3} numberOfLines={1}>{fmtDayShort(r.date)} · {r.timeStart}–{r.timeEnd}</T>
          </View>
          <StatusBadge status={reservationTone(r.status)} label={reservationStatusLabel(r.status)} />
        </View>
        {r.purpose || !mine ? (
          <T size={13.5} color={colors.text2}>{!mine ? `${r.employeeName || 'Empleado'} · ` : ''}{r.purpose}</T>
        ) : null}
        {(isAdmin && r.status === 'pending') || isAdmin || mine ? (
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && r.status === 'pending' ? (
              <>
                <GlassButton title="Rechazar" icon={X} size="sm" variant="danger" disabled={busy === r.id}
                  onPress={() => act(r, () => setReservationStatus(r.id, 'cancelled'), 'Reserva cancelada')} />
                <GlassButton title="Aprobar" icon={Check} size="sm" disabled={busy === r.id}
                  onPress={() => act(r, () => setReservationStatus(r.id, 'confirmed'), 'Reserva aprobada')} />
              </>
            ) : null}
            <GlassButton icon={Trash2} size="sm" variant="glass" accessibilityLabel="Eliminar reserva" disabled={busy === r.id} onPress={() => confirmDelete(r)} />
          </View>
        ) : null}
      </GlassCard>
    );
  };

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing}>
      <Header back title={scope === 'mine' ? 'Mis reservas' : 'Reservas'}
        subtitle={params?.date ? `Día ${fmtDayShort(params.date)}` : undefined}
        right={all.length ? <IconButton icon={Download} onPress={exportList} accessibilityLabel="Descargar CSV" /> : null} />
      <Segmented
        value={scope}
        onChange={setScope}
        options={[
          { value: 'mine', label: 'Mías' },
          { value: 'all', label: 'Todas' },
          ...(isAdmin ? [{ value: 'pending', label: `Por aprobar · ${reservations.filter((r) => r.status === 'pending').length}` }] : []),
        ]}
      />
      <ChipRail value={type} onChange={setType} options={[{ value: 'all', label: 'Todas' }, { value: 'room', label: 'Salas' }, { value: 'vehicle', label: 'Vehículos' }]} />

      {all.length === 0 ? (
        <EmptyState icon={CalendarX} title="No hay reservas" message="No se han encontrado reservas con estos filtros." />
      ) : (
        <>
          {list.upcoming.length ? <T size={16} weight="semibold">Próximas</T> : null}
          {list.upcoming.map(renderItem)}
          {list.past.length ? <T size={16} weight="semibold" style={{ marginTop: 8 }}>Anteriores</T> : null}
          {list.past.map(renderItem)}
        </>
      )}
    </Screen>
  );
}
