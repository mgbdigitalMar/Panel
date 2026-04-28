import { useState } from 'react';
import { useAuth, useData } from '../context';
import { Avatar, Badge, Modal, Input, Textarea, Button, Card, StatCard } from '../components/ui';
import { Plus, Check, X } from 'lucide-react';
import styles from './RequestsPage.module.scss';
import clsx from 'clsx';

export default function RequestsPage() {
  const { user } = useAuth();
  const { requests, createRequest, updateRequestStatus } = useData();
  
  const [tab, setTab]             = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [reqType, setReqType]     = useState('vacation');
  const [loading, setLoading]     = useState(false);
  const [form, setForm]           = useState({ startDate: '', endDate: '', reason: '', item: '', amount: '' });

  const filtered =
    tab === 'all'      ? requests :
    tab === 'mine'     ? requests.filter(r => r.employeeId === user.id) :
    requests.filter(r => r.type === tab);

  const handleCreate = async () => {
    setLoading(true);
    let payload;
    if (reqType === 'vacation') {
      payload = { type: 'vacation', start_date: form.startDate, end_date: form.endDate, reason: form.reason };
    } else {
      payload = { type: 'purchase', item: form.item, amount: parseFloat(form.amount) || 0, reason: form.reason };
    }
    await createRequest(user.id, payload);
    setLoading(false);
    setShowModal(false);
    setForm({ startDate: '', endDate: '', reason: '', item: '', amount: '' });
  };

  const changeStatus = async (id, status, employeeId) => {
    await updateRequestStatus(id, status, user.id, employeeId);
  };

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
    <div className={styles.container}>
      {/* Controls */}
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('all', 'Todas')}
          {tabBtn('mine', 'Mis solicitudes')}
          {tabBtn('vacation', 'Vacaciones')}
          {tabBtn('purchase', 'Compras')}
        </div>
        <Button icon={Plus} onClick={() => setShowModal(true)}>Nueva solicitud</Button>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard label="Pendientes" value={requests.filter(r => r.status === 'pending').length}  color="var(--warning)" icon="Clock" sub="Esperando revisión" />
        <StatCard label="Aprobadas"  value={requests.filter(r => r.status === 'approved').length} color="var(--success)" icon="CheckCircle" sub="Este periodo" />
        <StatCard label="Rechazadas" value={requests.filter(r => r.status === 'rejected').length} color="var(--danger)"  icon="XCircle" sub="Sin acción" />
      </div>

      {/* Table */}
      <Card>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {['Empleado', 'Tipo', 'Detalle', 'Fecha solicitud', 'Estado', user.role === 'admin' ? 'Acciones' : null].filter(Boolean).map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className={styles.userCell}>
                      <Avatar initials={(r.employeeName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()} size={32} />
                      <span className={styles.userName}>{r.employeeName || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <Badge status={r.type} label={r.type === 'vacation' ? 'Vacaciones' : 'Compra'} />
                  </td>
                  <td style={{ color: 'var(--text-sec)' }}>
                    {r.type === 'vacation'
                      ? `${r.startDate} → ${r.endDate} (${r.days} días)`
                      : `${r.item} — ${r.amount}€`}
                  </td>
                  <td style={{ color: 'var(--text-mut)' }}>{r.createdAt}</td>
                  <td><Badge status={r.status} /></td>
                  {user.role === 'admin' && (
                    <td>
                      {r.status === 'pending' && (
                        <div className={styles.actionsCell}>
                          <button className={clsx(styles.actionBtn, styles.approveBtn)} onClick={() => changeStatus(r.id, 'approved', r.employeeId)}>
                            <Check size={14} /> Aprobar
                          </button>
                          <button className={clsx(styles.actionBtn, styles.rejectBtn)} onClick={() => changeStatus(r.id, 'rejected', r.employeeId)}>
                            <X size={14} /> Rechazar
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New request modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva solicitud">
        <div className={styles.typeButtons}>
          {[{ id: 'vacation', label: '🌴 Vacaciones' }, { id: 'purchase', label: '🛒 Compra' }].map(rt => (
            <button 
              key={rt.id} 
              onClick={() => setReqType(rt.id)}
              className={clsx(styles.typeBtn, { [styles.typeBtnActive]: reqType === rt.id })}
            >
              {rt.label}
            </button>
          ))}
        </div>

        {reqType === 'vacation' ? (
          <>
            <div className={styles.modalGrid}>
              <Input label="Fecha inicio" value={form.startDate} onChange={v => setForm({ ...form, startDate: v })} type="date" required />
              <Input label="Fecha fin"    value={form.endDate}   onChange={v => setForm({ ...form, endDate: v })}   type="date" required />
            </div>
            <Textarea label="Motivo" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="Describe el motivo de las vacaciones..." />
          </>
        ) : (
          <>
            <Input label="Artículo / servicio" value={form.item} onChange={v => setForm({ ...form, item: v })} placeholder="Ej: Licencia software, material de oficina..." required />
            <Input label="Importe estimado (€)" value={form.amount} onChange={v => setForm({ ...form, amount: v })} type="number" required />
            <Textarea label="Justificación" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="Explica para qué se necesita y su impacto..." />
          </>
        )}

        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setShowModal(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={loading}>{loading ? 'Enviando...' : 'Enviar solicitud'}</Button>
        </div>
      </Modal>
    </div>
  );
}
