// 08 · Reservas: elegir recurso y crear nueva reserva
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Building2, Car, Search, CalendarCheck, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton } from '../components/common/GlassButton';
import { GlassInput, DateField, TimeField } from '../components/common/GlassInput';
import { StatusBadge, Tag } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { EmptyState, IconTile, Segmented, Sheet } from '../components/common/UI';
import { FONTS } from '../theme/tokens';
import { availabilityNow, findConflicts, reservationsFor } from '../utils/domain';
import { timeToMin, todayISO } from '../utils/format';

export default function ReservationsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const { user } = useAuth();
  const { rooms, vehicles, reservations, createReservation, refresh } = useData();
  const [tab, setTab] = useState(route.params?.tab === 'vehicle' ? 'vehicle' : 'room');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  // Quick booking sheet state
  const [sheet, setSheet] = useState(false);
  const [bookType, setBookType] = useState('room');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ date: todayISO(), start: '09:00', end: '10:00', purpose: '' });
  const [sending, setSending] = useState(false);

  // Follow the tab requested by quick actions on Inicio.
  useEffect(() => {
    if (route.params?.tab && (route.params.tab === 'vehicle' || route.params.tab === 'room')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(route.params.tab);
    }
  }, [route.params?.tab]);
  // Re-evaluate "Libre / Hasta HH:MM" every minute.
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  const isAdmin = user?.role === 'admin';
  const visibleRooms = rooms.filter((r) => r.isActive || isAdmin);
  const visibleVehicles = vehicles.filter((v) => v.isActive || isAdmin);
  const myUpcoming = reservations.filter((r) => r.employeeId === user?.id && r.status !== 'cancelled' && r.date >= todayISO()).length;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (tab === 'room') {
      return visibleRooms.filter((r) => !needle || r.name.toLowerCase().includes(needle) || (r.equipment || []).some((e) => e.toLowerCase().includes(needle)));
    }
    return visibleVehicles.filter((v) => !needle || `${v.model} ${v.plate} ${v.type}`.toLowerCase().includes(needle));
  }, [tab, q, visibleRooms, visibleVehicles]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Open booking sheet helper
  const openBookingSheet = (type = tab, resourceId = null) => {
    const nextType = type === 'vehicle' ? 'vehicle' : 'room';
    const pool = nextType === 'room' ? visibleRooms : visibleVehicles;
    const initialId = resourceId ?? (pool[0]?.id || null);

    const now = new Date();
    const currentH = now.getHours();
    const nextH = Math.min(19, Math.max(8, currentH + 1));
    const startStr = `${String(nextH).padStart(2, '0')}:00`;
    const endStr = `${String(nextH + 1).padStart(2, '0')}:00`;

    setBookType(nextType);
    setSelectedId(initialId);
    setForm({
      date: todayISO(),
      start: startStr,
      end: endStr,
      purpose: '',
    });
    setSheet(true);
  };

  // Resources available for the selected type in the booking sheet
  const activeResources = bookType === 'room' ? visibleRooms : visibleVehicles;
  const currentResource = activeResources.find((r) => String(r.id) === String(selectedId)) || activeResources[0];

  // Conflict validation for the booking sheet
  const resourceReservations = (currentResource && form.date)
    ? reservationsFor(reservations, { type: bookType, resourceId: currentResource.id, date: form.date })
    : [];
  const invalidRange = form.start && form.end && timeToMin(form.end) <= timeToMin(form.start);
  const conflicts = form.start && form.end && !invalidRange && currentResource
    ? findConflicts(resourceReservations, form.start, form.end)
    : [];
  const isPast = form.date && form.date < todayISO();
  const canSubmit = currentResource && form.date && !isPast && !invalidRange && conflicts.length === 0;

  const handleCreateReservation = async () => {
    if (!canSubmit || !currentResource) return;
    setSending(true);
    const resTitle = bookType === 'room' ? currentResource.name : `${currentResource.model} (${currentResource.plate})`;
    const res = await createReservation({
      type: bookType,
      [bookType === 'room' ? 'room_id' : 'vehicle_id']: currentResource.id,
      date: form.date,
      time_start: form.start,
      time_end: form.end,
      purpose: form.purpose?.trim() || (bookType === 'room' ? 'Reserva de sala' : 'Uso de vehículo'),
      status: 'pending',
      resourceName: resTitle,
    });
    setSending(false);
    if (res?.error) {
      toast.error(toUserMessage(res.error));
      return;
    }
    setSheet(false);
    toast.success('Reserva solicitada', 'Tu solicitud ha sido registrada y está pendiente de confirmación.');
    await refresh();
  };

  return (
    <Screen tabBarSpace onRefresh={onRefresh} refreshing={refreshing}>
      <Header
        title="Reservas"
        right={(
          <GlassButton
            title={myUpcoming ? `Mis reservas (${myUpcoming})` : 'Mis reservas'}
            icon={CalendarCheck}
            variant="glass"
            size="sm"
            onPress={() => navigation.navigate('MyReservations', { scope: 'mine' })}
          />
        )}
      />

      <Segmented
        value={tab}
        onChange={(val) => {
          setTab(val);
        }}
        options={[
          { value: 'room', label: `Salas · ${visibleRooms.length}` },
          { value: 'vehicle', label: `Vehículos · ${visibleVehicles.length}` },
        ]}
      />

      <View style={{ justifyContent: 'center' }}>
        <Search size={18} color={colors.text3} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={tab === 'room' ? 'Buscar por nombre o equipamiento' : 'Buscar por modelo o matrícula'}
          placeholderTextColor={colors.muted}
          accessibilityLabel="Buscar recurso"
          style={{
            height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.glassBorderStrong, backgroundColor: colors.inputBg,
            color: colors.text, fontFamily: FONTS.regular, fontSize: 15, paddingLeft: 42, paddingRight: 14,
          }}
        />
      </View>

      <View style={{ gap: 12 }}>
        {list.length === 0 ? (
          <EmptyState
            icon={tab === 'room' ? Building2 : Car}
            title={q ? 'Sin resultados' : tab === 'room' ? 'No hay salas' : 'No hay vehículos'}
            message={q ? 'Prueba con otra búsqueda.' : isAdmin ? 'Puedes darlos de alta en Más > Salas y flota.' : 'Aún no se ha dado de alta ninguno.'}
          />
        ) : tab === 'room' ? list.map((r) => {
          const a = availabilityNow(reservations, 'room', r.id);
          return (
            <GlassCard key={r.id} style={{ gap: 12 }} accessibilityLabel={`${r.name}, ${a.label}`}>
              <Pressable
                onPress={() => navigation.navigate('ResourceCalendar', { type: 'room', id: r.id })}
                style={{ gap: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconTile icon={Building2} tone="accent" size={42} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={16} weight="semibold">{r.name}</T>
                    <T size={13} color={colors.text3}>Planta {r.floor} · {r.capacity} personas</T>
                  </View>
                  {r.isActive ? <StatusBadge status={a.free ? 'approved' : 'pending'} label={a.label} /> : <StatusBadge tone="neutral" label="Oculta" />}
                </View>
                {(r.equipment || []).length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {r.equipment.map((e) => (
                      <View key={e} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder }}>
                        <T size={12} weight="medium" color={colors.text2}>{e}</T>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.glassBorder, gap: 8 }}>
                <GlassButton
                  title="Ver calendario"
                  variant="glass"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => navigation.navigate('ResourceCalendar', { type: 'room', id: r.id })}
                />
                <GlassButton
                  title="Reservar sala"
                  icon={Plus}
                  variant="primary"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => openBookingSheet('room', r.id)}
                />
              </View>
            </GlassCard>
          );
        }) : list.map((v) => {
          const a = availabilityNow(reservations, 'vehicle', v.id);
          return (
            <GlassCard key={v.id} style={{ gap: 12 }} accessibilityLabel={`${v.model}, ${v.plate}, ${a.label}`}>
              <Pressable
                onPress={() => navigation.navigate('ResourceCalendar', { type: 'vehicle', id: v.id })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <IconTile icon={Car} tone="teal" size={42} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T size={16} weight="semibold">{v.model}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.plateBg }}>
                      <T mono weight="semibold" size={12} color={colors.plateText} tracking={0.5}>{v.plate}</T>
                    </View>
                    <T size={13} color={colors.text3}>{[v.type, v.year].filter(Boolean).join(' · ')}</T>
                  </View>
                </View>
                {v.isActive ? <StatusBadge status={a.free ? 'approved' : 'pending'} label={a.label} /> : <Tag label="Oculto" tone="neutral" />}
              </Pressable>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.glassBorder, gap: 8 }}>
                <GlassButton
                  title="Ver calendario"
                  variant="glass"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => navigation.navigate('ResourceCalendar', { type: 'vehicle', id: v.id })}
                />
                <GlassButton
                  title="Reservar"
                  icon={Plus}
                  variant="primary"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => openBookingSheet('vehicle', v.id)}
                />
              </View>
            </GlassCard>
          );
        })}
      </View>

      {/* Quick Booking Sheet Modal */}
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Nueva reserva">
        <View style={{ gap: 16, paddingBottom: 24 }}>
          {/* Segmented type selector */}
          <Segmented
            value={bookType}
            onChange={(val) => {
              setBookType(val);
              const pool = val === 'room' ? visibleRooms : visibleVehicles;
              if (pool.length > 0) setSelectedId(pool[0].id);
            }}
            options={[
              { value: 'room', label: 'Sala de reuniones' },
              { value: 'vehicle', label: 'Vehículo de flota' },
            ]}
          />

          {/* Resource selector pills */}
          <View style={{ gap: 6 }}>
            <T size={13} weight="medium" color={colors.text2}>
              {bookType === 'room' ? 'Selecciona la sala:' : 'Selecciona el vehículo:'}
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {activeResources.map((res) => {
                const isSel = String(res.id) === String(selectedId ?? currentResource?.id);
                return (
                  <Pressable
                    key={res.id}
                    onPress={() => setSelectedId(res.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSel ? colors.accent : colors.glassBorder,
                      backgroundColor: isSel ? colors.accentSoft : colors.glassStrong,
                    }}
                  >
                    <T size={13.5} weight={isSel ? 'semibold' : 'regular'} color={isSel ? colors.accentFg : colors.text}>
                      {bookType === 'room' ? res.name : `${res.model} (${res.plate})`}
                    </T>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Date Picker */}
          <DateField
            label="Fecha de la reserva"
            value={form.date}
            onChange={(d) => setForm((f) => ({ ...f, date: d }))}
            minimumDate={new Date()}
          />

          {/* Time Pickers */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TimeField
                label="Hora inicio"
                value={form.start}
                onChange={(t) => setForm((f) => ({ ...f, start: t }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TimeField
                label="Hora fin"
                value={form.end}
                onChange={(t) => setForm((f) => ({ ...f, end: t }))}
              />
            </View>
          </View>

          {/* Purpose Input */}
          <GlassInput
            label="Motivo o propósito (opcional)"
            value={form.purpose}
            onChangeText={(p) => setForm((f) => ({ ...f, purpose: p }))}
            placeholder={bookType === 'room' ? 'p. ej. Reunión con cliente, formación...' : 'p. ej. Visita a obra, viaje comercial...'}
          />

          {/* Conflict status indicator */}
          {invalidRange ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.dangerSoft }}>
              <AlertTriangle size={18} color={colors.dangerFg} />
              <T size={13} color={colors.dangerFg}>La hora de fin debe ser posterior a la de inicio.</T>
            </View>
          ) : isPast ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.warningSoft }}>
              <AlertTriangle size={18} color={colors.warningFg} />
              <T size={13} color={colors.warningFg}>No se pueden crear reservas en días pasados.</T>
            </View>
          ) : conflicts.length > 0 ? (
            <View style={{ gap: 6, padding: 12, borderRadius: 12, backgroundColor: colors.dangerSoft }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color={colors.dangerFg} />
                <T size={13} weight="semibold" color={colors.dangerFg}>Horario ocupado</T>
              </View>
              <T size={12.5} color={colors.text2}>
                Coincide con {conflicts.length} reserva(s) existente(s) ({conflicts.map((c) => `${c.timeStart}–${c.timeEnd}`).join(', ')}).
              </T>
            </View>
          ) : currentResource ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.successSoft }}>
              <CheckCircle2 size={16} color={colors.successFg} />
              <T size={13} color={colors.successFg}>Horario disponible sin conflictos.</T>
            </View>
          ) : null}

          {/* Submit Button */}
          <GlassButton
            title={sending ? 'Enviando reserva...' : 'Confirmar reserva'}
            icon={Plus}
            variant="primary"
            disabled={!canSubmit || sending}
            onPress={handleCreateReservation}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
