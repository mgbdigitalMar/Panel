// 22 · Salas y flota (AdminPage > Salas / Vehículos on the web)
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Building2, Car, Plus, X } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { Screen } from '../../components/common/Screen';
import { Header } from '../../components/common/Header';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassButton } from '../../components/common/GlassButton';
import { GlassInput } from '../../components/common/GlassInput';
import { Tag } from '../../components/common/StatusBadge';
import { T } from '../../components/common/Text';
import { EmptyState, IconTile, Segmented, Sheet, Stepper, SwitchRow, ChipRail } from '../../components/common/UI';

const EQUIPMENT_SUGGESTIONS = ['Proyector', 'Pantalla', 'Videoconferencia', 'Pizarra', 'Audio', 'Accesible'];
const VEHICLE_TYPES = ['Turismo', 'Furgoneta', 'SUV'];

export default function AdminResourcesScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { rooms, vehicles, reservations, saveRoom, deleteRoom, saveVehicle, deleteVehicle, refresh } = useData();
  const [tab, setTab] = useState('room');
  const [edit, setEdit] = useState(null); // { id, ...form }
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const openNew = () => {
    setNewTag('');
    setEdit(tab === 'room'
      ? { id: null, name: '', floor: '0', capacity: 6, equipment: [], isActive: true }
      : { id: null, model: '', plate: '', year: String(new Date().getFullYear()), type: 'Turismo', isActive: true });
  };
  const openRoom = (r) => { setNewTag(''); setEdit({ id: r.id, name: r.name, floor: String(r.floor ?? ''), capacity: r.capacity || 1, equipment: r.equipment || [], isActive: r.isActive }); };
  const openVehicle = (v) => setEdit({ id: v.id, model: v.model, plate: v.plate, year: v.year ? String(v.year) : '', type: v.type || 'Turismo', isActive: v.isActive });

  const set = (k) => (v) => setEdit((e) => ({ ...e, [k]: v }));
  const valid = edit && (tab === 'room' ? edit.name?.trim() && edit.capacity > 0 : edit.model?.trim() && edit.plate?.trim());

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const { error } = tab === 'room' ? await saveRoom(edit.id, edit) : await saveVehicle(edit.id, edit);
    setSaving(false);
    if (error) toast.error(toUserMessage(error));
    else { toast.success(edit.id ? 'Cambios guardados' : tab === 'room' ? 'Sala creada' : 'Vehículo creado'); setEdit(null); }
  };

  const remove = () => {
    const linked = reservations.filter((r) => (tab === 'room' ? r.roomId : r.vehicleId) === edit.id).length;
    Alert.alert(
      tab === 'room' ? 'Eliminar sala' : 'Eliminar vehículo',
      `Esta acción no se puede deshacer.${linked ? ` También se eliminarán sus ${linked} reservas.` : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            const { error } = tab === 'room' ? await deleteRoom(edit.id) : await deleteVehicle(edit.id);
            setSaving(false);
            if (error) toast.error(toUserMessage(error));
            else { toast.success('Eliminado'); setEdit(null); }
          },
        },
      ],
    );
  };

  const addTag = (t) => {
    const v = t.trim();
    if (!v || edit.equipment.includes(v)) return;
    setEdit((e) => ({ ...e, equipment: [...e.equipment, v] }));
    setNewTag('');
  };

  const list = tab === 'room' ? rooms : vehicles;

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing}>
      <Header back title="Salas y flota" right={<GlassButton title={tab === 'room' ? 'Nueva sala' : 'Nuevo vehículo'} icon={Plus} size="sm" onPress={openNew} />} />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'room', label: `Salas · ${rooms.length}` }, { value: 'vehicle', label: `Vehículos · ${vehicles.length}` }]} />

      <View style={{ gap: 8 }}>
        {list.length === 0 ? (
          <EmptyState icon={tab === 'room' ? Building2 : Car} title={tab === 'room' ? 'No hay salas' : 'No hay vehículos'} />
        ) : list.map((r) => (
          <GlassCard key={r.id} onPress={() => (tab === 'room' ? openRoom(r) : openVehicle(r))} padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile icon={tab === 'room' ? Building2 : Car} tone={tab === 'room' ? 'accent' : 'teal'} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={15} weight="semibold">{tab === 'room' ? r.name : r.model}</T>
              <T size={13} color={colors.text3}>
                {tab === 'room' ? `Planta ${r.floor} · ${r.capacity} pers.${(r.equipment || []).length ? ` · ${r.equipment.join(', ')}` : ''}` : [r.plate, r.type, r.year].filter(Boolean).join(' · ')}
              </T>
            </View>
            {!r.isActive ? <Tag label="Oculto" tone="neutral" /> : null}
          </GlassCard>
        ))}
      </View>

      <Sheet
        visible={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? (tab === 'room' ? 'Editar sala' : 'Editar vehículo') : (tab === 'room' ? 'Nueva sala' : 'Nuevo vehículo')}
        footer={(
          <>
            <GlassButton title={edit?.id ? 'Guardar' : 'Crear'} size="lg" loading={saving} disabled={!valid} onPress={save} />
            {edit?.id ? <GlassButton title={tab === 'room' ? 'Eliminar sala' : 'Eliminar vehículo'} variant="danger" onPress={remove} disabled={saving} /> : null}
          </>
        )}
      >
        {edit && tab === 'room' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <GlassInput label="Nombre" value={edit.name} onChangeText={set('name')} required style={{ flex: 2 }} />
              <GlassInput label="Planta" value={edit.floor} onChangeText={set('floor')} keyboardType="number-pad" style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T size={15}>Capacidad</T>
              <Stepper value={edit.capacity} onChange={set('capacity')} min={1} max={200} label="Capacidad" />
            </View>
            <View style={{ gap: 8 }}>
              <T size={13} weight="medium">Equipamiento</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {edit.equipment.map((eq) => (
                  <Pressable key={eq} onPress={() => setEdit((e) => ({ ...e, equipment: e.equipment.filter((x) => x !== eq) }))} accessibilityRole="button" accessibilityLabel={`Quitar ${eq}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder }}>
                    <T size={13} weight="medium">{eq}</T>
                    <X size={13} color={colors.text2} />
                  </Pressable>
                ))}
                {EQUIPMENT_SUGGESTIONS.filter((s) => !edit.equipment.includes(s)).map((s) => (
                  <Pressable key={s} onPress={() => addTag(s)} accessibilityRole="button"
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.glassBorderStrong }}>
                    <T size={13} color={colors.text2}>+ {s}</T>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <GlassInput value={newTag} onChangeText={setNewTag} placeholder="Nueva etiqueta" style={{ flex: 1 }} returnKeyType="done" onSubmitEditing={() => addTag(newTag)} />
                <GlassButton title="Añadir" variant="glass" onPress={() => addTag(newTag)} disabled={!newTag.trim()} />
              </View>
            </View>
            <SwitchRow title="Disponible para reservas" subtitle="Si la desactivas, se ocultará a los empleados" value={edit.isActive !== false} onValueChange={set('isActive')} />
          </>
        ) : null}
        {edit && tab === 'vehicle' ? (
          <>
            <GlassInput label="Modelo" value={edit.model} onChangeText={set('model')} required />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <GlassInput label="Matrícula" value={edit.plate} onChangeText={set('plate')} autoCapitalize="characters" required style={{ flex: 1 }} />
              <GlassInput label="Año" value={edit.year} onChangeText={set('year')} keyboardType="number-pad" style={{ flex: 1 }} />
            </View>
            <T size={13} weight="medium">Tipo</T>
            <ChipRail value={edit.type} onChange={set('type')} options={VEHICLE_TYPES.map((t) => ({ value: t, label: t }))} />
            <SwitchRow title="Disponible para reservas" subtitle="Si lo desactivas, se ocultará a los empleados" value={edit.isActive !== false} onValueChange={set('isActive')} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
