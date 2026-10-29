import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useReservations, useNotifs } from '../context';
import { Modal, Select, Input, Textarea, Button, ConfirmModal } from '../components/ui';
import { useTouch } from '../components/Touch';
import ReservationsTouch from './ReservationsTouch';
import ReservationsDesk from './ReservationsDesk';
import { X } from 'lucide-react';
import { downloadReservationIcs } from '../utils/ics';
import { fmtDayShort, todayKey } from '../utils/format';
import styles from './ReservationsPage.module.scss';
import clsx from 'clsx';

/** Live state of a room or vehicle right now, from today's bookings. Matched by id: two vehicles of
 * the same model (or rooms with the same name) are different resources. The name is only a fallback
 * for a booking without its resource id. */
function useBusyUntil(reservations) {
  const now = new Date();
  const day = todayKey(now);
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const sameResource = (r, type, id, name) => {
    const rid = type === 'vehicle' ? r.vehicleId : r.roomId;
    return rid != null ? String(rid) === String(id) : r.resourceName === name;
  };
  return (type, id, name) => reservations
    .filter(r => r.type === type && sameResource(r, type, id, name) && r.date === day
      && r.status !== 'rejected' && r.status !== 'cancelled'
      && r.timeStart <= hm && r.timeEnd > hm)
    .map(r => r.timeEnd)
    .sort()
    .pop() || null;
}

export default function ReservationsPage() {
  const { user } = useAuth();
  const { reservations, rooms: allRooms, vehicles: allVehicles, createReservation, updateReservationStatus, deleteReservation } = useReservations();
  const { announce } = useNotifs();
  const busyUntil = useBusyUntil(reservations);
  const isAdmin = user?.role === 'admin';
  // A room or vehicle an admin made unavailable ("Disponible para reservas" off, in the app or in
  // Administración) is not offered to employees, as in the app. Admins still see it, marked.
  const rooms = allRooms.filter(r => r.isActive !== false || isAdmin);
  const vehicles = allVehicles.filter(v => v.isActive !== false || isAdmin);
  const hiddenMark = (res) => (res.isActive === false ? ' · oculto a los empleados' : '');

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [form, setForm]         = useState({ type: 'room', resourceId: '', date: '', timeStart: '', timeEnd: '', purpose: '' });

  // ?nueva=1 (search, shortcuts, dashboard) opens the booking form straight away; &tipo=vehicle picks a car.
  // ?mias=1 (phone dashboard) opens "Mis reservas".
  const [searchParams, setSearchParams] = useSearchParams();
  const [touchView] = useState(() => (searchParams.get('mias') === '1' ? 'agenda' : 'resources'));
  useEffect(() => {
    if (searchParams.get('nueva') === '1') {
      if (searchParams.get('tipo') === 'vehicle') setForm(f => ({ ...f, type: 'vehicle', resourceId: '' }));
      setShowModal(true);
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('mias') === '1') {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const touch = useTouch();
  const book = (type, id) => {
    setForm(f => ({ ...f, type, resourceId: String(id) }));
    setShowModal(true);
  };

  const exportReservationsCSV = (rows) => {
    const headers = ['Recurso', 'Tipo', 'Solicitante', 'Fecha', 'Horario', 'Propósito', 'Estado'];
    const lines = [
      headers.join(';'),
      ...rows.map(r => {
        const typeLabel = r.type === 'vehicle' ? 'Vehículo' : 'Sala';
        const status = r.status === 'confirmed' ? 'Confirmada' : r.status === 'cancelled' ? 'Cancelada' : 'Pendiente';
        return [
          r.resourceName || '—',
          typeLabel,
          r.employeeName || '—',
          r.date,
          `${r.timeStart}-${r.timeEnd}`,
          `"${(r.purpose || '').replace(/"/g, '""')}"`,
          status
        ].join(';');
      }),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `reservas-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleCreate = async () => {
    if (!form.resourceId || !form.date || !form.timeStart || !form.timeEnd) {
      setErrorMsg('Por favor selecciona un recurso, fecha y horario');
      return;
    }
    if (form.timeEnd <= form.timeStart) {
      setErrorMsg('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }
    if (new Date(`${form.date}T${form.timeStart}`) < new Date()) {
      setErrorMsg('No se puede reservar en una fecha u hora que ya ha pasado');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const payload = {
      type: form.type,
      [form.type === 'room' ? 'room_id' : 'vehicle_id']: parseInt(form.resourceId, 10),
      date: form.date,
      time_start: form.timeStart,
      time_end: form.timeEnd,
      purpose: form.purpose?.trim() || (form.type === 'room' ? 'Reserva de sala' : 'Uso de vehículo'),
      status: 'pending',
    };
    const result = await createReservation(user.id, payload);
    setLoading(false);
    if (result?.error) {
      setErrorMsg(result.error);
    } else {
      setShowModal(false);
      setForm({ type: 'room', resourceId: '', date: '', timeStart: '', timeEnd: '', purpose: '' });
      announce('✅', 'Reserva creada. Te avisaremos cuando se revise.');
    }
  };

  const handleDelete  = async (id) => {
    const { error } = await deleteReservation(id);
    if (!error) announce('🗑️', 'Reserva eliminada.');
  };

  // One review at a time per booking (a double click sent two updates); rejecting asks first,
  // as in the app, because it cancels the booking and notifies its owner
  const [busyId, setBusyId] = useState(null);
  const inFlight = useRef(new Set());
  const [toReject, setToReject] = useState(null);
  const findRes = (id) => reservations.find(r => String(r.id) === String(id));
  const review = async (r, status) => {
    if (!r || inFlight.current.has(r.id)) return;
    inFlight.current.add(r.id);
    setBusyId(r.id);
    const { error } = await updateReservationStatus(r.id, status, user.id);
    inFlight.current.delete(r.id);
    setBusyId(null);
    if (!error) {
      const who = r.employeeId === user?.id ? '' : ` Se ha avisado a ${(r.employeeName || 'la persona').split(' ')[0]}.`;
      announce(status === 'confirmed' ? '✅' : '❌', `${status === 'confirmed' ? 'Reserva confirmada' : 'Reserva cancelada'}.${who}`);
    }
  };
  const handleApprove = (id) => review(findRes(id), 'confirmed');
  const handleReject  = (id) => setToReject(findRes(id) || null);

  return (
    <div className={styles.container}>
      {/* Phones and tablets: the web's touch composition */}
      {touch ? (
        <ReservationsTouch
          rooms={rooms}
          vehicles={vehicles}
          reservations={reservations}
          user={user}
          busyUntil={busyUntil}
          initialView={touchView}
          onBook={book}
          onNew={() => setShowModal(true)}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={setItemToDelete}
          onAddToCalendar={downloadReservationIcs}
          onExport={exportReservationsCSV}
          busyId={busyId}
        />
      ) : (
        <ReservationsDesk
          rooms={rooms}
          vehicles={vehicles}
          reservations={reservations}
          user={user}
          busyUntil={busyUntil}
          initialView={touchView}
          onBook={book}
          onNew={() => setShowModal(true)}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={setItemToDelete}
          onAddToCalendar={downloadReservationIcs}
          onExport={exportReservationsCSV}
          busyId={busyId}
        />
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva reserva">
        <Select label="Tipo de recurso" value={form.type}
          onChange={v => setForm({ ...form, type: v, resourceId: '' })}
          options={[{ value: 'room', label: 'Sala de reuniones' }, { value: 'vehicle', label: 'Vehículo de empresa' }]} 
        />
        <Select label="Recurso" value={form.resourceId} onChange={v => setForm({ ...form, resourceId: v })} required
          options={[
            { value: '', label: 'Selecciona un recurso...' },
            ...(form.type === 'room'
              ? rooms.map(r => ({ value: r.id, label: `${r.name} (${r.capacity}p)${hiddenMark(r)}` }))
              : vehicles.map(v => ({ value: v.id, label: `${v.model} - ${v.plate}${hiddenMark(v)}` }))),
          ]} 
        />
        <Input label="Fecha" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" min={todayKey()} required />
        <div className={styles.modalGrid}>
          <Input label="Hora inicio" value={form.timeStart} onChange={v => setForm({ ...form, timeStart: v })} type="time" required />
          <Input label="Hora fin"    value={form.timeEnd}   onChange={v => setForm({ ...form, timeEnd: v })}   type="time" required />
        </div>
        {errorMsg && (
          <div className={clsx(styles.errorAlert, 'appear')} role="alert">
            {errorMsg}
          </div>
        )}
        <Textarea label="Propósito / motivo" value={form.purpose} onChange={v => setForm({ ...form, purpose: v })} placeholder="Describe el propósito de la reserva..." />
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setShowModal(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={loading}>{loading ? 'Guardando...' : 'Crear reserva'}</Button>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!itemToDelete} 
        onClose={() => setItemToDelete(null)} 
        onConfirm={async () => {
          if (itemToDelete) {
            await handleDelete(itemToDelete);
            setItemToDelete(null);
          }
        }} 
        title="Eliminar reserva"
        message="¿Estás seguro de que deseas eliminar esta reserva? Esta acción no se puede deshacer."
      />

      <ConfirmModal
        isOpen={!!toReject}
        onClose={() => setToReject(null)}
        onConfirm={() => review(toReject, 'cancelled')}
        icon={X}
        title="Rechazar reserva"
        message={toReject ? `${toReject.resourceName} · ${fmtDayShort(toReject.date)}, ${toReject.timeStart}–${toReject.timeEnd} · ${toReject.employeeName || 'empleado'}. La reserva quedará cancelada y se le avisará.` : ''}
        confirmText="Rechazar"
      />
    </div>
  );
}
