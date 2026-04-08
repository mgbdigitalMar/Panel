import { useState } from 'react';
import { useAuth, useData } from '../context';
import { Avatar, Badge, Modal, Input, Textarea, Button, Card, StatCard } from '../components/ui';
import { Plus, Check, X } from 'lucide-react';
import styles from './RequestsPage.module.scss';
import clsx from 'clsx';
import adminStyles from './AdminPage.module.scss'; // Reuse tab / table styles from AdminPage

export default function RequestsPage() {
  const { user } = useAuth();
  const { requests, setRequests } = useData();
  
  const [tab, setTab]             = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [reqType, setReqType]     = useState('vacation');
  const [form, setForm]           = useState({ startDate: '', endDate: '', reason: '', item: '', amount: '' });

  const filtered =
    tab === 'all'      ? requests :
    tab === 'mine'     ? requests.filter(r => r.employeeId === user.id) :
    requests.filter(r => r.type === tab);

  const handleCreate = () => {
    const base = { id: Date.now(), employeeId: user.id, employeeName: user.name, status: 'pending', createdAt: new Date().toISOString().split('T')[0] };
    let newReq;
    if (reqType === 'vacation') {
      const days = Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24));
      newReq = { ...base, type: 'vacation', startDate: form.startDate, endDate: form.endDate, days, reason: form.reason };
    } else {
      newReq = { ...base, type: 'purchase', item: form.item, amount: parseFloat(form.amount) || 0, reason: form.reason };
    }
    setRequests([newReq, ...requests]);
    setShowModal(false);
    setForm({ startDate: '', endDate: '', reason: '', item: '', amount: '' });
  };

  const changeStatus = (id, status) => setRequests(requests.map(r => r.id === id ? { ...r, status } : r));

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
          {tabBtn('mine', 'Mis solicitudes')}
          {tabBtn('vacation', 'Vacaciones')}
          {tabBtn('purchase', 'Compras')}
        </div>
        <Button icon={Plus} onClick={() => setShowModal(true)}>Nueva solicitud</Button>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard label="Pendientes" count={requests.filter(r => r.status === 'pending').length}  color="var(--warning)" value={requests.filter(r => r.status === 'pending').length} icon="Clock" />
        <StatCard label="Aprobadas"  count={requests.filter(r => r.status === 'approved').length} color="var(--success)" value={requests.filter(r => r.status === 'approved').length} icon="CheckCircle" />
        <StatCard label="Rechazadas" count={requests.filter(r => r.status === 'rejected').length} color="var(--danger)"  value={requests.filter(r => r.status === 'rejected').length} icon="XCircle" />
      </div>

      {/* Table */}
      <Card>
        <div className={adminStyles.tableWrapper}>
          <table className={adminStyles.table}>
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
                    <div className={adminStyles.userCell}>
                      <Avatar initials={r.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)} size={32} />
                      <span className={adminStyles.userName}>{r.employeeName}</span>
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
                        <div className={adminStyles.actionsCell}>
                          <button className={clsx(adminStyles.actionBtn, styles.approveBtn)} onClick={() => changeStatus(r.id, 'approved')}>
                            <Check size={14} /> Aprobar
                          </button>
                          <button className={clsx(adminStyles.actionBtn, adminStyles.delete)} onClick={() => changeStatus(r.id, 'rejected')}>
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
        <div className={styles.typeButtons} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[{ id: 'vacation', label: 'Vacaciones' }, { id: 'purchase', label: 'Compra' }].map(rt => (
            <button 
              key={rt.id} 
              onClick={() => setReqType(rt.id)}
              className={clsx(styles.typeBtn, { [styles.typeBtnActive]: reqType === rt.id })}
              style={{ flex: 1, padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: reqType === rt.id ? 'var(--nav-bg)' : 'transparent', color: reqType === rt.id ? 'var(--nav)' : 'var(--text-sec)', fontWeight: 600 }}
            >
              {rt.label}
            </button>
          ))}
        </div>

        {reqType === 'vacation' ? (
          <>
            <div className={adminStyles.modalGrid}>
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

        <div className={adminStyles.modalActions}>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
          <Button onClick={handleCreate}>Enviar solicitud</Button>
        </div>
      </Modal>
    </div>
  );
}
