import { useState } from 'react';
import { useAuth, useData } from '../context';
import { MOCK_ROOMS, MOCK_VEHICLES } from '../data/mockData';
import { Badge, Modal, Select, Input, Textarea, Button, Card } from '../components/ui';
import { Building, Car, Check, X, Plus, CalendarDays } from 'lucide-react';
import adminStyles from './AdminPage.module.scss';
import clsx from 'clsx';
import reqStyles from './RequestsPage.module.scss';
import ReservationsCalendar from './ReservationsCalendar';

export default function ReservationsPage() {
  const { user } = useAuth();
  const { reservations, setReservations } = useData();

  const [tab, setTab]         = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ type: 'room', resourceId: '', date: '', timeStart: '', timeEnd: '', purpose: '' });

  const filtered = tab === 'all' ? reservations : reservations.filter(r => r.type === tab);

  const handleCreate = () => {
    if (!form.resourceId || !form.date || !form.timeStart || !form.timeEnd || !form.purpose) return;
    const resources = form.type === 'room' ? MOCK_ROOMS : MOCK_VEHICLES;
    const res = resources.find(r => r.id === parseInt(form.resourceId));
    const newR = {
      id: Date.now(), type: form.type,
      resourceId: parseInt(form.resourceId),
      resourceName: form.type === 'room' ? res.name : `${res.model} ${res.plate}`,
      employeeId: user.id, employeeName: user.name,
      date: form.date, timeStart: form.timeStart, timeEnd: form.timeEnd,
      purpose: form.purpose, status: 'pending',
    };
    setReservations([newR, ...reservations]);
    setShowModal(false);
    setForm({ type: 'room', resourceId: '', date: '', timeStart: '', timeEnd: '', purpose: '' });
  };

  const handleDelete  = id => setReservations(reservations.filter(r => r.id !== id));
  const handleApprove = id => setReservations(reservations.map(r => r.id === id ? { ...r, status: 'confirmed' } : r));

  const tabBtn = (id, label) => (
    <button 
      key={id} 
      onClick={() => setTab(id)}
      className={clsx(adminStyles.tabBtn, { [adminStyles.tabBtnActive]: tab === id })}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Header */}
      <div className={adminStyles.tabs} style={{ marginBottom: 24, justifyContent: 'space-between', border: 'none' }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
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
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>Salas disponibles</h3>
          <div className={adminStyles.grid}>
            {MOCK_ROOMS.map(room => (
              <Card key={room.id} className={adminStyles.resourceCard}>
                <div className={adminStyles.resourceHeader}>
                  <div className={adminStyles.resourceIcon} style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                    <Building size={22} />
                  </div>
                  <Badge status="neutral" label="Disponible" className="variant-success" />
                </div>
                <h4 className={adminStyles.resourceTitle}>{room.name}</h4>
                <p className={adminStyles.resourceMeta}>Planta {room.floor} · {room.capacity} personas</p>
                <div className={adminStyles.tagList}>
                  {room.equipment.map(eq => (
                    <span key={eq} className={adminStyles.tag}>{eq}</span>
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
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>Vehículos de empresa</h3>
          <div className={adminStyles.grid}>
            {MOCK_VEHICLES.map(v => (
              <Card key={v.id} className={adminStyles.resourceCard}>
                <div className={adminStyles.resourceHeader}>
                  <div className={adminStyles.resourceIcon} style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                    <Car size={22} />
                  </div>
                  <Badge status="neutral" label="Disponible" className="variant-success" />
                </div>
                <h4 className={adminStyles.resourceTitle}>{v.model}</h4>
                <p className={adminStyles.resourceMeta}>Matrícula: <strong>{v.plate}</strong></p>
                <p className={adminStyles.resourceMeta} style={{ margin: 0 }}>{v.type} · {v.year}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Reservations table */}
      {tab !== 'calendar' && (
        <Card>
          <div style={{ padding: '24px 24px 0' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Historial de reservas</h3>
          </div>
          <div className={adminStyles.tableWrapper}>
            <table className={adminStyles.table}>
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
                      <div className={adminStyles.actionsCell} style={{ gap: 4 }}>
                        {user.role === 'admin' && r.status === 'pending' && (
                          <button className={clsx(adminStyles.actionBtn, reqStyles.approveBtn)} onClick={() => handleApprove(r.id)} style={{ padding: '6px' }}>
                            <Check size={14} />
                          </button>
                        )}
                        {(user.role === 'admin' || r.employeeId === user.id) && (
                          <button className={clsx(adminStyles.actionBtn, adminStyles.delete)} onClick={() => handleDelete(r.id)} style={{ padding: '6px' }}>
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
              ? MOCK_ROOMS.map(r => ({ value: r.id, label: `${r.name} (${r.capacity}p)` }))
              : MOCK_VEHICLES.map(v => ({ value: v.id, label: `${v.model} - ${v.plate}` }))),
          ]} 
        />
        <Input label="Fecha" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" required />
        <div className={adminStyles.modalGrid}>
          <Input label="Hora inicio" value={form.timeStart} onChange={v => setForm({ ...form, timeStart: v })} type="time" required />
          <Input label="Hora fin"    value={form.timeEnd}   onChange={v => setForm({ ...form, timeEnd: v })}   type="time" required />
        </div>
        <Textarea label="Propósito / motivo" value={form.purpose} onChange={v => setForm({ ...form, purpose: v })} placeholder="Describe el propósito de la reserva..." />
        <div className={adminStyles.modalActions}>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
          <Button onClick={handleCreate}>Crear reserva</Button>
        </div>
      </Modal>
    </div>
  );
}
