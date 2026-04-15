import { useState } from 'react';
import { useAuth, useData } from '../context';
import { Badge, Modal, Select, Input, Textarea, Button, Card } from '../components/ui';
import { Building, Car, Check, X, Plus } from 'lucide-react';
import styles from './ReservationsPage.module.scss';
import clsx from 'clsx';
import ReservationsCalendar from './ReservationsCalendar';

export default function ReservationsPage() {
  const { user } = useAuth();
  const { reservations, rooms, vehicles, createReservation, updateReservationStatus, deleteReservation } = useData();

  const [tab, setTab]           = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm]         = useState({ type: 'room', resourceId: '', date: '', timeStart: '', timeEnd: '', purpose: '' });

  const filtered = tab === 'all' ? reservations : tab === 'mine' ? reservations.filter(r => r.employeeId === user.id) : reservations.filter(r => r.type === tab);

  const handleCreate = async () => {
    if (!form.resourceId || !form.date || !form.timeStart || !form.timeEnd || !form.purpose) {
      setErrorMsg('Complete todos los campos requeridos');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const payload = {
      type: form.type,
      [form.type === 'room' ? 'room_id' : 'vehicle_id']: parseInt(form.resourceId),
      date: form.date,
      time_start: form.timeStart,
      time_end: form.timeEnd,
      purpose: form.purpose,
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

  const tabBtn = (id, label) => (
    <button 
      key={id} 
      onClick={() => setTab(id)}
      className={clsx(styles.tabBtn, { [styles.tabBtnActive]: tab === id })}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Header */}
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('all', 'Todas')}
          {tabBtn('room', 'Salas')}
          {tabBtn('vehicle', 'Vehículos')}
          {tabBtn('calendar', '📅 Calendario')}
        </div>
        {tab !== 'calendar' && (
          <Button icon={Plus} onClick={() => setShowModal(true)}>Nueva reserva</Button>
        )}
      </div>

      {/* Calendar view */}
      {tab === 'calendar' && <ReservationsCalendar />}

      {/* Room cards */}
      {tab !== 'vehicle' && tab !== 'calendar' && (
        <div style={{ marginBottom: 24 }}>
          <h3 className={styles.sectionLabel}>Salas disponibles</h3>
          <div className={styles.resourceGrid}>
            {rooms.map(room => (
              <Card key={room.id} className={styles.resourceCard}>
                <div className={styles.resourceHeader}>
                  <div className={styles.resourceIcon} style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                    <Building size={22} />
                  </div>
                  <Badge status="neutral" label="Disponible" className="variant-success" />
                </div>
                <h4 className={styles.resourceTitle}>{room.name}</h4>
                <p className={styles.resourceMeta}>Planta {room.floor} · {room.capacity} personas</p>
                <div className={styles.tagList}>
                  {(room.equipment || []).map(eq => (
                    <span key={eq} className={styles.tag}>{eq}</span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Vehicle cards */}
      {tab !== 'room' && tab !== 'calendar' && (
        <div style={{ marginBottom: 24 }}>
          <h3 className={styles.sectionLabel}>Vehículos de empresa</h3>
          <div className={styles.resourceGrid}>
            {vehicles.map(v => (
              <Card key={v.id} className={styles.resourceCard}>
                <div className={styles.resourceHeader}>
                  <div className={styles.resourceIcon} style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                    <Car size={22} />
                  </div>
                  <Badge status="neutral" label="Disponible" className="variant-success" />
                </div>
                <h4 className={styles.resourceTitle}>{v.model}</h4>
                <p className={styles.resourceMeta}>Matrícula: <strong>{v.plate}</strong></p>
                <p className={styles.resourceMeta} style={{ margin: 0 }}>{v.type} · {v.year}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Reservations table */}
      {tab !== 'calendar' && (
        <Card>
          <div style={{ padding: '20px 24px 0' }}>
            <h3 style={{ margin: '0 0 0', fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Historial de reservas</h3>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
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
                    <td style={{ color: 'var(--text)', fontWeight: 600 }}>{r.resourceName}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: r.type === 'vehicle' ? 'var(--warning)' : 'var(--accent)' }}>
                        {r.type === 'vehicle' ? <Car size={13} /> : <Building size={13} />}
                        {r.type === 'vehicle' ? 'Vehículo' : 'Sala'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-sec)' }}>{r.employeeName}</td>
                    <td style={{ color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td style={{ color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{r.timeStart}–{r.timeEnd}</td>
                    <td style={{ color: 'var(--text-sec)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.purpose}</td>
                    <td><Badge status={r.status} /></td>
                    <td>
                      <div className={styles.actionsCell} style={{ gap: 4 }}>
                        {user.role === 'admin' && r.status === 'pending' && (
                          <>
                            <button className={clsx(styles.actionBtn, styles.approveBtn)} onClick={() => handleApprove(r.id)} title="Aprobar">
                              <Check size={14} />
                            </button>
                            <button className={clsx(styles.actionBtn, styles.rejectBtn)} onClick={() => handleReject(r.id)} title="Rechazar">
                              <X size={14} />
                            </button>
                          </>
                        )}
                        {(user.role === 'admin' || r.employeeId === user.id) && r.status !== 'pending' && (
                          <button className={clsx(styles.actionBtn, styles.rejectBtn)} onClick={() => handleDelete(r.id)} title="Eliminar">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create modal */}
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
        <Input label="Fecha" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" required />
        <div className={styles.modalGrid}>
          <Input label="Hora inicio" value={form.timeStart} onChange={v => setForm({ ...form, timeStart: v })} type="time" required />
          <Input label="Hora fin"    value={form.timeEnd}   onChange={v => setForm({ ...form, timeEnd: v })}   type="time" required />
        </div>
        {errorMsg && (
          <div style={{ 
            color: 'var(--danger)', 
            background: 'var(--danger-bg)', 
            border: '1px solid var(--danger)', 
            borderRadius: '8px', 
            padding: '12px', 
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {errorMsg}
          </div>
        )}
        <Textarea label="Propósito / motivo" value={form.purpose} onChange={v => setForm({ ...form, purpose: v })} placeholder="Describe el propósito de la reserva..." />
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setShowModal(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={loading}>{loading ? 'Guardando...' : 'Crear reserva'}</Button>
        </div>
      </Modal>
    </div>
  );
}
