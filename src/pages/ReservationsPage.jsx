import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useReservations } from '../context';
import { Badge, Modal, Select, Input, Textarea, Button, Card, ConfirmModal, StatCard, Section } from '../components/ui';
import { Building, Car, Check, X, Plus, Download, Trash2, CalendarPlus, CalendarDays, Users, ArrowRight } from 'lucide-react';
import { downloadReservationIcs } from '../utils/ics';
import { fmtDayShort, todayKey } from '../utils/format';
import styles from './ReservationsPage.module.scss';
import clsx from 'clsx';
import ReservationsCalendar from './ReservationsCalendar';

/** Live state of a room or vehicle right now, from today's bookings. */
function useBusyUntil(reservations) {
  const now = new Date();
  const day = todayKey(now);
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (type, name) => reservations
    .filter(r => r.type === type && r.resourceName === name && r.date === day
      && r.status !== 'rejected' && r.status !== 'cancelled'
      && r.timeStart <= hm && r.timeEnd > hm)
    .map(r => r.timeEnd)
    .sort()
    .pop() || null;
}

function AvailabilityBadge({ until }) {
  return until
    ? <Badge status="pending" label={`En uso hasta ${until}`} />
    : <Badge status="confirmed" label="Libre ahora" />;
}

/** Keyboard + screen-reader support for the clickable resource cards. */
const pressable = (onActivate, label) => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  onClick: onActivate,
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
  },
});

export default function ReservationsPage() {
  const { user } = useAuth();
  const { reservations, rooms, vehicles, createReservation, updateReservationStatus, deleteReservation } = useReservations();
  const busyUntil = useBusyUntil(reservations);

  const [tab, setTab]           = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [form, setForm]         = useState({ type: 'room', resourceId: '', date: '', timeStart: '', timeEnd: '', purpose: '' });

  // ?nueva=1 (search, shortcuts, dashboard) opens the booking form straight away
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('nueva') === '1') {
      setShowModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = tab === 'all' ? reservations : tab === 'mine' ? reservations.filter(r => r.employeeId === user?.id) : reservations.filter(r => r.type === tab);

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
    }
  };

  const handleDelete  = async (id) => { await deleteReservation(id); };
  const handleApprove = async (id) => { await updateReservationStatus(id, 'confirmed', user.id); };
  const handleReject  = async (id) => { await updateReservationStatus(id, 'cancelled', user.id); };

  const tabBtn = (id, label, count) => (
    <button 
      key={id} 
      onClick={() => setTab(id)}
      className={clsx(styles.tabBtn, { [styles.tabBtnActive]: tab === id })}
    >
      {label}
      {typeof count === 'number' && count >= 0 && (
        <span className={styles.tabCount}>{count}</span>
      )}
    </button>
  );

  return (
    <div className={styles.container}>
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('all', 'Todas', reservations.length)}
          {tabBtn('room', 'Salas', rooms.length)}
          {tabBtn('vehicle', 'Vehículos', vehicles.length)}
          {tabBtn('calendar', <><CalendarDays size={15} aria-hidden="true" /> Calendario</>)}
        </div>
        <div className={styles.controlsRight}>
          {filtered.length > 0 && tab !== 'calendar' && (
            <Button icon={Download} variant="ghost" onClick={() => exportReservationsCSV(filtered)}>
              Descargar Excel
            </Button>
          )}
          <Button icon={Plus} onClick={() => setShowModal(true)}>Nueva reserva</Button>
        </div>
      </div>

      {tab !== 'calendar' && (
        <div className={styles.statsGrid}>
          <StatCard
            label="Total reservas"
            value={reservations.length}
            icon="Calendar"
            color="var(--accent)"
            sub="Histórico registrado"
          />
          <StatCard
            label="Salas activas"
            value={rooms.length}
            icon="Building"
            color="var(--success)"
            sub="Espacios de reunión"
          />
          <StatCard
            label="Vehículos flota"
            value={vehicles.length}
            icon="Car"
            color="var(--warning)"
            sub="Flota disponible"
          />
        </div>
      )}

      {tab === 'calendar' && <ReservationsCalendar />}

      {tab !== 'vehicle' && tab !== 'calendar' && (
        <Section title="Salas de reuniones" description="Pulsa una sala para reservarla.">
          <div className={styles.resourceGrid}>
            {rooms.map(room => (
              <Card
                key={room.id}
                className={styles.resourceCard}
                {...pressable(() => {
                  setForm(f => ({ ...f, type: 'room', resourceId: String(room.id) }));
                  setShowModal(true);
                }, `Reservar ${room.name}`)}
              >
                <div className={styles.resourceTop}>
                  <span className={styles.resourceIcon} data-tone="room" aria-hidden="true">
                    <Building size={20} />
                  </span>
                  <AvailabilityBadge until={busyUntil('room', room.name)} />
                </div>
                <h3 className={styles.resourceTitle}>{room.name}</h3>
                <p className={styles.resourceMeta}>
                  {room.floor && <span>Planta {room.floor}</span>}
                  {room.capacity && <span><Users size={13} aria-hidden="true" /> {room.capacity} personas</span>}
                </p>
                {(room.equipment || []).length > 0 && (
                  <div className={styles.tagList}>
                    {room.equipment.map(eq => (
                      <span key={eq} className={styles.tag}>{eq}</span>
                    ))}
                  </div>
                )}
                <span className={styles.resourceCta} aria-hidden="true">Reservar <ArrowRight size={14} /></span>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {tab !== 'room' && tab !== 'calendar' && (
        <Section title="Vehículos de empresa" description="Reserva un coche o furgoneta para visitas y obras.">
          <div className={styles.resourceGrid}>
            {vehicles.map(v => (
              <Card
                key={v.id}
                className={styles.resourceCard}
                {...pressable(() => {
                  setForm(f => ({ ...f, type: 'vehicle', resourceId: String(v.id) }));
                  setShowModal(true);
                }, `Reservar ${v.model} (${v.plate})`)}
              >
                <div className={styles.resourceTop}>
                  <span className={styles.resourceIcon} data-tone="vehicle" aria-hidden="true">
                    <Car size={20} />
                  </span>
                  <AvailabilityBadge until={busyUntil('vehicle', v.model)} />
                </div>
                <h3 className={styles.resourceTitle}>{v.model}</h3>
                <p className={styles.resourceMeta}>
                  {[v.type, v.year].filter(Boolean).length > 0 && <span>{[v.type, v.year].filter(Boolean).join(' · ')}</span>}
                </p>
                <div className={styles.tagList}>
                  <span className={styles.plate}>{v.plate}</span>
                </div>
                <span className={styles.resourceCta} aria-hidden="true">Reservar <ArrowRight size={14} /></span>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {tab !== 'calendar' && (
        <Section title="Historial de reservas" description={`${filtered.length} ${filtered.length === 1 ? 'reserva' : 'reservas'}`}>
        <Card>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className={clsx("icon-box icon-box--lg icon-box--accent empty-state__icon", styles.opaqueIcon)}>
                <Building size={24} />
              </div>
              <h3 className="empty-state__title">No hay reservas</h3>
              <p className="empty-state__sub">No se han encontrado reservas en este momento.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className="table">
                <thead>
                  <tr>
                    {['Recurso', 'Tipo', 'Solicitante', 'Fecha', 'Horario', 'Propósito', 'Estado', 'Acciones'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td data-label="Recurso" className={styles.resourceNameCell}>{r.resourceName}</td>
                      <td data-label="Tipo">
                        <span className={clsx(styles.typeBadge, r.type === 'vehicle' ? styles.typeBadgeVehicle : styles.typeBadgeRoom)}>
                          {r.type === 'vehicle' ? <Car size={13} /> : <Building size={13} />}
                          {r.type === 'vehicle' ? 'Vehículo' : 'Sala'}
                        </span>
                      </td>
                      <td data-label="Solicitante" className={styles.textSec}>{r.employeeName}</td>
                      <td data-label="Fecha" className={clsx(styles.textSec, styles.noMargin, styles.nowrap)}>{fmtDayShort(r.date)}</td>
                      <td data-label="Horario" className={clsx(styles.textSec, styles.noMargin, styles.nowrap)}>{r.timeStart}–{r.timeEnd}</td>
                      <td data-label="Propósito" className={styles.purposeCell} title={r.purpose}>{r.purpose}</td>
                      <td data-label="Estado"><Badge status={r.status} /></td>
                      <td data-label="Acciones">
                        <div className={styles.actionsCell}>
                          {user.role === 'admin' && r.status === 'pending' && (
                            <>
                              <Button variant="action-success" iconOnly icon={Check} onClick={() => handleApprove(r.id)} title="Aprobar" />
                              <Button variant="action-danger" iconOnly icon={X} onClick={() => handleReject(r.id)} title="Rechazar" />
                            </>
                          )}
                          {r.employeeId === user?.id && r.status !== 'rejected' && r.status !== 'cancelled' && (
                            <Button
                              variant="action-download"
                              iconOnly
                              icon={CalendarPlus}
                              onClick={() => downloadReservationIcs(r)}
                              title="Añadir a mi calendario"
                              aria-label={`Añadir ${r.resourceName} a mi calendario`}
                            />
                          )}
                          {(user?.role === 'admin' || r.employeeId === user?.id) && (
                            <Button variant="action-danger" iconOnly icon={Trash2} onClick={() => setItemToDelete(r.id)} title="Eliminar" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </Section>
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
              ? rooms.map(r => ({ value: r.id, label: `${r.name} (${r.capacity}p)` }))
              : vehicles.map(v => ({ value: v.id, label: `${v.model} - ${v.plate}` }))),
          ]} 
        />
        <Input label="Fecha" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" min={todayKey()} required />
        <div className={styles.modalGrid}>
          <Input label="Hora inicio" value={form.timeStart} onChange={v => setForm({ ...form, timeStart: v })} type="time" required />
          <Input label="Hora fin"    value={form.timeEnd}   onChange={v => setForm({ ...form, timeEnd: v })}   type="time" required />
        </div>
        {errorMsg && (
          <div className={styles.errorAlert}>
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
    </div>
  );
}
